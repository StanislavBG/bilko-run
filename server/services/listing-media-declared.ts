// Decides whether an owner-uploaded card media file may be stored: only when a
// registry entry's listing points at exactly /projects/<slug>/_media/<file>.
// The registry snapshot (server/registry-runtime.ts) is the only source: a
// listing change written through the registry API refreshes it, so bytes can
// land as soon as the declaration does, with no deploy and no GitHub lookup.
import type { CardMediaField } from '../../shared/listing-media.js';
import { getRegistrySnapshot } from '../registry-runtime.js';

export interface ListingMediaDeclaredDeps {
  /** Registry entries to check instead of the live snapshot (tests). */
  registry?: readonly unknown[];
}

const SLUG_RE = /^[a-z0-9-]+$/;
const FILE_RE = /^[0-9a-f]{64}\.(png|mp4|webm)$/;
const FIELDS: readonly CardMediaField[] = ['icon', 'shareImage', 'video'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fieldIn(entries: readonly unknown[], slug: string, path: string): CardMediaField | undefined {
  const entry = entries.find((e) => isRecord(e) && e.slug === slug);
  const listing = isRecord(entry) ? entry.listing : undefined;
  if (!isRecord(listing)) return undefined;
  return FIELDS.find((f) => listing[f] === path);
}

export async function isListingMediaDeclared(
  slug: string,
  file: string,
  deps: ListingMediaDeclaredDeps = {},
): Promise<CardMediaField | undefined> {
  if (!SLUG_RE.test(slug) || !FILE_RE.test(file)) return undefined;
  return fieldIn(deps.registry ?? getRegistrySnapshot(), slug, `/projects/${slug}/_media/${file}`);
}
