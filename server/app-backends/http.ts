/**
 * HTTP forwarder for app backends: /projects/<slug>/api/* -> <origin>/api/*.
 *
 * App-agnostic. Cookies never cross in either direction, request bodies are capped, and a
 * dead or slow backend answers 502 { error: 'backend_unavailable' }. URL and request-header
 * rules live in ./config.ts.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildUpstreamUrl, forwardRequestHeaders, matchAppBackend, type AppBackend } from './config.js';

export const APP_BACKEND_BODY_LIMIT = 64 * 1024;
export const APP_BACKEND_TIMEOUT_MS = 30_000;

// Backend response headers passed to the client. Never set-cookie, content-length,
// content-encoding (Node's fetch already decoded the body) or hop-by-hop headers.
const RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
  'expires',
  'location',
  'retry-after',
  'content-disposition',
  'content-language',
  'www-authenticate',
] as const;

function handlerFor(backend: AppBackend, timeoutMs: number) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const match = matchAppBackend([backend], req.url);
    const url = match ? buildUpstreamUrl(backend, match.rest, 'http') : null;
    if (!url) return reply.code(400).header('cache-control', 'no-store').send({ error: 'bad_path' });

    const headers = forwardRequestHeaders(req.headers, req.socket.remoteAddress);
    const body =
      req.method !== 'GET' && req.method !== 'HEAD' && Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : undefined;

    let status: number;
    let buf: Buffer;
    let upstreamHeaders: Headers;
    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const res = await fetch(url, { method: req.method, headers, body, redirect: 'manual', signal });
      buf = Buffer.from(await res.arrayBuffer());
      status = res.status;
      upstreamHeaders = res.headers;
    } catch (err) {
      const path = req.url.split('?')[0];
      const name = err instanceof Error ? err.name : 'Error';
      console.warn(`[app-backends] ${backend.slug} ${req.method} ${path} backend_unavailable (${name})`);
      return reply.code(502).header('cache-control', 'no-store').send({ error: 'backend_unavailable' });
    }

    for (const name of RESPONSE_HEADERS) {
      const v = upstreamHeaders.get(name);
      if (v !== null) reply.header(name, v);
    }
    if (upstreamHeaders.get('cache-control') === null) reply.header('cache-control', 'no-store');
    return reply.code(status).send(buf);
  };
}

export function registerAppBackendRoutes(
  app: FastifyInstance,
  backends: readonly AppBackend[],
  opts?: { timeoutMs?: number },
): void {
  if (backends.length === 0) return;
  const timeoutMs = opts?.timeoutMs ?? APP_BACKEND_TIMEOUT_MS;
  // Encapsulated on purpose (no fastify-plugin): the catch-all buffer parser stays scoped to
  // these routes and every other route keeps the root JSON parser.
  app.register(async (child) => {
    child.removeAllContentTypeParsers();
    child.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
    for (const b of backends) {
      child.all(
        b.prefix + '*',
        { bodyLimit: APP_BACKEND_BODY_LIMIT, config: { appBackend: b.slug } },
        handlerFor(b, timeoutMs),
      );
    }
  });
}
