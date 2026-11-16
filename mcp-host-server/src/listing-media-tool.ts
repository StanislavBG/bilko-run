/**
 * Core of the owner-facing `set_listing_media` MCP tool.
 *
 * The owner points listing.video / shareImage / icon at local files. Each file is checked with
 * the share-assets rules, the registry is pointed at its hosted path
 * /projects/<slug>/_media/<sha256>.<ext> in one commit pushed through the isolated publish
 * checkout, then the bytes are uploaded to bilko.run's PUT /api/listing-media/<slug>/<file>.
 * Nothing is ever written into public/projects/<slug>/.
 *
 * Pure of the MCP SDK (server.ts registers the tool). Progress goes to stderr only: stdout is
 * the MCP transport.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RegistrySchema, type RegistryProject } from './contract/registry.js';
import { hostedMediaPath, type HostedMediaExt } from './contract/listing-media.js';
import { checkCardMediaFile } from './gates/share-assets.js';
import { parseRegistry } from './publish-request.js';
import { readLatestRegistryRaw, REGISTRY_PATH } from './registry-source.js';
import { withPublishCheckout, type LocalMainSync, type PublishOutcome } from './publish-checkout.js';
import { updateListingInRegistry } from './listing-tool.js';
import { assertCallerOwnsSlug } from './ownership.js';

export type MediaField = 'video' | 'shareImage' | 'icon';
const FIELDS: readonly MediaField[] = ['video', 'shareImage', 'icon'];

export const DEFAULT_RETRY_DELAYS_MS = [2000, 5000, 10000, 20000];

const CONTENT_TYPES: Record<HostedMediaExt, string> = {
  png: 'image/png',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

const ALLOWED_EXTS: Record<MediaField, HostedMediaExt[]> = {
  video: ['mp4', 'webm'],
  shareImage: ['png'],
  icon: ['png'],
};

export interface SetListingMediaInput {
  slug: string;
  callerRepoPath: string;
  media: Partial<Record<MediaField, string | null>>;
}

export interface SetListingMediaDeps {
  hostRoot: string;
  checkoutDir?: string;
  fetch?: typeof fetch;
  baseUrl: string;
  retryDelaysMs?: number[];
}

interface PreparedFile {
  field: MediaField;
  abs: string;
  bytes: Buffer;
  sha256: string;
  ext: HostedMediaExt;
  url: string;
}

function expandHome(p: string): string {
  return p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p;
}

/** Returns the prepared upload, or a problem string naming the field. */
function prepareFile(slug: string, field: MediaField, file: string): PreparedFile | string {
  if (typeof file !== 'string' || !file.trim()) return `${field}: file path must be a non-empty string or null`;
  const abs = expandHome(file.trim());
  if (!path.isAbsolute(abs)) return `${field}: ${file} must be an absolute path`;
  const allowed = ALLOWED_EXTS[field];
  const ext = path.extname(abs).slice(1).toLowerCase() as HostedMediaExt;
  if (!allowed.includes(ext)) {
    return `${field}: ${abs} must be a ${allowed.map((e) => `.${e}`).join(' or ')} file`;
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) return `${field}: ${abs} not found`;
  const problem = checkCardMediaFile(field, abs);
  if (problem) return `${field}: ${abs} ${problem}`;
  const bytes = readFileSync(abs);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { field, abs, bytes, sha256, ext, url: hostedMediaPath(slug, sha256, ext) };
}

// Same formatting as server.ts writeRegistry (server.ts starts the stdio server, so it can't be imported).
async function writeRegistry(root: string, projects: RegistryProject[]): Promise<void> {
  const validated = RegistrySchema.parse(projects);
  await writeFile(path.resolve(root, REGISTRY_PATH), JSON.stringify(validated, null, 2) + '\n', 'utf8');
}

