/**
 * Core of the owner-facing `set_app_backend` MCP tool.
 *
 * Sets or clears host.backend on a static-path registry entry: the origin bilko.run forwards
 * /projects/<slug>/api/* to. The forwarder passes users' Authorization headers to that origin,
 * so only the repo bound to the slug (host.localPath) may change it. The write goes through the
 * Bilko-DB registry API with the version it read, so it is live at once; no git command runs.
 *
 * Pure of the MCP SDK (server.ts registers the tool). Progress goes to stderr only: stdout is
 * the MCP transport.
 */

import { RegistrySchema, appBackendOriginProblem, type RegistryProject } from './contract/registry.js';
import { assertCallerOwnsSlug } from './ownership.js';
import { readRegistry, putRegistryProject, type RegistryApiEntry } from './registry-api.js';

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

/** The registry API calls this tool uses; tests replace them. */
export interface RegistryReadWriteApi {
  read: () => Promise<RegistryApiEntry[]>;
  put: (entry: { slug: string } & Record<string, unknown>, ifVersion?: number) => Promise<{ slug: string; version: number }>;
}

export const defaultRegistryApi: RegistryReadWriteApi = { read: readRegistry, put: putRegistryProject };

export interface SetAppBackendDeps {
  /** Kept for existing callers; the API does not use it. */
  hostRoot?: string;
  baseUrl: string;
  fetch?: typeof fetch;
  api?: RegistryReadWriteApi;
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

const isVersionMismatch = (e: unknown) => e instanceof Error && e.message.includes('version_mismatch');

/** One read-modify-write; on version_mismatch re-reads and retries once. */
async function writeBackend(
  api: RegistryReadWriteApi,
  slug: string,
  callerRepoPath: string,
  origin: string | null,
): Promise<SetBackendResult> {
  for (let attempt = 0; ; attempt++) {
    const entries = await api.read();
    const projects = RegistrySchema.parse(entries.map((e) => e.entry));
    const result = setBackendInRegistry(projects, slug, callerRepoPath, origin);
    if (!result.changed) return result;
    const version = entries.find((e) => e.entry.slug === slug)?.version;
    const entry = result.next.find((p) => p.slug === slug)!;
    try {
      await api.put(entry as unknown as { slug: string } & Record<string, unknown>, version);
      return result;
    } catch (e) {
      if (!isVersionMismatch(e)) throw e;
      if (attempt >= 1) throw new Error(`registry changed twice while writing: ${(e as Error).message}. Re-run the tool.`);
    }
  }
}

export async function setAppBackend(
  input: SetAppBackendInput,
  deps: SetAppBackendDeps,
): Promise<{ ok: boolean; text: string }> {
  const { slug, callerRepoPath, origin } = input;
  console.error(`[set_app_backend] ${slug}: updating the registry`);
  let result: SetBackendResult;
  try {
    result = await writeBackend(deps.api ?? defaultRegistryApi, slug, callerRepoPath, origin);
  } catch (e: unknown) {
    return { ok: false, text: (e as Error).message };
  }
  if (!result.changed) return { ok: true, text: `no change: ${slug}` };

  const base = deps.baseUrl.replace(/\/+$/, '');
  const now = result.current;
  const lines: string[] = now
    ? [`backend: ${slug} -> ${now}`, `forwards /projects/${slug}/api/* -> ${now}/api/*`, 'live immediately: the registry is in Bilko-DB.']
    : [`backend cleared: ${slug}`, 'live immediately: the registry is in Bilko-DB.'];

  const source = await liveBackendSource(deps.fetch ?? fetch, base, slug);
  if (source === 'env') {
    lines.push(
      `note: appBackends.${slug} is "env" today: APP_BACKENDS on Render overrides the registry for ${slug}, so this change has no effect until that entry is removed from APP_BACKENDS.`,
    );
  }
  return { ok: true, text: lines.join('\n') };
}
