import { isDeepStrictEqual } from 'node:util';
import { RegistrySchema, type RegistryProject } from './contract/registry.js';
import { assertCallerOwnsSlug } from './ownership.js';
import { applyListingPatch } from './listing-patch.js';

/**
 * Pure core of `update_project_listing`: ownership check + allowlisted patch
 * over a registry array. No fs, no git. Throws on unknown slug, foreign caller,
 * or any patch the allowlist/schema rejects.
 */
export function updateListingInRegistry(
  projects: RegistryProject[],
  slug: string,
  callerRepoPath: string | undefined,
  patch: unknown,
): { next: RegistryProject[]; changed: boolean } {
  const idx = projects.findIndex((p) => p.slug === slug);
  if (idx === -1) throw new Error(`slug "${slug}" not found in registry.`);
  const original = projects[idx];
  assertCallerOwnsSlug(original, callerRepoPath);
  const patched = applyListingPatch(original, patch);
  const next = RegistrySchema.parse(projects.map((p, i) => (i === idx ? patched : p)));
  return { next, changed: !isDeepStrictEqual(original, next[idx]) };
}
