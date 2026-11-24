// Session Manager drop boxes — owner surface. A paired desktop (device token) manages the
// boxes of its own device; a signed-in account (Clerk session) lists, edits and deletes every
// box of the account from a web console. Only a device token can create a box, and creation
// is owner-first: SM_RELAY_BOXES_ALLOWED_EMAILS opens it to more accounts.
// Envelope routes live elsewhere.
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ADMIN_EMAILS, requireAuth } from '../clerk.js';
import { verifyDeviceToken } from '../sm-relay/tokens.js';
import {
  createBox,
  deleteBox,
  getBox,
  listBoxes,
  parseAllowedOrigins,
  parseBoxLabel,
  parseBoxPublicKey,
  updateBox,
  type BoxListRow,
  type BoxPatch,
  type BoxRecord,
} from '../sm-relay/boxes.js';
import { emailAllowed } from './sm-relay.js';

export type BoxCaller =
  | { kind: 'device'; userId: string; deviceId: string; email: string }
  | { kind: 'clerk'; userId: string };

/** A Clerk session JWT has exactly two dots; a device token (base64url) has none. */
function isClerkShaped(token: string): boolean {
  return token.split('.').length === 3;
}

/** Resolves the caller from the bearer, or replies (401/403) and returns null. */
export async function resolveBoxCaller(req: FastifyRequest, reply: FastifyReply): Promise<BoxCaller | null> {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Bearer ') || authHeader.length <= 7) {
    reply.status(401).send({ error: 'missing_token' });
    return null;
  }
  const raw = authHeader.slice(7);
  if (isClerkShaped(raw)) {
    const email = await requireAuth(req, reply);
    if (!email) return null; // requireAuth already sent 401
    if (!emailAllowed(email)) {
      reply.status(403).send({ error: 'not_allowed' });
      return null;
    }
    return { kind: 'clerk', userId: email };
  }
  const device = await verifyDeviceToken(raw);
  if (!device) {
    reply.status(401).send({ error: 'invalid_token' });
    return null;
  }
  if (!emailAllowed(device.email)) {
    reply.status(403).send({ error: 'not_allowed' });
    return null;
  }
  return { kind: 'device', userId: device.userId, deviceId: device.deviceId, email: device.email };
}

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
}
