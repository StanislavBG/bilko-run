// Bilko-DB lite document API: a signed-in user's JSON or text documents for one app.
// Versioning is plain HTTP: GET returns ETag "<version>", PUT/DELETE honour If-Match,
// PUT honours If-None-Match: * (create only). The user is always the verified token's email.
// Images: POST/GET list/DELETE under /api/db/:app/images (Bearer), plus a public GET by id.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../clerk.js';
import {
  DOC_MAX_BYTES,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  deleteDoc,
  deleteImage,
  getDoc,
  getImage,
  isAppName,
  isDocKey,
  isImageType,
  listDocs,
  listImages,
  putDoc,
  putImage,
  type DocKind,
  type ImageMeta,
} from '../services/bilko-db.js';

const WRITE_LIMIT = 300;
const WRITE_WINDOW_MS = 60_000;

/**
 * Per-user Bilko-DB write limiter (in-process, fixed 60 s window). Shared by the document
 * and image routes so their writes count against one budget.
 */
export const bilkoDbWriteLimiter = (() => {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    /** Records one write; returns ok, or the seconds until the window resets. */
    hit(user: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
      if (windows.size > 10_000) {
        for (const [u, w] of windows) if (now - w.start >= WRITE_WINDOW_MS) windows.delete(u);
      }
      let w = windows.get(user);
      if (!w || now - w.start >= WRITE_WINDOW_MS) {
        w = { start: now, count: 0 };
        windows.set(user, w);
      }
      if (w.count >= WRITE_LIMIT) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((w.start + WRITE_WINDOW_MS - now) / 1000)) };
      }
      w.count += 1;
      return { ok: true };
    },
    reset(): void {
      windows.clear();
    },
  };
})();

/** Sends 429 rate_limited when the user is over the write budget; returns false then. */
export function checkBilkoDbWrite(user: string, reply: FastifyReply): boolean {
  const r = bilkoDbWriteLimiter.hit(user);
  if (r.ok) return true;
  reply.code(429).header('Retry-After', String(r.retryAfterSec)).send({ error: 'rate_limited', retryAfterSec: r.retryAfterSec });
  return false;
}

const VERSION_TAG_RE = /^(?:W\/)?"?(\d{1,15})"?$/;

/** Parses an If-Match value: undefined when absent, null when malformed. */
function parseIfMatch(h: string | string[] | undefined): number | undefined | null {
  if (h === undefined) return undefined;
  if (Array.isArray(h)) return null;
  const m = VERSION_TAG_RE.exec(h.trim());
  return m ? Number(m[1]) : null;
}

function mediaType(req: FastifyRequest): string {
  const ct = req.headers['content-type'];
  return typeof ct === 'string' ? ct.split(';')[0]!.trim().toLowerCase() : '';
}

const iso = (ms: number) => new Date(ms).toISOString();

// The key is a wildcard segment, not `:key`: Fastify's router 404s params over 100 chars
// (maxParamLength) and doc keys may be 128. A `/` in it fails isDocKey.
interface RawParams { app: string; '*'?: string }
interface DocParams { app: string; key?: string }
function docParams(req: FastifyRequest): DocParams {
  const p = req.params as RawParams;
  return { app: p.app, key: p['*'] };
}
type AuthedRequest = FastifyRequest & { bilkoDbUser?: string };

/** Maps body-limit and content-type failures to the API's error shapes. */
function bilkoDbErrorHandler(err: any, req: FastifyRequest, reply: FastifyReply) {
  const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  if (status === 413) return reply.code(413).send({ error: 'too_large' });
  if (status === 415) return reply.code(415).send({ error: 'unsupported_media_type' });
  if (status >= 400 && status < 500) return reply.code(status).send({ error: 'bad_request' });
  console.error(`[error] ${req.method} ${req.url}:`, err);
  return reply.code(500).send({ error: 'Something went wrong. Please try again.' });
}

// Image ids are 16 random bytes as base64url (22 chars); anything else is not an image.
const IMAGE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function imageView(appName: string, m: ImageMeta) {
  return { id: m.id, url: `/api/db/${appName}/images/${m.id}`, type: m.type, bytes: m.bytes, createdAt: iso(m.createdAt) };
}

