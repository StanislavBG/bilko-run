import { isDeepStrictEqual } from 'node:util';
import { RegistrySchema } from './contract/registry.js';
import { assertCallerOwnsSlug } from './ownership.js';
import { applyListingPatch } from './listing-patch.js';
import { buildStaticEntry } from './publish-request.js';
import { canonicalPath } from './ownership.js';
import os from 'node:os';
import path from 'node:path';
/**
 * Pure core of `update_project_listing`: ownership check + allowlisted patch
 * over a registry array. No fs, no git. Throws on unknown slug, foreign caller,
 * or any patch the allowlist/schema rejects.
 */
export function updateListingInRegistry(projects, slug, callerRepoPath, patch) {
    const idx = projects.findIndex((p) => p.slug === slug);
    if (idx === -1)
        throw new Error(`slug "${slug}" not found in registry.`);
    const original = projects[idx];
    assertCallerOwnsSlug(original, callerRepoPath);
    const patched = applyListingPatch(original, patch);
    const next = RegistrySchema.parse(projects.map((p, i) => (i === idx ? patched : p)));
    return { next, changed: !isDeepStrictEqual(original, next[idx]) };
}
function collapseHome(p) {
    const home = os.homedir();
    const abs = path.resolve(p);
    if (abs === home)
        return '~';
    return abs.startsWith(home + path.sep) ? `~${abs.slice(home.length)}` : abs;
}
/**
 * Pure core of `register_static_project`: builds a schema-validated entry bound
 * to the caller's repo. Never sets `public` (admin-only until the Bilko owner lists it).
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
    const { callerRepoPath, ...rest } = input;
    return buildStaticEntry({ ...rest, localPath: collapseHome(callerRepoPath) });
}
