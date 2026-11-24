// Public drop-box routes a website widget calls: fetch the box's public key, then POST a
// sealed SMF1 envelope. The host never decrypts, parses, logs or hashes the body; it checks
// only the magic, size, headers and limits, stores the bytes and nudges the owning desktop.
//
// CORS is decided per box, not by the global @fastify/cors plugin (config: { cors: false }):
// the envelope routes echo the Origin only when it is in the box's allowedOrigins, and no
// public route ever sends Access-Control-Allow-Credentials.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getBox, storeEnvelope, MAX_ENVELOPE_BYTES, type BoxRecord } from '../sm-relay/boxes.js';
import { notifyDeviceBoxEnvelope } from '../sm-relay/router.js';
import { getClientIp } from './sm-relay.js';

const ENVELOPE_URL = '/api/sm-relay/boxes/:boxId/envelopes';
const KEY_URL = '/api/sm-relay/boxes/:boxId/key';
const MAGIC = Buffer.from('SMF1', 'ascii');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-process sliding windows. Abuse damping, not accounting: a restart resetting them is harmless.
const IP_WINDOW_MS = 60_000;
const IP_MAX = 10;
const BOX_WINDOW_MS = 60 * 60_000;
const BOX_MAX = 60;
const MAX_TRACKED_KEYS = 5_000;
const ipHits = new Map<string, number[]>();
const boxHits = new Map<string, number[]>();

/** Seconds to wait, or 0 when the request is within the limit. Every call counts. */
function hit(bucket: Map<string, number[]>, key: string, max: number, windowMs: number, now = Date.now()): number {
  const recent = (bucket.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  if (!bucket.has(key) && bucket.size >= MAX_TRACKED_KEYS) bucket.clear(); // crude bound
  bucket.set(key, recent);
  if (recent.length <= max) return 0;
  const oldest = recent[recent.length - 1 - max];
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}

/** Test hook: forget every rate-limit window. */
export function resetSmRelayBoxIngestRateLimits(): void {
  ipHits.clear();
  boxHits.clear();
}

type BoxParams = { Params: { boxId: string } };

declare module 'fastify' {
  interface FastifyRequest {
    smRelayBox?: BoxRecord;
  }
}

function originOf(req: FastifyRequest): string | null {
  const o = req.headers.origin;
  return typeof o === 'string' && o.length > 0 ? o : null;
}

/**
 * Route-level onRequest: runs before any body is read, so every reply (including parser
 * errors such as the body-limit 413) already carries the CORS headers set here.
 */
async function guardEnvelopeRoute(req: FastifyRequest<BoxParams>, reply: FastifyReply): Promise<void> {
  const box = await getBox(req.params.boxId);
  const origin = originOf(req);
  const allowed = box !== null && origin !== null && box.allowedOrigins.includes(origin);
  if (allowed) {
    reply.header('access-control-allow-origin', origin);
    reply.header('vary', 'Origin');
  }

  if (req.method === 'POST') {
    const wait = hit(ipHits, getClientIp(req), IP_MAX, IP_WINDOW_MS);
    if (wait > 0) return void reply.code(429).header('retry-after', String(wait)).send({ error: 'rate_limited' });
  }

  if (!box) return void reply.code(404).send({ error: 'box_not_found' });
  if (!allowed) return void reply.code(403).send({ error: 'origin_not_allowed' });
  if (box.state === 'paused') return void reply.code(410).send({ error: 'box_paused' });
  req.smRelayBox = box;

  if (req.method !== 'POST') return;
  const wait = hit(boxHits, box.boxId, BOX_MAX, BOX_WINDOW_MS);
  if (wait > 0) return void reply.code(429).header('retry-after', String(wait)).send({ error: 'rate_limited' });

  const len = Number(req.headers['content-length']);
  if (Number.isFinite(len) && len > MAX_ENVELOPE_BYTES) {
    return void reply.code(413).send({ error: 'too_large' });
  }
  if (req.headers['x-sm-envelope'] !== '1') return void reply.code(400).send({ error: 'bad_envelope' });
  const reportId = req.headers['x-sm-report-id'];
  if (typeof reportId !== 'string' || !UUID_RE.test(reportId)) {
    return void reply.code(400).send({ error: 'invalid_report_id' });
  }
  const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/octet-stream') return void reply.code(400).send({ error: 'bad_envelope' });
}

export function registerSmRelayBoxIngestRoutes(app: FastifyInstance): void {
  app.get<BoxParams>(KEY_URL, { config: { cors: false } }, async (req, reply) => {
    reply.header('access-control-allow-origin', '*');
    const box = await getBox(req.params.boxId);
    if (!box) return reply.code(404).send({ error: 'box_not_found' });
    reply.header('cache-control', 'public, max-age=60');
    return reply.send({ boxId: box.boxId, publicKey: box.publicKey, state: box.state });
  });

  app.register(async (scope) => {
    scope.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer', bodyLimit: MAX_ENVELOPE_BYTES },
      (_req, body, done) => done(null, body),
    );

    scope.route<BoxParams>({
      method: 'OPTIONS',
      url: ENVELOPE_URL,
      config: { cors: false },
      onRequest: guardEnvelopeRoute,
      handler: async (_req, reply) => {
        return reply
          .code(204)
          .header('access-control-allow-methods', 'POST')
          .header('access-control-allow-headers', 'Content-Type, X-Sm-Envelope, X-Sm-Report-Id')
          .header('access-control-max-age', '600')
          .send();
      },
    });

    scope.route<BoxParams>({
      method: 'POST',
      url: ENVELOPE_URL,
      bodyLimit: MAX_ENVELOPE_BYTES,
      config: { cors: false },
      onRequest: guardEnvelopeRoute,
      handler: async (req, reply) => {
        const box = req.smRelayBox!;
        const body = req.body;
        if (!Buffer.isBuffer(body) || body.length <= MAGIC.length || !body.subarray(0, MAGIC.length).equals(MAGIC)) {
          return reply.code(400).send({ error: 'bad_envelope' });
        }
        const result = await storeEnvelope({
          boxId: box.boxId,
          clientReportId: String(req.headers['x-sm-report-id']).toLowerCase(),
          origin: originOf(req)!,
          body,
        });
        if (result.kind === 'full') return reply.code(507).send({ error: 'box_full' });
        if (result.kind === 'duplicate') return reply.code(200).send({ id: result.hostId });
        notifyDeviceBoxEnvelope(box.deviceId, box.boxId);
        return reply.code(201).send({ id: result.hostId });
      },
    });
  });
}
