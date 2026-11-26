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
import { RegistrySchema, appBackendOriginProblem } from './contract/registry.js';
import { assertCallerOwnsSlug } from './ownership.js';
import { readRegistry, putRegistryProject } from './registry-api.js';
/**
 * Returns the registry with host.backend of `slug` set to the normalized `origin`, or removed
 * when `origin` is null. Throws for an unknown slug, a caller that does not own the slug, an
 * external-url entry, or an origin that is not a bare https origin.
 */
export function setBackendInRegistry(projects, slug, callerRepoPath, origin) {
    const index = projects.findIndex((p) => p.slug === slug);
    if (index === -1)
        throw new Error(`slug "${slug}" not found in registry.`);
    const entry = projects[index];
    assertCallerOwnsSlug(entry, callerRepoPath);
    if (entry.host.kind !== 'static-path') {
        throw new Error(`slug "${slug}" is ${entry.host.kind}; only static-path slugs can have a backend`);
    }
    let normalized;
    if (origin !== null) {
        const result = appBackendOriginProblem(origin);
        if ('reason' in result)
            throw new Error(`origin "${origin}": ${result.reason}`);
        normalized = result.origin;
    }
    const previous = entry.host.backend;
    if (previous === normalized)
        return { next: projects, changed: false, previous, current: normalized };
    const updated = structuredClone(entry);
    if (updated.host.kind !== 'static-path')
        throw new Error('unreachable');
    if (normalized === undefined)
        delete updated.host.backend;
    else
        updated.host.backend = normalized;
    const next = projects.slice();
    next[index] = updated;
    return { next: RegistrySchema.parse(next), changed: true, previous, current: normalized };
}
export const defaultRegistryApi = { read: readRegistry, put: putRegistryProject };
/** Best effort: the slug's appBackends source on the live host today, or undefined. */
async function liveBackendSource(fetchFn, base, slug) {
    try {
        const res = await fetchFn(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok)
            return undefined;
        const body = (await res.json());
        const source = body?.appBackends?.[slug];
        return typeof source === 'string' ? source : undefined;
    }
    catch {
        return undefined;
    }
}
const isVersionMismatch = (e) => e instanceof Error && e.message.includes('version_mismatch');
/** One read-modify-write; on version_mismatch re-reads and retries once. */
async function writeBackend(api, slug, callerRepoPath, origin) {
    for (let attempt = 0;; attempt++) {
        const entries = await api.read();
        const projects = RegistrySchema.parse(entries.map((e) => e.entry));
        const result = setBackendInRegistry(projects, slug, callerRepoPath, origin);
        if (!result.changed)
            return result;
        const version = entries.find((e) => e.entry.slug === slug)?.version;
        const entry = result.next.find((p) => p.slug === slug);
        try {
            await api.put(entry, version);
            return result;
        }
        catch (e) {
            if (!isVersionMismatch(e))
                throw e;
            if (attempt >= 1)
                throw new Error(`registry changed twice while writing: ${e.message}. Re-run the tool.`);
        }
    }
}
export async function setAppBackend(input, deps) {
    const { slug, callerRepoPath, origin } = input;
    console.error(`[set_app_backend] ${slug}: updating the registry`);
    let result;
    try {
        result = await writeBackend(deps.api ?? defaultRegistryApi, slug, callerRepoPath, origin);
    }
    catch (e) {
        return { ok: false, text: e.message };
    }
    if (!result.changed)
        return { ok: true, text: `no change: ${slug}` };
    const base = deps.baseUrl.replace(/\/+$/, '');
    const now = result.current;
    const lines = now
        ? [`backend: ${slug} -> ${now}`, `forwards /projects/${slug}/api/* -> ${now}/api/*`, 'live immediately: the registry is in Bilko-DB.']
        : [`backend cleared: ${slug}`, 'live immediately: the registry is in Bilko-DB.'];
    const source = await liveBackendSource(deps.fetch ?? fetch, base, slug);
    if (source === 'env') {
        lines.push(`note: appBackends.${slug} is "env" today: APP_BACKENDS on Render overrides the registry for ${slug}, so this change has no effect until that entry is removed from APP_BACKENDS.`);
    }
    return { ok: true, text: lines.join('\n') };
}
