/**
 * HTTP forwarder for app backends: /projects/<slug>/api/* -> <origin>/api/*, looked up per
 * request in the current map (./live.ts).
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

export type AppBackendSource = readonly AppBackend[] | (() => readonly AppBackend[]);

/** The backend list in force right now: a fixed list, or a getter over the live map. */
export function currentBackends(source: AppBackendSource): readonly AppBackend[] {
  return typeof source === 'function' ? source() : source;
}

// Slug of the backend a forwarded request went to, for per-app egress metering (server/egress.ts).
// Per request, not route config: one route serves every slug in the live map.
const forwardedSlug = new WeakMap<object, string>();

/** The app-backend slug this request was forwarded to, if any. */
export function appBackendSlugOf(req: object): string | undefined {
  return forwardedSlug.get(req);
}

const MATCH_CONSTRAINT = 'appBackend';
const MATCHED = 'matched';
const ROUTE = '/projects/:slug/api/*';

function handlerFor(source: AppBackendSource, timeoutMs: number) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const match = matchAppBackend(currentBackends(source), req.url);
    // The map changed between routing and here: answer as if the route never matched.
    if (!match) return reply.callNotFound() as unknown as FastifyReply;
    const { backend } = match;
    forwardedSlug.set(req, backend.slug);
    const url = buildUpstreamUrl(backend, match.rest, 'http');
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

/**
 * One route for every app backend. A route constraint consults the current map while routing,
 * so a slug without a backend never matches here and falls through to the other routes (static
 * files under /projects/<slug>/api/ keep working). A fixed empty list registers nothing.
 */
export function registerAppBackendRoutes(
  app: FastifyInstance,
  backends: AppBackendSource,
  opts?: { timeoutMs?: number },
): void {
  if (typeof backends !== 'function' && backends.length === 0) return;
  const timeoutMs = opts?.timeoutMs ?? APP_BACKEND_TIMEOUT_MS;
  app.addConstraintStrategy({
    name: MATCH_CONSTRAINT,
    storage() {
      const handlers = new Map<string, unknown>();
      return {
        get: (value: string) => (handlers.get(value) ?? null) as never,
        set: (value: string, store: unknown) => {
          handlers.set(value, store);
        },
      };
    },
    deriveConstraint: (req: { url?: string }) =>
      matchAppBackend(currentBackends(backends), req.url ?? '') ? MATCHED : undefined,
    mustMatchWhenDerived: true,
  });
  // Encapsulated on purpose (no fastify-plugin): the catch-all buffer parser stays scoped to
  // these routes and every other route keeps the root JSON parser.
  app.register(async (child) => {
    child.removeAllContentTypeParsers();
    child.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
    child.all(
      ROUTE,
      { bodyLimit: APP_BACKEND_BODY_LIMIT, constraints: { [MATCH_CONSTRAINT]: MATCHED } },
      handlerFor(backends, timeoutMs),
    );
  });
}
