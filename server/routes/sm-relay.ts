// Session Manager web-remote relay — REST surface, mounted same-origin on bilko.run.
// Auth: reuses host Clerk (Bearer token) instead of v1's standalone Google OAuth.
// The signed-in Clerk email IS the relay userId (canRoute isolates devices per-email).
// Two non-Clerk credentials exist, both minted from a signed-in owner's OTP:
//   device token (POST /pair)        → role:'agent' tickets for that one device
//   client token (POST /client-pair) → role:'browser' tickets, so a desktop Session
//                                      Manager can drive the owner's devices like the phone app
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
  getDevice,
  issueClientToken,
  verifyClientToken,
  getClient,
  getClientsForUser,
  revokeClient,
  revokeAllClientsForUser,
  purgeExpired,
  type ClientRecord,
} from '../sm-relay/tokens.js';
import {
  isDeviceOnline,
  notifyDeviceRevoked,
  notifyClientRevoked,
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
const clientTicketRateStore = new Map<string, { count: number; resetAt: number }>();
const clientDevicesRateStore = new Map<string, { count: number; resetAt: number }>();

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

/** Bearer client token + rate limit + allowlist. Returns the client or null after replying. */
async function requireRelayClient(
  req: FastifyRequest,
  reply: FastifyReply,
  rateStore: Map<string, { count: number; resetAt: number }>,
): Promise<ClientRecord | null> {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Bearer ')) { reply.status(401).send({ error: 'missing_token' }); return null; }
  const rawToken = authHeader.slice(7);

  if (!checkRate(rateStore, rawToken.slice(0, 16), DEVICE_TICKET_RATE_MAX, DEVICE_TICKET_RATE_WINDOW_MS)) {
    reply.status(429).send({ error: 'rate_limited' });
    return null;
  }
  const client = await verifyClientToken(rawToken);
  if (!client) { reply.status(401).send({ error: 'invalid_token' }); return null; }
  if (!emailAllowed(client.email)) { reply.status(403).send({ error: 'not_allowed' }); return null; }
  return client;
}

async function listDevices(userId: string) {
  return (await getDevicesForUser(userId)).map((d) => ({
    deviceId: d.deviceId,
    email: d.email,
    issuedAt: d.issuedAt,
    expiresAt: d.expiresAt,
    isOnline: isDeviceOnline(d.deviceId),
    devicePubKey: d.devicePubKey,
  }));
}

export function registerSmRelayRoutes(app: FastifyInstance): void {
  // ── Product-root entry point for the web-remote phone app ─────────────────
  // Session Manager's whole web presence is reasoned about as one unit under
  // /products/session-manager. The phone app's BUNDLE, though, stays published
  // at /projects/session-manager/ — that is the host contract's static-path
  // prefix, it is what mcp-host-server's publisher writes, and its URL is baked
  // into already-paired devices. So the product root exposes a redirect rather
  // than a second copy: one canonical artifact, discoverable from the product.
  for (const from of ['/products/session-manager/remote', '/products/session-manager/remote/']) {
    app.get(from, async (_req, reply) => reply.redirect('/projects/session-manager/', 301));
  }

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
    const result = issueOtp(auth.userId, auth.email, 'device');
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
    const device = await verifyDeviceToken(rawToken);
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

      const result = verifyOtp(code, 'device');
      if ('error' in result) return reply.status(result.status).send({ error: result.error });

      const deviceToken = await issueDeviceToken(deviceId, result.userId, result.email, devicePubKey);
      reply.send({ deviceToken, deviceId }); // token returned to agent; never logged
    },
  );

  // ── GET /api/sm-relay/devices — list paired devices for the signed-in user ──
  app.get('/api/sm-relay/devices', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    reply.send({ devices: await listDevices(auth.userId) });
  });

  // ── DELETE /api/sm-relay/devices/:deviceId — revoke one device ──
  app.delete<{ Params: { deviceId: string } }>('/api/sm-relay/devices/:deviceId', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const entry = await getDevice(req.params.deviceId);
    if (!entry || entry.userId !== auth.userId) return reply.status(404).send({ error: 'device_not_found' });
    await revokeDevice(req.params.deviceId);
    notifyDeviceRevoked(req.params.deviceId);
    reply.send({ ok: true });
  });

  // ── DELETE /api/sm-relay/devices — panic: revoke ALL devices and clients for this user ──
  app.delete('/api/sm-relay/devices', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const revokedIds = await revokeAllDevicesForUser(auth.userId);
    for (const deviceId of revokedIds) notifyDeviceRevoked(deviceId);
    const revokedClientIds = await revokeAllClientsForUser(auth.userId);
    closeSessionsForUser(auth.userId);
    reply.send({ ok: true, revokedCount: revokedIds.length, revokedClientCount: revokedClientIds.length });
  });

  // ── POST /api/sm-relay/client-otp — signed-in owner mints a client-pairing OTP ──
  app.post('/api/sm-relay/client-otp', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const result = issueOtp(auth.userId, auth.email, 'client');
    if ('error' in result) {
      return reply.status(result.error === 'rate_limited' ? 429 : 400).send(result);
    }
    reply.send({ code: result.code });
  });

  // ── POST /api/sm-relay/client-pair — desktop client exchanges OTP for a client token ──
  app.post<{ Body: { code?: string; clientName?: string } }>('/api/sm-relay/client-pair', async (req, reply) => {
    if (!checkRate(pairIpRateStore, getClientIp(req), PAIR_RATE_MAX, PAIR_RATE_WINDOW_MS)) {
      return reply.status(429).send({ error: 'rate_limited' });
    }
    const { code, clientName } = req.body ?? {};
    if (!code) return reply.status(400).send({ error: 'missing_fields' });
    if (typeof code !== 'string' || !/^[A-Za-z0-9]{8}$/.test(code)) return reply.status(400).send({ error: 'invalid_code_format' });
    if (clientName !== undefined && (typeof clientName !== 'string' || clientName.length > 64)) {
      return reply.status(400).send({ error: 'invalid_client_name' });
    }

    const result = verifyOtp(code, 'client');
    if ('error' in result) return reply.status(result.status).send({ error: result.error });

    const { clientId, clientToken } = await issueClientToken(result.userId, result.email, clientName?.trim() ?? '');
    reply.send({ clientToken, clientId }); // token returned to client; never logged
  });

  // ── POST /api/sm-relay/client-ticket — client gets a one-time role:'browser' WS ticket ──
  app.post('/api/sm-relay/client-ticket', async (req, reply) => {
    const client = await requireRelayClient(req, reply, clientTicketRateStore);
    if (!client) return;
    const ticket = issueWsTicket({ userId: client.userId, email: client.email, role: 'browser', clientId: client.clientId });
    reply.send({ ticket });
  });

  // ── GET /api/sm-relay/client/devices — the client's view of its owner's devices ──
  app.get('/api/sm-relay/client/devices', async (req, reply) => {
    const client = await requireRelayClient(req, reply, clientDevicesRateStore);
    if (!client) return;
    reply.send({ devices: await listDevices(client.userId) });
  });

  // ── GET /api/sm-relay/clients — list paired clients for the signed-in user ──
  app.get('/api/sm-relay/clients', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    reply.send({ clients: await getClientsForUser(auth.userId) });
  });

  // ── DELETE /api/sm-relay/clients/:clientId — revoke one client ──
  app.delete<{ Params: { clientId: string } }>('/api/sm-relay/clients/:clientId', async (req, reply) => {
    const auth = await requireRelayUser(req, reply);
    if (!auth) return;
    const entry = await getClient(req.params.clientId);
    if (!entry || entry.userId !== auth.userId) return reply.status(404).send({ error: 'client_not_found' });
    await revokeClient(req.params.clientId);
    notifyClientRevoked(req.params.clientId);
    reply.send({ ok: true });
  });

  // Periodic housekeeping (in-process stores + expired device rows)
  const timer = setInterval(() => {
    purgeExpired().catch((err) => app.log.warn({ err }, 'sm-relay purgeExpired failed'));
  }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}
