import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve, sep } from 'path';

/** Card-relevant fields of one registry entry (src/data/standalone-projects.json). */
export interface CardProject {
  slug: string;
  name: string;
  displayName?: string;
  tagline: string;
  category: string;
  /** Registry `listing.icon` / `listing.shareImage`: /projects/<slug>/... paths. */
  icon?: string;
  shareImage?: string;
}

/** Listing keys whose declared file paths get a per-file version. Add new asset keys here. */
export const LISTING_ASSET_KEYS = ['icon', 'shareImage'] as const;

export interface AssetVersions {
  /** slug -> 8-hex card version (the same v= the server puts in og:image). */
  cards: Record<string, string>;
  /** declared asset path (e.g. /projects/<slug>/og.png) -> 8-hex sha1 of its bytes. */
  files: Record<string, string>;
}

export function toCardProject(raw: Record<string, unknown>): CardProject {
  const out: CardProject = {
    slug: String(raw.slug),
    name: String(raw.name),
    tagline: String(raw.tagline ?? ''),
    category: String(raw.category ?? ''),
  };
  if (typeof raw.displayName === 'string' && raw.displayName) out.displayName = raw.displayName;
  const listing = raw.listing as Record<string, unknown> | undefined;
  if (typeof listing?.icon === 'string' && listing.icon) out.icon = listing.icon;
  if (typeof listing?.shareImage === 'string' && listing.shareImage) out.shareImage = listing.shareImage;
  return out;
}

/** Bytes of a declared asset, or undefined when it escapes <staticRoot>/projects/<slug>/ or is unreadable. */
function readAsset(staticRoot: string, slug: string, assetPath: string): Buffer | undefined {
  const base = resolve(staticRoot, 'projects', slug) + sep;
  const file = resolve(staticRoot, assetPath.replace(/^\/+/, ''));
  if (!file.startsWith(base)) return undefined;
  try {
    return readFileSync(file);
  } catch {
    return undefined;
  }
}

/** 8-hex content version for a project's card: copy plus icon/shareImage bytes when readable. */
export function cardVersion(p: CardProject, staticRoot?: string): string {
  const h = createHash('sha1').update(JSON.stringify([p.displayName ?? p.name, p.tagline, p.category]));
  if (staticRoot) {
    for (const asset of [p.icon, p.shareImage]) {
      if (!asset) continue;
      const bytes = readAsset(staticRoot, p.slug, asset);
      if (bytes) h.update(bytes);
    }
  }
  return h.digest('hex').slice(0, 8);
}

/** 8-hex sha1 of one declared asset's bytes; undefined for a missing, unreadable or escaping path. */
export function fileVersion(staticRoot: string, slug: string, assetPath: string): string | undefined {
  const bytes = readAsset(staticRoot, slug, assetPath);
  return bytes ? createHash('sha1').update(bytes).digest('hex').slice(0, 8) : undefined;
}

export function buildAssetVersions(rawRegistry: readonly Record<string, unknown>[], staticRoot: string): AssetVersions {
  const cards: Record<string, string> = {};
  const files: Record<string, string> = {};
  for (const raw of rawRegistry) {
    const p = toCardProject(raw);
    cards[p.slug] = cardVersion(p, staticRoot);
    const listing = raw.listing as Record<string, unknown> | undefined;
    for (const key of LISTING_ASSET_KEYS) {
      const path = listing?.[key];
      if (typeof path !== 'string' || !path) continue;
      const v = fileVersion(staticRoot, p.slug, path);
      if (v) files[path] = v;
    }
  }
  return { cards, files };
}
