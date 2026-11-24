// Session Manager drop boxes — owner surface. A paired desktop (device token) manages the
// boxes of its own device; a signed-in account (Clerk session) lists, edits and deletes every
// box of the account from a web console. Only a device token can create a box, and creation
// is owner-first: SM_RELAY_BOXES_ALLOWED_EMAILS opens it to more accounts.
// The owning device drains its boxes here (list, download, acknowledge); public ingest lives
// in sm-relay-box-ingest.ts.
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ADMIN_EMAILS } from '../clerk.js';
import { resolveRelayOwner, type RelayOwner } from '../sm-relay/owner-auth.js';
import {
  createBox,
  deleteBox,
  deleteEnvelope,
  getBox,
  listBoxes,
  listEnvelopes,
  parseAllowedOrigins,
  parseBoxLabel,
  parseBoxPublicKey,
  readEnvelope,
  updateBox,
  type BoxListRow,
  type BoxPatch,
  type BoxRecord,
} from '../sm-relay/boxes.js';

/** A drop-box caller is a relay owner: a Clerk session or a paired desktop's device token. */
export type BoxCaller = RelayOwner;
export const resolveBoxCaller = resolveRelayOwner;

/** Owner-first creation gate, read on every call. */
function boxesEnabledFor(email: string): boolean {
  const env = (process.env.SM_RELAY_BOXES_ALLOWED_EMAILS ?? '').trim();
  const e = email.toLowerCase();
  if (!env) return ADMIN_EMAILS.map((a) => a.toLowerCase()).includes(e);
  if (env === '*') return true;
  return env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(e);
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function toBoxJson(row: BoxListRow) {
  return {
    boxId: row.boxId,
    label: row.label,
    allowedOrigins: row.allowedOrigins,
    publicKey: row.publicKey,
    state: row.state,
    pending: row.pending,
    pendingBytes: row.pendingBytes,
    createdAt: iso(row.createdAt),
    lastReceivedAt: row.lastReceivedAt == null ? null : iso(row.lastReceivedAt),
    deviceId: row.deviceId,
  };
}

function owns(caller: BoxCaller, box: BoxRecord): boolean {
  if (box.userId !== caller.userId) return false;
  return caller.kind === 'clerk' || box.deviceId === caller.deviceId;
}

function listFor(caller: BoxCaller): Promise<BoxListRow[]> {
  return caller.kind === 'device'
    ? listBoxes({ userId: caller.userId, deviceId: caller.deviceId })
    : listBoxes({ userId: caller.userId });
}

async function ownedBox(caller: BoxCaller, boxId: string, reply: FastifyReply): Promise<BoxRecord | null> {
  const box = await getBox(boxId);
  if (!box || !owns(caller, box)) {
    reply.status(404).send({ error: 'box_not_found' });
    return null;
  }
  return box;
}

const MAX_DRAIN_LIMIT = 20;

/** limit=1..20 (default 20); null for anything else. */
function parseDrainLimit(raw: unknown): number | null {
  if (raw === undefined) return MAX_DRAIN_LIMIT;
  if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= MAX_DRAIN_LIMIT ? n : null;
}

/** Drain routes take only the device that owns the box; replies and returns null otherwise. */
async function drainableBox(req: FastifyRequest, reply: FastifyReply, boxId: string): Promise<BoxRecord | null> {
  const caller = await resolveBoxCaller(req, reply);
  if (!caller) return null;
  if (caller.kind !== 'device') {
    reply.status(403).send({ error: 'device_token_required' });
    return null;
  }
  return ownedBox(caller, boxId, reply);
}

interface CreateBody { label?: unknown; publicKey?: unknown; allowedOrigins?: unknown }
interface PatchBody { label?: unknown; allowedOrigins?: unknown; state?: unknown }

export function registerSmRelayBoxRoutes(app: FastifyInstance): void {
  app.post<{ Body: CreateBody }>('/api/sm-relay/boxes', async (req, reply) => {
    const caller = await resolveBoxCaller(req, reply);
    if (!caller) return;
    if (caller.kind !== 'device') return reply.status(403).send({ error: 'device_token_required' });
    if (!boxesEnabledFor(caller.email)) return reply.status(403).send({ error: 'not_enabled' });

    const body = (req.body ?? {}) as CreateBody;
    const label = parseBoxLabel(body.label);
    if (label === null) return reply.status(400).send({ error: 'invalid_label' });
    const publicKey = parseBoxPublicKey(body.publicKey);
    if (publicKey === null) return reply.status(400).send({ error: 'invalid_public_key' });
    const allowedOrigins = parseAllowedOrigins(body.allowedOrigins);
    if (allowedOrigins === null) return reply.status(400).send({ error: 'invalid_allowed_origins' });

    const box = await createBox({
      userId: caller.userId, deviceId: caller.deviceId, label, publicKey, allowedOrigins,
    });
    if (!box) return reply.status(403).send({ error: 'box_limit_reached' });
    return reply.status(201).send({ boxId: box.boxId, state: box.state, createdAt: iso(box.createdAt) });
  });

  app.get('/api/sm-relay/boxes', async (req, reply) => {
    const caller = await resolveBoxCaller(req, reply);
    if (!caller) return;
    const rows = await listFor(caller);
    return reply.send({ boxes: rows.map(toBoxJson) });
  });

  app.patch<{ Params: { boxId: string }; Body: PatchBody }>('/api/sm-relay/boxes/:boxId', async (req, reply) => {
    const caller = await resolveBoxCaller(req, reply);
    if (!caller) return;
    const box = await ownedBox(caller, req.params.boxId, reply);
    if (!box) return;

    const body = (req.body ?? {}) as PatchBody;
    const patch: BoxPatch = {};
    if (body.label !== undefined) {
      const label = parseBoxLabel(body.label);
      if (label === null) return reply.status(400).send({ error: 'invalid_label' });
      patch.label = label;
    }
    if (body.allowedOrigins !== undefined) {
      const origins = parseAllowedOrigins(body.allowedOrigins);
      if (origins === null) return reply.status(400).send({ error: 'invalid_allowed_origins' });
      patch.allowedOrigins = origins;
    }
    if (body.state !== undefined) {
      if (body.state !== 'open' && body.state !== 'paused') return reply.status(400).send({ error: 'invalid_state' });
      patch.state = body.state;
    }

    const updated = await updateBox(box.boxId, patch);
    const row = updated && (await listFor(caller)).find((r) => r.boxId === box.boxId);
    if (!row) return reply.status(404).send({ error: 'box_not_found' });
    return reply.send(toBoxJson(row));
  });

  app.delete<{ Params: { boxId: string } }>('/api/sm-relay/boxes/:boxId', async (req, reply) => {
    const caller = await resolveBoxCaller(req, reply);
    if (!caller) return;
    const box = await ownedBox(caller, req.params.boxId, reply);
    if (!box) return;
    await deleteBox(box.boxId);
    return reply.send({ ok: true });
  });

  app.get<{ Params: { boxId: string }; Querystring: { limit?: string } }>(
    '/api/sm-relay/boxes/:boxId/envelopes',
    async (req, reply) => {
      const box = await drainableBox(req, reply, req.params.boxId);
      if (!box) return;
      const limit = parseDrainLimit((req.query as { limit?: unknown }).limit);
      if (limit === null) return reply.status(400).send({ error: 'invalid_limit' });
      const rows = await listEnvelopes(box.boxId, limit);
      return reply.send({
        envelopes: rows.map((r) => ({
          envelopeId: r.envelopeId,
          hostId: r.hostId,
          clientReportId: r.clientReportId,
          receivedAt: iso(r.receivedAt),
          origin: r.origin,
          bytes: r.bytes,
        })),
      });
    },
  );

  app.get<{ Params: { boxId: string; envelopeId: string } }>(
    '/api/sm-relay/boxes/:boxId/envelopes/:envelopeId',
    { compress: false },
    async (req, reply) => {
      const box = await drainableBox(req, reply, req.params.boxId);
      if (!box) return;
      const body = await readEnvelope(box.boxId, req.params.envelopeId);
      if (!body) return reply.status(404).send({ error: 'envelope_not_found' });
      return reply.type('application/octet-stream').header('cache-control', 'no-store').send(body);
    },
  );

  app.delete<{ Params: { boxId: string; envelopeId: string } }>(
    '/api/sm-relay/boxes/:boxId/envelopes/:envelopeId',
    async (req, reply) => {
      const box = await drainableBox(req, reply, req.params.boxId);
      if (!box) return;
      const deleted = await deleteEnvelope(box.boxId, req.params.envelopeId);
      if (!deleted) return reply.status(404).send({ error: 'envelope_not_found' });
      return reply.send({ ok: true });
    },
  );
}
