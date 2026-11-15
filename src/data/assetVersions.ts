/**
 * Client-side asset version lookup for cache-busting script-inserted <img>/<video> URLs.
 *
 * The map is baked at build time (vite.config.ts / vitest.config.ts `define`) from
 * shared/asset-versions.ts over the bytes in public/, so a share-image publish (which
 * rebuilds on Render) yields a new URL and returning visitors refetch it. The server
 * compiles src/data without the define and gets an empty map.
 */
import type { AssetVersions } from '../../shared/asset-versions.js';

export type { AssetVersions };

declare const __ASSET_VERSIONS__: AssetVersions | undefined;

const EMPTY: AssetVersions = { cards: {}, files: {} };
const BAKED: AssetVersions = typeof __ASSET_VERSIONS__ === 'undefined' ? EMPTY : (__ASSET_VERSIONS__ ?? EMPTY);

/** /og/<slug>.png?v=<card version>, or /og/<slug>.png when no version is known. */
export function cardImageUrl(slug: string, versions: AssetVersions = BAKED): string {
  const v = versions.cards[slug];
  return v ? `/og/${slug}.png?v=${v}` : `/og/${slug}.png`;
}

/** <path>?v=<file version> for a declared listing asset, or <path> when unknown. */
export function assetUrl(path: string, versions: AssetVersions = BAKED): string {
  const v = versions.files[path];
  return v ? `${path}?v=${v}` : path;
}
