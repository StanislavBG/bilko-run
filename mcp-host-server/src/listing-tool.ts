import { isDeepStrictEqual } from 'node:util';
import { RegistrySchema, type RegistryProject, type ProjectStatus } from './contract/registry.js';
import { assertCallerOwnsSlug, canonicalPath } from './ownership.js';
import { applyListingPatch, removedFields } from './listing-patch.js';
import { buildStaticEntry, buildExternalEntry } from './publish-request.js';
import os from 'node:os';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Pure core of `update_project_listing`: ownership check + allowlisted patch
 * over a registry array. No fs, no git. Throws on unknown slug, foreign caller,
 * or any patch the allowlist/schema rejects. `removed` names the fields the
 * patch deleted (only an explicit null can delete one).
 */
export function updateListingInRegistry(
  projects: RegistryProject[],
  slug: string,
  callerRepoPath: string | undefined,
  patch: unknown,
): { next: RegistryProject[]; changed: boolean; removed: string[] } {
  const idx = projects.findIndex((p) => p.slug === slug);
  if (idx === -1) throw new Error(`slug "${slug}" not found in registry.`);
  const original = projects[idx];
  assertCallerOwnsSlug(original, callerRepoPath);
  const patched = applyListingPatch(original, patch);
  const next = RegistrySchema.parse(projects.map((p, i) => (i === idx ? patched : p)));
  return { next, changed: !isDeepStrictEqual(original, next[idx]), removed: removedFields(original, next[idx]) };
}

/**
 * Cheap ownership check run BEFORE publish gates (which execute commands in
 * the caller's sourceRepoPath). The check inside the publish checkout stays
 * authoritative.
 */
export function assertPublishOwner(
  projects: RegistryProject[],
  slug: string,
  sourceRepoPath: string | undefined,
): void {
  const entry = projects.find((p) => p.slug === slug);
  if (!entry) throw new Error(`slug "${slug}" is not registered. Call register_static_project first.`);
  assertCallerOwnsSlug(entry, sourceRepoPath);
  if (entry.host.kind !== 'static-path') {
    throw new Error(`slug "${slug}" is an ${entry.host.kind} entry; there is no bundle to publish. Edit its card with update_project_listing.`);
  }
}

function collapseHome(p: string): string {
  const home = os.homedir();
  const abs = path.resolve(p);
  if (abs === home) return '~';
  return abs.startsWith(home + path.sep) ? `~${abs.slice(home.length)}` : abs;
}

/**
 * Pure core of `register_static_project` and `register_external_project`: builds
 * a schema-validated entry bound to the caller's repo — external-url when `url`
 * is given (https:// only), static-path otherwise. Never sets `public`
 * (admin-only until the Bilko owner lists it).
 */
export function buildRegistration(
  projects: RegistryProject[],
  input: {
    slug: string;
    name: string;
    tagline: string;
    category: string;
    status: ProjectStatus;
    year: number;
    sourceRepo?: string;
    callerRepoPath: string;
    tags?: string[];
    displayName?: string;
    url?: string;
  },
): RegistryProject {
  if (!input.callerRepoPath || !path.isAbsolute(input.callerRepoPath.replace(/^~(?=\/|$)/, os.homedir()))) {
    throw new Error('callerRepoPath must be an absolute path');
  }
  if (projects.some((p) => p.slug === input.slug)) {
    throw new Error(`slug "${input.slug}" already registered. Use unregister_project first if you want to replace it.`);
  }
  const callerCanon = canonicalPath(input.callerRepoPath);
  const bound = projects.find((p) => p.host.localPath && canonicalPath(p.host.localPath) === callerCanon);
  if (bound) {
    throw new Error(`repo ${input.callerRepoPath} is already bound to slug "${bound.slug}"`);
  }
  const { callerRepoPath, url, ...rest } = input;
  const localPath = collapseHome(callerRepoPath);
  return url === undefined ? buildStaticEntry({ ...rest, localPath }) : buildExternalEntry({ ...rest, localPath, url });
}

const LISTING_FILE = 'bilko.listing.json';
const LISTING_MAX_BYTES = 16384;

/**
 * Reads `<sourceRepoPath>/bilko.listing.json` (an `update_project_listing` patch).
 * Returns undefined when absent; throws `bilko.listing.json: <reason>` when
 * unreadable, over 16 KB, or not valid JSON.
 */
export function readListingFile(sourceRepoPath: string): unknown | undefined {
  const file = path.join(sourceRepoPath, LISTING_FILE);
  if (!existsSync(file)) return undefined;
  const size = statSync(file).size;
  if (size > LISTING_MAX_BYTES) {
    throw new Error(`${LISTING_FILE}: file is ${size} bytes, over the ${LISTING_MAX_BYTES}-byte limit`);
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${LISTING_FILE}: invalid JSON (${(e as Error).message})`);
  }
}
