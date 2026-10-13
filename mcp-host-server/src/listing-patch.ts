import { RegistryProjectSchema, type RegistryProject } from './contract/registry.js';

export const PROJECT_OWNED_FIELDS = [
  'name',
  'displayName',
  'tagline',
  'category',
  'tags',
  'status',
  'thumbnail',
  'listing',
] as const;

export const ListingPatchSchema = RegistryProjectSchema.pick({
  name: true,
  displayName: true,
  tagline: true,
  category: true,
  tags: true,
  status: true,
  thumbnail: true,
  listing: true,
})
  .partial()
  .strict();

export type ListingPatch = ReturnType<typeof ListingPatchSchema.parse>;

const DELETABLE_FIELDS = ['displayName', 'tags', 'thumbnail', 'listing'] as const;

/**
 * Apply a sibling project's content patch to its registry entry. Only
 * project-owned fields (plus `url` on external-url entries) are accepted;
 * host-owned fields (slug, host, year, public, launchedAt) are rejected.
 * Returns a new, schema-validated entry; the input is never mutated.
 */
export function applyListingPatch(entry: RegistryProject, patch: unknown): RegistryProject {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('listing patch must be an object');
  }
  const { url, ...rest } = patch as Record<string, unknown>;
  const hasUrl = 'url' in (patch as Record<string, unknown>);

  const allowed = new Set<string>(PROJECT_OWNED_FIELDS);
  const offending = Object.keys(rest).filter((k) => !allowed.has(k));
  if (hasUrl && entry.host.kind !== 'external-url') offending.push('url');
  if (offending.length > 0) {
    throw new Error(
      `fields not owned by the project: ${offending.join(', ')} — visibility and hosting are set by the Bilko owner, not by sibling sessions`
    );
  }

  const deletes = DELETABLE_FIELDS.filter((k) => rest[k] === null);
  const toValidate: Record<string, unknown> = { ...rest };
  for (const k of deletes) delete toValidate[k];

  const parsed = ListingPatchSchema.safeParse(toValidate);
  if (!parsed.success) throw new Error(parsed.error.message);

  const next = structuredClone(entry) as Record<string, unknown>;
  Object.assign(next, structuredClone(parsed.data));
  for (const k of deletes) delete next[k];

  if (hasUrl) {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      throw new Error('url must be an https:// string');
    }
    next.host = { ...(next.host as object), url };
  }

  const result = RegistryProjectSchema.safeParse(next);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
