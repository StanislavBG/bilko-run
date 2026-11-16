/**
 * Hosted card media: bytes the owner uploads live in the bilko.run database, not in a bundle,
 * and are served at /projects/<slug>/_media/<sha256>.<ext>. This form already matches the
 * older ProjectAssetPathSchema / ProjectVideoPathSchema regexes, so older bilko-host processes
 * keep parsing a registry that uses it.
 */
export type HostedMediaExt = 'png' | 'mp4' | 'webm';

export interface HostedMediaRef {
  slug: string;
  sha256: string;
  ext: HostedMediaExt;
}

export const HOSTED_MEDIA_RE = /^\/projects\/([a-z0-9-]+)\/_media\/([0-9a-f]{64})\.(png|mp4|webm)$/;

export function hostedMediaPath(slug: string, sha256: string, ext: HostedMediaExt): string {
  return `/projects/${slug}/_media/${sha256}.${ext}`;
}

export function parseHostedMediaPath(path: string): HostedMediaRef | undefined {
  const m = HOSTED_MEDIA_RE.exec(path);
  if (!m) return undefined;
  return { slug: m[1], sha256: m[2], ext: m[3] as HostedMediaExt };
}

export function isHostedMediaPath(path: string): boolean {
  return HOSTED_MEDIA_RE.test(path);
}
