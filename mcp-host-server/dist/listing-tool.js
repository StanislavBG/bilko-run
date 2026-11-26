import { isDeepStrictEqual } from 'node:util';
import { RegistrySchema } from './contract/registry.js';
import { assertCallerOwnsSlug, canonicalPath } from './ownership.js';
import { applyListingPatch, removedFields } from './listing-patch.js';
import { buildStaticEntry, buildExternalEntry } from './publish-request.js';
import os from 'node:os';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { readRegistry as apiReadRegistry, putRegistryProject, deleteRegistryProject, withVersionRetry, } from './registry-api.js';
/**
 * Pure core of `update_project_listing`: ownership check + allowlisted patch
 * over a registry array. No fs, no git. Throws on unknown slug, foreign caller,
 * or any patch the allowlist/schema rejects. `removed` names the fields the
 * patch deleted (only an explicit null can delete one).
 */
export function updateListingInRegistry(projects, slug, callerRepoPath, patch) {
    const idx = projects.findIndex((p) => p.slug === slug);
    if (idx === -1)
        throw new Error(`slug "${slug}" not found in registry.`);
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
export function assertPublishOwner(projects, slug, sourceRepoPath) {
    const entry = projects.find((p) => p.slug === slug);
    if (!entry)
        throw new Error(`slug "${slug}" is not registered. Call register_static_project first.`);
    assertCallerOwnsSlug(entry, sourceRepoPath);
    if (entry.host.kind !== 'static-path') {
        throw new Error(`slug "${slug}" is an ${entry.host.kind} entry; there is no bundle to publish. Edit its card with update_project_listing; upload card media with set_listing_media.`);
    }
}
function collapseHome(p) {
    const home = os.homedir();
    const abs = path.resolve(p);
    if (abs === home)
        return '~';
    return abs.startsWith(home + path.sep) ? `~${abs.slice(home.length)}` : abs;
}
/**
 * Pure core of `register_static_project` and `register_external_project`: builds
 * a schema-validated entry bound to the caller's repo — external-url when `url`
 * is given (https:// only), static-path otherwise. Never sets `public`
 * (admin-only until the Bilko owner lists it).
 */
export function buildRegistration(projects, input) {
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
export function readListingFile(sourceRepoPath) {
    const file = path.join(sourceRepoPath, LISTING_FILE);
    if (!existsSync(file))
        return undefined;
    const size = statSync(file).size;
    if (size > LISTING_MAX_BYTES) {
        throw new Error(`${LISTING_FILE}: file is ${size} bytes, over the ${LISTING_MAX_BYTES}-byte limit`);
    }
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    }
    catch (e) {
        throw new Error(`${LISTING_FILE}: invalid JSON (${e.message})`);
    }
}
const defaultApi = { read: apiReadRegistry, put: putRegistryProject, del: deleteRegistryProject };
async function readProjects(api) {
    const entries = await api.read();
    const versions = new Map();
    for (const e of entries)
        versions.set(String(e.entry.slug), e.version);
    return { projects: RegistrySchema.parse(entries.map((e) => e.entry)), versions };
}
/** register_static_project / register_external_project: a new slug must not exist yet (ifVersion 0). */
export function registerProjectLive(input, api = defaultApi) {
    return withVersionRetry(async () => {
        const { projects } = await readProjects(api);
        const entry = buildRegistration(projects, input);
        return api.put(entry, 0);
    });
}
/** update_project_listing: writes with the version it read; an unchanged patch writes nothing. */
export function updateListingLive(slug, callerRepoPath, patch, api = defaultApi) {
    return withVersionRetry(async () => {
        const { projects, versions } = await readProjects(api);
        const { next, changed, removed } = updateListingInRegistry(projects, slug, callerRepoPath, patch);
        if (!changed)
            return { changed: false, removed };
        const entry = next.find((p) => p.slug === slug);
        await api.put(entry, versions.get(slug));
        return { changed: true, removed };
    });
}
/**
 * publish_static_project: checks registration, kind and ownership against the live entries and
 * validates bilko.listing.json before any bytes are copied. Throws `bilko.listing.json: <msg>` for a bad file.
 */
export function planPublishListing(projects, slug, sourceRepoPath, patch) {
    assertPublishOwner(projects, slug, sourceRepoPath);
    if (patch === undefined)
        return { hasFile: false, changed: false };
    try {
        return { hasFile: true, changed: updateListingInRegistry(projects, slug, sourceRepoPath, patch).changed };
    }
    catch (e) {
        throw new Error(`${LISTING_FILE}: ${e.message}`);
    }
}
/** unregister_project: ownership checked against the entry just read, delete with its version. */
export function unregisterProjectLive(slug, callerRepoPath, api = defaultApi) {
    return withVersionRetry(async () => {
        const { projects, versions } = await readProjects(api);
        const existing = projects.find((p) => p.slug === slug);
        if (!existing)
            throw new Error(`slug "${slug}" not found in registry.`);
        assertCallerOwnsSlug(existing, callerRepoPath);
        await api.del(slug, versions.get(slug));
    });
}
