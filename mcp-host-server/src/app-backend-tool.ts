/**
 * Core of the owner-facing `set_app_backend` MCP tool.
 *
 * Sets or clears host.backend on a static-path registry entry: the origin bilko.run forwards
 * /projects/<slug>/api/* to. The forwarder passes users' Authorization headers to that origin,
 * so only the repo bound to the slug (host.localPath) may change it. The write goes through the
 * same isolated publish checkout, commit and push as update_project_listing.
 *
 * Pure of the MCP SDK (server.ts registers the tool). Progress goes to stderr only: stdout is
 * the MCP transport.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RegistrySchema, appBackendOriginProblem, type RegistryProject } from './contract/registry.js';
import { parseRegistry } from './publish-request.js';
import { readLatestRegistryRaw, REGISTRY_PATH } from './registry-source.js';
import { withPublishCheckout, type LocalMainSync, type PublishOutcome } from './publish-checkout.js';
import { assertCallerOwnsSlug } from './ownership.js';

export interface SetBackendResult {
  next: RegistryProject[];
  changed: boolean;
  previous?: string;
  current?: string;
}

/**
 * Returns the registry with host.backend of `slug` set to the normalized `origin`, or removed
 * when `origin` is null. Throws for an unknown slug, a caller that does not own the slug, an
 * external-url entry, or an origin that is not a bare https origin.
 */
export function setBackendInRegistry(
  projects: RegistryProject[],
  slug: string,
  callerRepoPath: string | undefined,
  origin: string | null,
): SetBackendResult {
  const index = projects.findIndex((p) => p.slug === slug);
  if (index === -1) throw new Error(`slug "${slug}" not found in registry.`);
  const entry = projects[index];
  assertCallerOwnsSlug(entry, callerRepoPath);
  if (entry.host.kind !== 'static-path') {
    throw new Error(`slug "${slug}" is ${entry.host.kind}; only static-path slugs can have a backend`);
  }

  let normalized: string | undefined;
  if (origin !== null) {
    const result = appBackendOriginProblem(origin);
    if ('reason' in result) throw new Error(`origin "${origin}": ${result.reason}`);
    normalized = result.origin;
  }

  const previous = entry.host.backend;
  if (previous === normalized) return { next: projects, changed: false, previous, current: normalized };

  const updated = structuredClone(entry);
  if (updated.host.kind !== 'static-path') throw new Error('unreachable');
  if (normalized === undefined) delete updated.host.backend;
  else updated.host.backend = normalized;

  const next = projects.slice();
  next[index] = updated;
  return { next: RegistrySchema.parse(next), changed: true, previous, current: normalized };
}

export interface SetAppBackendInput {
  slug: string;
  callerRepoPath: string;
  origin: string | null;
}

export interface SetAppBackendDeps {
  hostRoot: string;
  checkoutDir?: string;
  baseUrl: string;
  fetch?: typeof fetch;
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

/** Best effort: the slug's appBackends source on the live host today, or undefined. */
async function liveBackendSource(fetchFn: typeof fetch, base: string, slug: string): Promise<string | undefined> {
  try {
    const res = await fetchFn(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { appBackends?: Record<string, unknown> };
    const source = body?.appBackends?.[slug];
    return typeof source === 'string' ? source : undefined;
  } catch {
    return undefined;
  }
}

export async function setAppBackend(
  input: SetAppBackendInput,
  deps: SetAppBackendDeps,
): Promise<{ ok: boolean; text: string }> {
  const { slug, callerRepoPath, origin } = input;
  const fail = (text: string) => ({ ok: false, text });

  // ── Pre-flight, outside the publish lock: ownership, kind and origin ──
  try {
    const projects = parseRegistry((await readLatestRegistryRaw(deps.hostRoot)).raw);
    setBackendInRegistry(projects, slug, callerRepoPath, origin);
  } catch (e: unknown) {
    return fail((e as Error).message);
  }

  console.error(`[set_app_backend] ${slug}: updating the registry`);
  let outcome: PublishOutcome<SetBackendResult>;
  try {
    outcome = await withPublishCheckout<SetBackendResult>({ hostRoot: deps.hostRoot, checkoutDir: deps.checkoutDir }, async (root) => {
      const current = parseRegistry(await readFile(path.resolve(root, REGISTRY_PATH), 'utf8'));
      const result = setBackendInRegistry(current, slug, callerRepoPath, origin);
      const message = result.current ? `registry: set backend for ${slug}` : `registry: clear backend for ${slug}`;
      if (!result.changed) return { result, paths: [], message };
      await writeRegistry(root, result.next);
      return { result, paths: [REGISTRY_PATH], message };
    });
  } catch (e: unknown) {
    return fail((e as Error).message);
  }
  if (!outcome.ok) return fail(`publish checkout failed at stage "${outcome.stage}": ${outcome.error}`);
  if (!outcome.result.changed) return { ok: true, text: `no change: ${slug}` };

  const base = deps.baseUrl.replace(/\/+$/, '');
  const now = outcome.result.current;
  const lines: string[] = now
    ? [`backend: ${slug} -> ${now}`, `forwards /projects/${slug}/api/* -> ${now}/api/*`]
    : [`backend cleared: ${slug}`];
  lines.push(pushedLine(outcome));
  lines.push(
    now
      ? `bilko.run redeploys in about a minute; after that GET ${base}/api/health shows appBackends.${slug} = "registry".`
      : `bilko.run redeploys in about a minute; after that GET ${base}/api/health no longer shows appBackends.${slug} = "registry".`,
  );

  const source = await liveBackendSource(deps.fetch ?? fetch, base, slug);
  if (source === 'env') {
    lines.push(
      `note: appBackends.${slug} is "env" today: APP_BACKENDS on Render overrides the registry for ${slug}, so this change has no effect until that entry is removed from APP_BACKENDS.`,
    );
  }
  return { ok: true, text: lines.join('\n') };
}
