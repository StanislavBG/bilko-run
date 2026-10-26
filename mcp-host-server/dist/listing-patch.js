import { ListingSchema, RegistryProjectSchema } from './contract/registry.js';
export const PROJECT_OWNED_FIELDS = [
    'name',
    'displayName',
    'tagline',
    'category',
    'tags',
    'status',
    'thumbnail',
    'listing',
];
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
const DELETABLE_FIELDS = ['displayName', 'tags', 'thumbnail', 'listing'];
const LISTING_FIELDS = new Set(Object.keys(ListingSchema.shape));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/**
 * Apply a sibling project's content patch to its registry entry. Only
 * project-owned fields (plus `url` on external-url entries) are accepted;
 * host-owned fields (slug, host, year, public, launchedAt) are rejected.
 * The patch is a JSON merge patch (RFC 7386): omitted fields keep their value,
 * null deletes an optional field, and `listing` merges key by key, so
 * `{ listing: { audience } }` keeps avoidClaims. A null listing key deletes
 * that key; `listing: null` deletes the whole listing. Arrays replace whole.
 * Returns a new, schema-validated entry; the input is never mutated.
 */
export function applyListingPatch(entry, patch) {
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new Error('listing patch must be an object');
    }
    const { url, ...rest } = patch;
    const hasUrl = 'url' in patch;
    const allowed = new Set(PROJECT_OWNED_FIELDS);
    const offending = Object.keys(rest).filter((k) => !allowed.has(k));
    if (hasUrl && entry.host.kind !== 'external-url')
        offending.push('url');
    if (offending.length > 0) {
        throw new Error(`fields not owned by the project: ${offending.join(', ')} — visibility and hosting are set by the Bilko owner, not by sibling sessions`);
    }
    const deletes = DELETABLE_FIELDS.filter((k) => rest[k] === null);
    const toValidate = { ...rest };
    for (const k of deletes)
        delete toValidate[k];
    let listingDeletes = [];
    const listingPatch = toValidate.listing;
    if (isPlainObject(listingPatch)) {
        listingDeletes = Object.keys(listingPatch).filter((k) => listingPatch[k] === null);
        const unknown = listingDeletes.filter((k) => !LISTING_FIELDS.has(k));
        if (unknown.length > 0)
            throw new Error(`unknown listing fields: ${unknown.join(', ')}`);
        toValidate.listing = Object.fromEntries(Object.entries(listingPatch).filter(([, v]) => v !== null));
    }
    const parsed = ListingPatchSchema.safeParse(toValidate);
    if (!parsed.success)
        throw new Error(parsed.error.message);
    const { listing, ...fields } = structuredClone(parsed.data);
    const next = structuredClone(entry);
    Object.assign(next, fields);
    for (const k of deletes)
        delete next[k];
    if (listing !== undefined) {
        const merged = { ...next.listing, ...listing };
        for (const k of listingDeletes)
            delete merged[k];
        if (Object.keys(merged).length > 0)
            next.listing = merged;
        else
            delete next.listing;
    }
    if (hasUrl) {
        if (typeof url !== 'string' || !url.startsWith('https://')) {
            throw new Error('url must be an https:// string');
        }
        next.host = { ...next.host, url };
    }
    const result = RegistryProjectSchema.safeParse(next);
    if (!result.success)
        throw new Error(result.error.message);
    return result.data;
}
/**
 * Project-owned fields set on `before` and gone from `after`, e.g.
 * `['tags', 'listing.avoidClaims']`, so a write can say what it deleted.
 */
export function removedFields(before, after) {
    const removed = DELETABLE_FIELDS.filter((k) => k !== 'listing' && before[k] !== undefined && after[k] === undefined);
    for (const k of Object.keys(before.listing ?? {})) {
        if (after.listing?.[k] === undefined)
            removed.push(`listing.${k}`);
    }
    return removed;
}
