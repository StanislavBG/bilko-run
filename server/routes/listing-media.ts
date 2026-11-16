// Serves owner-uploaded card media from the database at
// /projects/<slug>/_media/<sha256>.<ext>, plus <file>.json metadata that tells the
// /projects card whether a video has sound. Names are content hashes, so every
// hit is immutable for a year. Single byte ranges are supported because Safari
// will not play an MP4 without them. Registered before @fastify/static so the
// specific route wins over the static bundle and the SPA fallback.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ifNoneMatch } from '../og-routes.js';
import {
  getListingMedia, getListingMediaMeta, storeListingMedia,
  type ListingMedia, type ListingMediaMeta, type StoreListingMediaResult,
} from '../services/listing-media.js';
import { isListingMediaDeclared } from '../services/listing-media-declared.js';
import type { CardMediaField } from '../../shared/listing-media.js';

export interface ListingMediaRouteDeps {
  getMedia?: (slug: string, file: string) => Promise<ListingMedia | null>;
  getMeta?: (slug: string, file: string) => Promise<ListingMediaMeta | null>;
  isDeclared?: (slug: string, file: string) => Promise<CardMediaField | undefined>;
  store?: (slug: string, file: string, field: CardMediaField, buf: Buffer) => Promise<StoreListingMediaResult>;
}

export const LISTING_MEDIA_MAX_UPLOAD_BYTES = 8388608;
const UPLOAD_FILE_RE = /^[0-9a-f]{64}\.(png|mp4|webm)$/;
const UPLOAD_LIMIT = 20;
const UPLOAD_WINDOW_MS = 10 * 60_000;

const rateCounts = new Map<string, { count: number; windowStart: number }>();

function rateOk(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateCounts.get(key);
  if (!entry || now - entry.windowStart > UPLOAD_WINDOW_MS) {
    rateCounts.set(key, { count: 1, windowStart: now });
    if (rateCounts.size > 5000) {
      for (const [k, v] of rateCounts) {
        if (now - v.windowStart > UPLOAD_WINDOW_MS) rateCounts.delete(k);
      }
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
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

  const isDeclared = deps.isDeclared ?? ((slug: string, file: string) => isListingMediaDeclared(slug, file));
  const store = deps.store ?? storeListingMedia;

  // Content-addressed media fill. No auth on purpose, like the paid-release fill
  // in web-products.ts: anyone may PUT, but bytes are stored only when the
  // registry (deployed, or on GitHub main) already sets this exact
  // /projects/<slug>/_media/<file> path on the slug's listing, and the file name
  // is the sha256 of the bytes. Only someone who can push the registry (the
  // owner's MCP) decides what gets stored, so no deploy secret is needed. The
  // binary parser is scoped to this plugin so the global parsers are untouched.
  app.register(async (scope) => {
    scope.addContentTypeParser(
      ['application/octet-stream', 'image/png', 'video/mp4', 'video/webm'],
      { parseAs: 'buffer', bodyLimit: LISTING_MEDIA_MAX_UPLOAD_BYTES },
      (_req, body, done) => done(null, body),
    );
    scope.put<MediaRoute>('/api/listing-media/:slug/:file', async (req, reply) => {
      const { slug, file } = req.params;
      if (!UPLOAD_FILE_RE.test(file)) return reply.code(404).send({ error: 'not declared' });
      if (!rateOk(`lm-upload:${req.ip}`, UPLOAD_LIMIT)) {
        return reply.code(429).send({ error: 'Too many uploads. Try again in 10 minutes.' });
      }
      const field = await isDeclared(slug, file);
      if (!field) return reply.code(404).send({ error: 'not declared' });
      const body = req.body;
      if (!Buffer.isBuffer(body)) return reply.code(422).send({ error: 'body must be the raw file bytes' });

      const result = await store(slug, file, field, body);
      if (typeof result === 'object') return reply.code(422).send({ error: result.error });
      const meta = await getMeta(slug, file);
      const url = `/projects/${slug}/_media/${file}`;
      const bytes = meta?.bytes ?? body.length;
      const audio = meta?.hasAudio ?? false;
      if (result === 'exists') return reply.code(200).send({ stored: true, existed: true, url, bytes, audio });
      return reply.code(201).send({ stored: true, url, bytes, audio });
    });
  });
}
