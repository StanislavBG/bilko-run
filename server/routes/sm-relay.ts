// Session Manager web-remote relay — REST surface, mounted same-origin on bilko.run.
// Auth: reuses host Clerk (Bearer token) instead of v1's standalone Google OAuth.
// The signed-in Clerk email IS the relay userId (canRoute isolates devices per-email).
// WS upgrade is wired in server/index.ts via router.handleUpgrade.
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../clerk.js';
import {
  issueOtp,
  verifyOtp,
  issueDeviceToken,
  issueWsTicket,
  verifyDeviceToken,
  revokeDevice,
  revokeAllDevicesForUser,
  getDevicesForUser,
  deviceByIdStore,
  purgeExpired,
} from '../sm-relay/tokens.js';
import {
  isDeviceOnline,
  notifyDeviceRevoked,
  closeSessionsForUser,
} from '../sm-relay/router.js';

// ── Optional email allowlist (defense in depth; default: any authenticated Clerk user) ──
// canRoute already isolates devices per-email and pairing needs physical access to the
// local machine, so the relay is multi-tenant-safe without this. Set SM_RELAY_ALLOWED_EMAILS
// (comma-separated) to restrict further.
function emailAllowed(email: string): boolean {
  const env = process.env.SM_RELAY_ALLOWED_EMAILS;
  if (!env) return true;
  return env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

/** Clerk auth + allowlist. Returns { userId, email } (userId === email) or null after replying. */
async function requireRelayUser(req: FastifyRequest, reply: FastifyReply): Promise<{ userId: string; email: string } | null> {
  const email = await requireAuth(req, reply);
  if (!email) return null; // requireAuth already sent 401
  if (!emailAllowed(email)) {
    reply.status(403).send({ error: 'not_allowed' });
    return null;
  }
  return { userId: email, email };
}

// ── /pair IP rate limiting (agent endpoint, no Clerk session) ──
const PAIR_RATE_MAX = 10;
const PAIR_RATE_WINDOW_MS = 60 * 60 * 1000;
const pairIpRateStore = new Map<string, { count: number; resetAt: number }>();

const DEVICE_TICKET_RATE_MAX = 10;
const DEVICE_TICKET_RATE_WINDOW_MS = 60_000;
const deviceTicketRateStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: FastifyRequest): string {
  // Render appends the real client IP, so the rightmost X-Forwarded-For value is trusted.
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',').at(-1)!.trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

function checkRate(store: Map<string, { count: number; resetAt: number }>, key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) { store.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export function registerSmRelayRoutes(app: FastifyInstance): void {
  // ── GET /api/sm-relay/me ──
  app.get('/api/sm-relay/me', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    reply.send({ userId: auth.userId, email: auth.email });
  });

  // ── POST /api/sm-relay/otp — phone generates a pairing OTP ──
  app.post('/api/sm-relay/otp', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const result = issueOtp(auth.userId, auth.email);
    if ('error' in result) {
      return reply.status(result.error === 'rate_limited' ? 429 : 400).send(result);
    }
    reply.send({ code: result.code });
  });

  // ── POST /api/sm-relay/ws-ticket — phone gets a one-time WS upgrade ticket ──
  app.post('/api/sm-relay/ws-ticket', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const ticket = issueWsTicket({ userId: auth.userId, email: auth.email, role: 'browser' });
    reply.send({ ticket });
  });

  // ── POST /api/sm-relay/device-ticket — agent gets a one-time WS upgrade ticket ──
  app.post('/api/sm-relay/device-ticket', async (req, reply) => {
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) return reply.status(401).send({ error: 'missing_token' });
    const rawToken = authHeader.slice(7);

    if (!checkRate(deviceTicketRateStore, rawToken.slice(0, 16), DEVICE_TICKET_RATE_MAX, DEVICE_TICKET_RATE_WINDOW_MS)) {
      return reply.status(429).send({ error: 'rate_limited' });
    }
    const device = verifyDeviceToken(rawToken);
    if (!device) return reply.status(401).send({ error: 'invalid_token' });
    if (!emailAllowed(device.email)) return reply.status(403).send({ error: 'not_allowed' });

    const ticket = issueWsTicket({ userId: device.userId, email: device.email, role: 'agent', deviceId: device.deviceId });
    reply.send({ ticket });
  });

  // ── POST /api/sm-relay/pair — agent exchanges OTP for a device token ──
  app.post<{ Body: { code?: string; deviceId?: string; devicePubKey?: string } }>(
    '/api/sm-relay/pair',
    async (req, reply) => {
      if (!checkRate(pairIpRateStore, getClientIp(req), PAIR_RATE_MAX, PAIR_RATE_WINDOW_MS)) {
        return reply.status(429).send({ error: 'rate_limited' });
      }
      const { code, deviceId, devicePubKey } = req.body ?? {};
      if (!code || !deviceId) return reply.status(400).send({ error: 'missing_fields' });
      if (typeof code !== 'string' || !/^[A-Za-z0-9]{8}$/.test(code)) return reply.status(400).send({ error: 'invalid_code_format' });
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
        return reply.status(400).send({ error: 'invalid_device_id' });
      }
      const PUB_KEY_RE = /^[A-Za-z0-9+/=_-]+$/;
      if (!devicePubKey || typeof devicePubKey !== 'string' || devicePubKey.length > 512 || !PUB_KEY_RE.test(devicePubKey)) {
        return reply.status(400).send({ error: 'missing_device_pub_key' });
      }

      const result = verifyOtp(code);
      if ('error' in result) return reply.status(result.status).send({ error: result.error });

      const deviceToken = issueDeviceToken(deviceId, result.userId, result.email, devicePubKey);
      reply.send({ deviceToken, deviceId }); // token returned to agent; never logged
    },
  );

  // ── GET /api/sm-relay/devices — list paired devices for the signed-in user ──
  app.get('/api/sm-relay/devices', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const devices = getDevicesForUser(auth.userId).map((d) => ({
      deviceId: d.deviceId,
      email: d.email,
      issuedAt: d.issuedAt,
      expiresAt: d.expiresAt,
      isOnline: isDeviceOnline(d.deviceId),
      devicePubKey: d.devicePubKey,
    }));
    reply.send({ devices });
  });

  // ── DELETE /api/sm-relay/devices/:deviceId — revoke one device ──
  app.delete<{ Params: { deviceId: string } }>('/api/sm-relay/devices/:deviceId', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const entry = deviceByIdStore.get(req.params.deviceId);
    if (!entry || entry.userId !== auth.userId) return reply.status(404).send({ error: 'device_not_found' });
    revokeDevice(req.params.deviceId);
    notifyDeviceRevoked(req.params.deviceId);
    reply.send({ ok: true });
  });

  // ── DELETE /api/sm-relay/devices — panic: revoke ALL devices for this user ──
  app.delete('/api/sm-relay/devices', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const revokedIds = revokeAllDevicesForUser(auth.userId);
    for (const deviceId of revokedIds) notifyDeviceRevoked(deviceId);
    closeSessionsForUser(auth.userId);
    reply.send({ ok: true, revokedCount: revokedIds.length });
  });

  // Periodic housekeeping (in-process stores)
  const timer = setInterval(() => purgeExpired(), 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}