// Copies of server.ts pushedLine/localMainLine.
function localMainLine(sync: LocalMainSync): string {
  const detail = sync.detail ? ` — ${sync.detail}` : '';
  if (sync.synced) return `local main: synced${detail}`;
  const exit = sync.exitCode === null ? 'no exit code' : `exit ${sync.exitCode}`;
  return `local main: not synced (${exit})${detail}`;
}
function pushedLine<T>(outcome: PublishOutcome<T> & { ok: true }): string {
  if (!outcome.committed) return 'no changes to commit';
  const pushed = `pushed: ${outcome.sha}`;
  return outcome.localMain ? `${pushed}\n${localMainLine(outcome.localMain)}` : pushed;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * PUTs one file. 404 (the new registry entry not deployed yet) and network errors are retried
 * after each delay; any other non-2xx status fails at once.
 */
async function upload(
  fetchFn: typeof fetch,
  baseUrl: string,
  slug: string,
  file: PreparedFile,
  delays: number[],
): Promise<{ ok: true; line: string } | { ok: false; line: string }> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/listing-media/${slug}/${file.sha256}.${file.ext}`;
  let last = '';
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) {
      console.error(`[set_listing_media] ${file.field}: ${last}; retrying in ${delays[attempt - 1]} ms`);
      await sleep(delays[attempt - 1]);
    }
    try {
      const res = await fetchFn(url, {
        method: 'PUT',
        headers: { 'content-type': CONTENT_TYPES[file.ext] },
        body: new Uint8Array(file.bytes),
      });
      if (res.status === 201) return { ok: true, line: `uploaded: ${url}` };
      if (res.status === 200) return { ok: true, line: `already stored: ${url}` };
      let detail = '';
      try {
        detail = (await res.text()).trim().slice(0, 200);
      } catch {
        /* body unreadable */
      }
      last = `HTTP ${res.status}${detail ? ` ${detail}` : ''}`;
      if (res.status !== 404) break;
    } catch (e: unknown) {
      last = `network error: ${(e as Error).message}`;
    }
  }
  return { ok: false, line: `upload failed: ${url} (${last})` };
}

export async function setListingMedia(
  input: SetListingMediaInput,
  deps: SetListingMediaDeps,
): Promise<{ ok: boolean; text: string }> {
  const { slug, callerRepoPath } = input;
  const fail = (text: string) => ({ ok: false, text });

  // ── Pre-flight, outside the publish lock ──
  const media = input.media ?? {};
  const unknown = Object.keys(media).filter((k) => !FIELDS.includes(k as MediaField));
  if (unknown.length > 0) return fail(`media: unknown field(s) ${unknown.join(', ')}; allowed: ${FIELDS.join(', ')}`);
  const entries = FIELDS.flatMap((f) => (media[f] === undefined ? [] : [[f, media[f]] as const]));
  if (entries.length === 0) return fail(`media: give at least one of ${FIELDS.join(', ')} (a file path, or null to remove)`);

  try {
    const projects = parseRegistry((await readLatestRegistryRaw(deps.hostRoot)).raw);
    const entry = projects.find((p) => p.slug === slug);
    if (!entry) return fail(`slug "${slug}" not found in registry.`);
    assertCallerOwnsSlug(entry, callerRepoPath);
  } catch (e: unknown) {
    return fail((e as Error).message);
  }

  const uploads: PreparedFile[] = [];
  const listingPatch: Partial<Record<MediaField, string | null>> = {};
  const problems: string[] = [];
  for (const [field, value] of entries) {
    if (value === null) {
      listingPatch[field] = null;
      continue;
    }
    const prepared = prepareFile(slug, field, value as string);
    if (typeof prepared === 'string') {
      problems.push(prepared);
      continue;
    }
    uploads.push(prepared);
    listingPatch[field] = prepared.url;
  }
  if (problems.length > 0) return fail(problems.join('\n'));

  // ── One registry commit through the isolated publish checkout ──
  console.error(`[set_listing_media] ${slug}: updating the registry`);
  let outcome: PublishOutcome<{ changed: boolean }>;
  try {
    outcome = await withPublishCheckout<{ changed: boolean }>({ hostRoot: deps.hostRoot, checkoutDir: deps.checkoutDir }, async (root) => {
      const current = parseRegistry(await readFile(path.resolve(root, REGISTRY_PATH), 'utf8'));
      const { next, changed } = updateListingInRegistry(current, slug, callerRepoPath, { listing: listingPatch });
      const message = `listing: media ${slug}`;
      if (!changed) return { result: { changed: false }, paths: [], message };
      await writeRegistry(root, next);
      return { result: { changed: true }, paths: [REGISTRY_PATH], message };
    });
  } catch (e: unknown) {
    return fail((e as Error).message);
  }
  if (!outcome.ok) return fail(`publish checkout failed at stage "${outcome.stage}": ${outcome.error}`);

  const lines: string[] = [];
  for (const [field] of entries) {
    const url = listingPatch[field];
    lines.push(url ? `listing: ${field} -> ${url}` : `listing: ${field} removed`);
  }
  lines.push(pushedLine(outcome));

  // ── Upload the bytes ──
  const fetchFn = deps.fetch ?? fetch;
  const delays = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let allUploaded = true;
  for (const file of uploads) {
    console.error(`[set_listing_media] ${slug}: uploading ${file.field} (${file.bytes.length} bytes)`);
    const res = await upload(fetchFn, deps.baseUrl, slug, file, delays);
    lines.push(res.line);
    if (!res.ok) allUploaded = false;
  }

  if (!allUploaded) {
    lines.push(
      'The registry already points at the new media, but some bytes did not reach bilko.run: run set_listing_media again with the same files to finish the upload.',
    );
    return { ok: false, text: lines.join('\n') };
  }
  lines.push('bilko.run redeploys in about a minute; the card shows the new media after that.');
  return { ok: true, text: lines.join('\n') };
}
