import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { extname, resolve, sep } from 'path';
import { isHostedMediaPath } from './listing-media.js';
import { hasAudioTrack } from './video-audio.js';

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
export const LISTING_ASSET_KEYS = ['icon', 'shareImage', 'video'] as const;

export interface AssetVersions {
  /** slug -> 8-hex card version (the same v= the server puts in og:image). */
  cards: Record<string, string>;
  /** declared asset path (e.g. /projects/<slug>/og.png) -> 8-hex sha1 of its bytes. */
  files: Record<string, string>;
  /** Sorted declared listing.video paths whose bytes carry an audio track (shared/video-audio.ts). */
  audio: string[];
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

/** Bump when server/og-image.ts output changes, so og:image ?v= and the /projects thumbnail URL change. */
export const CARD_RENDER_REV = 2;

/**
 * 8-hex content version for a project's card: copy plus icon/shareImage bytes when readable.
 * A hosted /projects/<slug>/_media/<sha256>.<ext> path is not in the build; its path string
 * already carries the content hash, so the path itself is hashed instead of bytes.
 */
export function cardVersion(p: CardProject, staticRoot?: string): string {
  const h = createHash('sha1').update(JSON.stringify([CARD_RENDER_REV, p.displayName ?? p.name, p.tagline, p.category]));
  for (const asset of [p.icon, p.shareImage]) {
    if (!asset) continue;
    if (isHostedMediaPath(asset)) {
      h.update(asset);
      continue;
    }
    if (staticRoot) {
      const bytes = readAsset(staticRoot, p.slug, asset);
      if (bytes) h.update(bytes);
    }
  }
  return h.digest('hex').slice(0, 8);
}

/** 8-hex sha1 of one declared asset's bytes; undefined for a missing, unreadable or escaping path. */
export function fileVersion(staticRoot: string, slug: string, assetPath: string): string | undefined {
  const bytes = readAsset(staticRoot, slug, assetPath);
  return bytes ? sha1Hex8(bytes) : undefined;
}

function sha1Hex8(bytes: Buffer): string {
  return createHash('sha1').update(bytes).digest('hex').slice(0, 8);
}

export function buildAssetVersions(rawRegistry: readonly Record<string, unknown>[], staticRoot: string): AssetVersions {
  const cards: Record<string, string> = {};
  const files: Record<string, string> = {};
  const audio = new Set<string>();
  for (const raw of rawRegistry) {
    const p = toCardProject(raw);
    cards[p.slug] = cardVersion(p, staticRoot);
    const listing = raw.listing as Record<string, unknown> | undefined;
    for (const key of LISTING_ASSET_KEYS) {
      const path = listing?.[key];
      if (typeof path !== 'string' || !path) continue;
      // Hosted media bytes live in the database, not the build; the path already carries its sha256.
      if (isHostedMediaPath(path)) continue;
      if (key === 'video') {
        // One read serves both the version hash and the audio sniff.
        const bytes = readAsset(staticRoot, p.slug, path);
        if (!bytes) continue;
        files[path] = sha1Hex8(bytes);
        if (hasAudioTrack(bytes, extname(path))) audio.add(path);
        continue;
      }
      const v = fileVersion(staticRoot, p.slug, path);
      if (v) files[path] = v;
    }
  }
  return { cards, files, audio: [...audio].sort() };
}