export function registerBilkoDbRoutes(app: FastifyInstance): void {
  app.register(async (scope) => {
    // Bodies are taken as strings so JSON validity is ours to judge (400 bad_json) and text
    // is stored exactly as sent. Any other content type is rejected by Fastify with 415.
    scope.removeAllContentTypeParsers();
    for (const type of ['application/json', 'text/plain', 'text/markdown']) {
      scope.addContentTypeParser(type, { parseAs: 'string' }, (_req, body, done) => done(null, body));
    }

    scope.setErrorHandler(bilkoDbErrorHandler);

    // Names are checked before auth; auth and the write budget run before the body is
    // parsed so unauthenticated or throttled uploads are never read.
    scope.addHook('onRequest', async (req: AuthedRequest, reply) => {
      const { app: appName, key } = docParams(req);
      if (!isAppName(appName)) return reply.code(400).send({ error: 'bad_app' });
      if (key !== undefined && !isDocKey(key)) return reply.code(400).send({ error: 'bad_key' });
      const email = await requireAuth(req, reply);
      if (!email) return reply;
      req.bilkoDbUser = email;
      if (req.method === 'PUT' || req.method === 'DELETE') {
        if (!checkBilkoDbWrite(email, reply)) return reply;
      }
    });

    const routeOpts = { bodyLimit: DOC_MAX_BYTES + 1024 };

    scope.get('/api/db/:app/docs', routeOpts, async (req: AuthedRequest, reply) => {
      const { app: appName } = docParams(req);
      const { prefix } = req.query as { prefix?: unknown };
      if (prefix !== undefined && (typeof prefix !== 'string' || prefix.length > 128)) {
        return reply.code(400).send({ error: 'bad_prefix' });
      }
      const docs = await listDocs({ app: appName, user: req.bilkoDbUser!, prefix });
      reply.header('Cache-Control', 'private, no-store');
      return {
        docs: docs.map((d) => ({ key: d.key, type: d.kind, bytes: d.bytes, version: d.version, updatedAt: iso(d.updatedAt) })),
      };
    });

    scope.get('/api/db/:app/docs/*', routeOpts, async (req: AuthedRequest, reply) => {
      const { app: appName, key } = docParams(req) as Required<DocParams>;
      const doc = await getDoc({ app: appName, user: req.bilkoDbUser!, key });
      reply.header('Cache-Control', 'private, no-store').header('X-Content-Type-Options', 'nosniff');
      if (!doc) return reply.code(404).send({ error: 'not_found' });
      return reply
        .header('ETag', `"${doc.version}"`)
        .type(doc.kind === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8')
        .send(doc.body);
    });

    scope.put('/api/db/:app/docs/*', routeOpts, async (req: AuthedRequest, reply) => {
      const { app: appName, key } = docParams(req) as Required<DocParams>;
      const type = mediaType(req);
      let kind: DocKind;
      let body: string;
      const raw = typeof req.body === 'string' ? req.body : '';
      if (type === 'application/json') {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return reply.code(400).send({ error: 'bad_json' });
        }
        kind = 'json';
        body = JSON.stringify(parsed);
      } else if (type === 'text/plain' || type === 'text/markdown') {
        kind = 'text';
        body = raw;
      } else {
        return reply.code(415).send({ error: 'unsupported_media_type' });
      }

      const ifVersion = parseIfMatch(req.headers['if-match']);
      if (ifVersion === null) return reply.code(400).send({ error: 'bad_if_match' });
      const createOnly = req.headers['if-none-match'] === '*';

      const r = await putDoc({ app: appName, user: req.bilkoDbUser!, key, kind, body, ifVersion, createOnly });
      if ('error' in r) {
        if (r.error === 'version_mismatch') return reply.code(412).send({ error: 'version_mismatch', version: r.version });
        if (r.error === 'too_large') return reply.code(413).send({ error: 'too_large' });
        return reply.code(507).send({ error: 'quota_exceeded' });
      }
      reply.header('ETag', `"${r.version}"`).header('Cache-Control', 'private, no-store');
      return { key: r.key, type: r.kind, version: r.version, bytes: r.bytes, updatedAt: iso(r.updatedAt) };
    });

    scope.delete('/api/db/:app/docs/*', routeOpts, async (req: AuthedRequest, reply) => {
      const { app: appName, key } = docParams(req) as Required<DocParams>;
      const ifVersion = parseIfMatch(req.headers['if-match']);
      if (ifVersion === null) return reply.code(400).send({ error: 'bad_if_match' });
      const r = await deleteDoc({ app: appName, user: req.bilkoDbUser!, key, ifVersion });
      if ('error' in r) return reply.code(412).send({ error: 'version_mismatch', version: r.version });
      if (!r.deleted) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    });
  });

  // Image upload, list and delete: Bearer only, owner only. The raw-bytes parsers live in
  // this scope so the global parsers are untouched; other content types get 415.
  app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser(
      [...IMAGE_TYPES],
      { parseAs: 'buffer', bodyLimit: IMAGE_MAX_BYTES },
      (_req, body, done) => done(null, body),
    );
    scope.setErrorHandler(bilkoDbErrorHandler);

    // As for documents: names, then auth, then the shared write budget, all before the body.
    scope.addHook('onRequest', async (req: AuthedRequest, reply) => {
      const { app: appName } = req.params as { app: string };
      if (!isAppName(appName)) return reply.code(400).send({ error: 'bad_app' });
      const email = await requireAuth(req, reply);
      if (!email) return reply;
      req.bilkoDbUser = email;
      if (req.method === 'POST' || req.method === 'DELETE') {
        if (!checkBilkoDbWrite(email, reply)) return reply;
      }
    });

    const routeOpts = { bodyLimit: IMAGE_MAX_BYTES };

    scope.post('/api/db/:app/images', routeOpts, async (req: AuthedRequest, reply) => {
      const { app: appName } = req.params as { app: string };
      const type = mediaType(req);
      if (!isImageType(type)) return reply.code(415).send({ error: 'unsupported_media_type' });
      if (!Buffer.isBuffer(req.body)) return reply.code(400).send({ error: 'bad_image' });
      const r = await putImage({ app: appName, user: req.bilkoDbUser!, bytes: req.body, type });
      if ('error' in r) {
        if (r.error === 'bad_image') return reply.code(400).send({ error: 'bad_image' });
        if (r.error === 'too_large') return reply.code(413).send({ error: 'too_large' });
        return reply.code(507).send({ error: 'quota_exceeded' });
      }
      return reply.code(201).header('Cache-Control', 'private, no-store').send(imageView(appName, r));
    });

    scope.get('/api/db/:app/images', async (req: AuthedRequest, reply) => {
      const { app: appName } = req.params as { app: string };
      const images = await listImages({ app: appName, user: req.bilkoDbUser! });
      reply.header('Cache-Control', 'private, no-store');
      return { images: images.map((m) => imageView(appName, m)) };
    });

    scope.delete('/api/db/:app/images/:id', async (req: AuthedRequest, reply) => {
      const { app: appName, id } = req.params as { app: string; id: string };
      if (!IMAGE_ID_RE.test(id)) return reply.code(404).send({ error: 'not_found' });
      const r = await deleteImage({ app: appName, user: req.bilkoDbUser!, id });
      if (!r.deleted) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    });
  });

  // Public image link: no auth, so it works in a plain <img>. The unguessable id is the
  // capability; the app in the path must match the stored one. The CSP sandbox and nosniff
  // keep a crafted file from ever running as a document. Compression is off: the bytes are
  // already compressed images and are sent exactly as stored.
  app.get('/api/db/:app/images/:id', { compress: false }, async (req, reply) => {
    const { app: appName, id } = req.params as { app: string; id: string };
    if (!isAppName(appName) || !IMAGE_ID_RE.test(id)) return reply.code(404).send({ error: 'not_found' });
    const img = await getImage(id);
    if (!img || img.app !== appName) return reply.code(404).send({ error: 'not_found' });
    return reply
      .header('Cache-Control', 'public, max-age=3600')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .header('Content-Length', String(img.bytes.length))
      .type(img.type)
      .send(img.bytes);
  });
}
