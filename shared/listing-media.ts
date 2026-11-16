/**
 * Hosted card media, shared by the bilko.run server and the site bundle.
 *
 * Owner-uploaded card media lives in the bilko.run database and is served at
 * /projects/<slug>/_media/<sha256>.<ext>. The server cannot import mcp-host-server/src, so the
 * path regex (mcp-host-server/src/contract/listing-media.ts) and the per-file checks
 * (checkCardMediaFile in mcp-host-server/src/gates/share-assets.ts) are mirrored here.
 * tests/listing-media-shared.test.ts keeps the two copies identical: change both together.
 */
export type HostedMediaExt = 'png' | 'mp4' | 'webm';
export type CardMediaField = 'icon' | 'shareImage' | 'video';

export interface HostedMediaRef {
  slug: string;
  sha256: string;
  ext: HostedMediaExt;
}

export const HOSTED_MEDIA_RE = /^\/projects\/([a-z0-9-]+)\/_media\/([0-9a-f]{64})\.(png|mp4|webm)$/;

export function parseHostedMediaPath(path: string): HostedMediaRef | undefined {
  const m = HOSTED_MEDIA_RE.exec(path);
  if (!m) return undefined;
  return { slug: m[1], sha256: m[2], ext: m[3] as HostedMediaExt };
}

export function isHostedMediaPath(path: string): boolean {
  return HOSTED_MEDIA_RE.test(path);
}

/** URL of the JSON metadata stored next to a hosted media file. */
export function hostedMediaMetaUrl(path: string): string {
  return `${path}.json`;
}

export function mediaContentType(ext: HostedMediaExt): 'image/png' | 'video/mp4' | 'video/webm' {
  if (ext === 'png') return 'image/png';
  return ext === 'mp4' ? 'video/mp4' : 'video/webm';
}

/** Same limits as the MCP share-assets gate. */
export const CARD_MEDIA_LIMITS = {
  video: { maxBytes: 8 * 1024 * 1024 },
  shareImage: { width: 1200, height: 630, maxBytes: 5 * 1024 * 1024 },
  icon: { min: 128, max: 1024, maxBytes: 512 * 1024 },
} as const;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBM_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3];

function startsWith(buf: Uint8Array, sig: readonly number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

function readUInt32BE(buf: Uint8Array, at: number): number {
  return ((buf[at] << 24) >>> 0) + (buf[at + 1] << 16) + (buf[at + 2] << 8) + buf[at + 3];
}

function checkVideo(ext: 'mp4' | 'webm', buf: Buffer): string | undefined {
  if (ext === 'webm') {
    if (!startsWith(buf, WEBM_SIGNATURE)) return 'not a WebM';
  } else if (buf.length < 8 || String.fromCharCode(buf[4], buf[5], buf[6], buf[7]) !== 'ftyp') {
    return 'not an MP4';
  }
  if (buf.length > CARD_MEDIA_LIMITS.video.maxBytes) return `is ${buf.length} bytes, over the 8 MB limit`;
  return undefined;
}

/**
 * Card media checks (extension, format, dimensions, size) on in-memory bytes.
 * Returns a problem description, or undefined when the bytes are valid for the field.
 * Messages match checkCardMediaFile exactly.
 */
export function checkCardMediaBytes(field: CardMediaField, ext: HostedMediaExt, buf: Buffer): string | undefined {
  if (field === 'video') {
    if (ext === 'png') return `.${ext} does not fit video, must be .mp4 or .webm`;
    return checkVideo(ext, buf);
  }
  if (ext !== 'png') return `.${ext} does not fit ${field}, must be .png`;

  if (buf.length < 24 || !startsWith(buf, PNG_SIGNATURE)) return 'not a PNG';
  const width = readUInt32BE(buf, 16);
  const height = readUInt32BE(buf, 20);

  if (field === 'shareImage') {
    const s = CARD_MEDIA_LIMITS.shareImage;
    if (width !== s.width || height !== s.height) return `is ${width}x${height}, must be exactly ${s.width}x${s.height}`;
    if (buf.length > s.maxBytes) return `is ${buf.length} bytes, over the 5 MB limit`;
  } else {
    const s = CARD_MEDIA_LIMITS.icon;
    if (width !== height) return `is ${width}x${height}, must be square`;
    if (width < s.min || width > s.max) return `is ${width}x${height}, must be ${s.min}-${s.max} px`;
    if (buf.length > s.maxBytes) return `is ${buf.length} bytes, over the 512 KB limit`;
  }
  return undefined;
}
