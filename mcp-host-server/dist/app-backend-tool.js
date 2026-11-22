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
import { RegistrySchema, appBackendOriginProblem } from './contract/registry.js';
import { parseRegistry } from './publish-request.js';
import { readLatestRegistryRaw, REGISTRY_PATH } from './registry-source.js';
import { withPublishCheckout } from './publish-checkout.js';
import { assertCallerOwnsSlug } from './ownership.js';
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
// Same formatting as server.ts writeRegistry (server.ts starts the stdio server, so it can't be imported).
async function writeRegistry(root, projects) {
    const validated = RegistrySchema.parse(projects);
    await writeFile(path.resolve(root, REGISTRY_PATH), JSON.stringify(validated, null, 2) + '\n', 'utf8');
}
// Copies of server.ts pushedLine/localMainLine.
function localMainLine(sync) {
    const detail = sync.detail ? ` — ${sync.detail}` : '';
    if (sync.synced)
        return `local main: synced${detail}`;
    const exit = sync.exitCode === null ? 'no exit code' : `exit ${sync.exitCode}`;
    return `local main: not synced (${exit})${detail}`;
}
function pushedLine(outcome) {
    if (!outcome.committed)
        return 'no changes to commit';
    const pushed = `pushed: ${outcome.sha}`;
    return outcome.localMain ? `${pushed}\n${localMainLine(outcome.localMain)}` : pushed;
}
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
export async function setAppBackend(input, deps) {
    const { slug, callerRepoPath, origin } = input;
    const fail = (text) => ({ ok: false, text });
    // ── Pre-flight, outside the publish lock: ownership, kind and origin ──
    try {
        const projects = parseRegistry((await readLatestRegistryRaw(deps.hostRoot)).raw);
        setBackendInRegistry(projects, slug, callerRepoPath, origin);
    }
    catch (e) {
        return fail(e.message);
    }
    console.error(`[set_app_backend] ${slug}: updating the registry`);
    let outcome;
    try {
        outcome = await withPublishCheckout({ hostRoot: deps.hostRoot, checkoutDir: deps.checkoutDir }, async (root) => {
            const current = parseRegistry(await readFile(path.resolve(root, REGISTRY_PATH), 'utf8'));
            const result = setBackendInRegistry(current, slug, callerRepoPath, origin);
            const message = result.current ? `registry: set backend for ${slug}` : `registry: clear backend for ${slug}`;
            if (!result.changed)
                return { result, paths: [], message };
            await writeRegistry(root, result.next);
            return { result, paths: [REGISTRY_PATH], message };
        });
    }
    catch (e) {
        return fail(e.message);
    }
    if (!outcome.ok)
        return fail(`publish checkout failed at stage "${outcome.stage}": ${outcome.error}`);
    if (!outcome.result.changed)
        return { ok: true, text: `no change: ${slug}` };
    const base = deps.baseUrl.replace(/\/+$/, '');
    const now = outcome.result.current;
    const lines = now
        ? [`backend: ${slug} -> ${now}`, `forwards /projects/${slug}/api/* -> ${now}/api/*`]
        : [`backend cleared: ${slug}`];
    lines.push(pushedLine(outcome));
    lines.push(now
        ? `bilko.run redeploys in about a minute; after that GET ${base}/api/health shows appBackends.${slug} = "registry".`
        : `bilko.run redeploys in about a minute; after that GET ${base}/api/health no longer shows appBackends.${slug} = "registry".`);
    const source = await liveBackendSource(deps.fetch ?? fetch, base, slug);
    if (source === 'env') {
        lines.push(`note: appBackends.${slug} is "env" today: APP_BACKENDS on Render overrides the registry for ${slug}, so this change has no effect until that entry is removed from APP_BACKENDS.`);
    }
    return { ok: true, text: lines.join('\n') };
}
