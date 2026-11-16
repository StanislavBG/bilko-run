// Serves owner-uploaded card media from the database at
// /projects/<slug>/_media/<sha256>.<ext>, plus <file>.json metadata that tells the
// /projects card whether a video has sound. Names are content hashes, so every
// hit is immutable for a year. Single byte ranges are supported because Safari
// will not play an MP4 without them. Registered before @fastify/static so the
// specific route wins over the static bundle and the SPA fallback.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ifNoneMatch } from '../og-routes.js';
import {
  getListingMedia, getListingMediaMeta,
  type ListingMedia, type ListingMediaMeta,
} from '../services/listing-media.js';

export interface ListingMediaRouteDeps {
  getMedia?: (slug: string, file: string) => Promise<ListingMedia | null>;
  getMeta?: (slug: string, file: string) => Promise<ListingMediaMeta | null>;
}

const MEDIA_FILE_RE = /^([0-9a-f]{64})\.(png|mp4|webm)(\.json)?$/;
const IMMUTABLE = 'public, max-age=31536000, immutable';

type MediaRoute = { Params: { slug: string; file: string } };

export type RangeResult = { start: number; end: number } | 'full' | 'unsatisfiable';

/**
 * Parse a Range header against a body of `total` bytes. Only one range is
 * honoured; a multi-range or malformed header answers the full body.
 */
export function parseRange(header: string | undefined, total: number): RangeResult {
  if (!header) return 'full';
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return 'full';
  const [, a, b] = m;
  if (a === '' && b === '') return 'full';
  if (a === '') {
    const n = Number(b);
    if (n === 0 || total === 0) return 'unsatisfiable';
    return { start: Math.max(0, total - n), end: total - 1 };
  }
  const start = Number(a);
  const end = b === '' ? total - 1 : Math.min(Number(b), total - 1);
  if (start >= total || start > end) return 'unsatisfiable';
  return { start, end };
}

function missing(reply: FastifyReply) {
  return reply
    .code(404)
    .header('cache-control', 'no-store')
    .header('x-bilko-media', 'missing')
    .send({ error: 'Not found' });
}

export function registerListingMediaRoutes(app: FastifyInstance, deps: ListingMediaRouteDeps = {}): void {
  const getMedia = deps.getMedia ?? getListingMedia;
  const getMeta = deps.getMeta ?? getListingMediaMeta;

  const handler = async (req: FastifyRequest<MediaRoute>, reply: FastifyReply) => {
    const { slug, file } = req.params;
    const m = MEDIA_FILE_RE.exec(file);
    if (!m) return missing(reply);
    const [, hash, ext, json] = m;
    const head = req.method === 'HEAD';

    if (json) {
      const meta = await getMeta(slug, `${hash}.${ext}`);
      if (!meta) return missing(reply);
      return reply
        .header('cache-control', IMMUTABLE)
        .type('application/json; charset=utf-8')
        .send({ bytes: meta.bytes, contentType: meta.contentType, audio: meta.hasAudio });
    }

    const media = await getMedia(slug, file);
    if (!media) return missing(reply);

    const etag = `"${hash.slice(0, 16)}"`;
    const total = media.content.length;
    reply
      .header('cache-control', IMMUTABLE)
      .header('etag', etag)
      .header('accept-ranges', 'bytes');
    if (ifNoneMatch(req.headers['if-none-match'], etag)) return reply.code(304).send();

    const range = parseRange(req.headers.range, total);
    if (range === 'unsatisfiable') {
      return reply
        .code(416)
        .header('content-range', `bytes */${total}`)
        .header('content-length', '0')
        .send();
    }

    reply.type(media.contentType);
    let body = media.content;
    if (range !== 'full') {
      body = media.content.subarray(range.start, range.end + 1);
      reply.code(206).header('content-range', `bytes ${range.start}-${range.end}/${total}`);
    }
    reply.header('content-length', String(body.length));
    return head ? reply.send() : reply.send(body);
  };

  app.route<MediaRoute>({ method: ['GET', 'HEAD'], url: '/projects/:slug/_media/:file', handler });
}
