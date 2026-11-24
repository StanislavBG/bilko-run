// Session Manager relay — owner auth shared by the relay and drop-box routes.
// An owner is a signed-in Clerk session or a paired desktop's device token
// (POST /api/sm-relay/pair), both for the same account id (the Clerk email).
// A client token (POST /api/sm-relay/client-pair) is never an owner: it fails the
// device-token lookup, so a paired service cannot mint codes, manage drop boxes
// or revoke clients.
import type { FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../clerk.js';
import { verifyDeviceToken } from './tokens.js';

// ── Optional email allowlist (defense in depth; default: any authenticated Clerk user) ──
// canRoute already isolates devices per-email and pairing needs physical access to the
// local machine, so the relay is multi-tenant-safe without this. Set SM_RELAY_ALLOWED_EMAILS
// (comma-separated) to restrict further.
export function emailAllowed(email: string): boolean {
  const env = process.env.SM_RELAY_ALLOWED_EMAILS;
  if (!env) return true;
  return env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

export type RelayOwner =
  | { kind: 'device'; userId: string; deviceId: string; email: string }
  | { kind: 'clerk'; userId: string; email: string };

/** A Clerk session JWT has exactly two dots; device and client tokens (base64url) have none. */
export function isClerkShaped(token: string): boolean {
  return token.split('.').length === 3;
}

/** Resolves the owner from the bearer, or replies (401/403) and returns null. */
export async function resolveRelayOwner(req: FastifyRequest, reply: FastifyReply): Promise<RelayOwner | null> {
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
    return { kind: 'clerk', userId: email, email };
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
