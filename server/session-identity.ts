/**
 * Session identity contract for all of bilko.run (host SPA, static-path apps under
 * /projects/<slug>/, the injected click beacon, and the host-kit SDK).
 *
 *   bilko_vid  visitor UUID, Max-Age 1 year.
 *   bilko_sid  session UUID, 30-minute sliding idle window (re-stamped on every
 *              qualifying HTML response).
 *
 * Both are first-party, Path=/, SameSite=Lax (+Secure on https) and deliberately NOT
 * HttpOnly so client JS can read them; the whole site is one origin, so every tab and
 * app shares them. A valid id is a UUID; anything else counts as absent and is never
 * echoed back or stored. Wire field names on beacons and API bodies: visitor_id,
 * session_id.
 *
 * Server code reads ids via `readSessionIds(cookieHeader)` or `(req as any).bilkoIds`
 * (set by the onRequest hook below). Client implementers (BEACON_JS, host-kit
 * telemetry.ts, src/hooks/usePageView.ts) should point here.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export const VID_COOKIE = 'bilko_vid';
export const SID_COOKIE = 'bilko_sid';
export const VID_MAX_AGE_S = 31536000;
export const SID_IDLE_S = 1800;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BilkoIds {
  visitorId: string;
  sessionId: string;
  mintedVisitor: boolean;
  mintedSession: boolean;
}

export function isValidId(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function readSessionIds(cookieHeader: string | undefined): { visitorId: string | null; sessionId: string | null } {
  let visitorId: string | null = null;
  let sessionId: string | null = null;
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const name = part.slice(0, eq).trim();
      if (name !== VID_COOKIE && name !== SID_COOKIE) continue;
      const value = part.slice(eq + 1).trim();
      if (!isValidId(value)) continue;
      if (name === VID_COOKIE) visitorId = value;
      else sessionId = value;
    }
  }
  return { visitorId, sessionId };
}

export function registerSessionIdentity(app: FastifyInstance): void {
  app.addHook('onRequest', async (req) => {
    const { visitorId, sessionId } = readSessionIds(req.headers.cookie);
    const ids: BilkoIds = {
      visitorId: visitorId ?? randomUUID(),
      sessionId: sessionId ?? randomUUID(),
      mintedVisitor: visitorId === null,
      mintedSession: sessionId === null,
    };
    (req as any).bilkoIds = ids;
  });

  app.addHook('onSend', async (req, reply, payload) => {
    if (req.method !== 'GET' || reply.statusCode !== 200) return payload;
    if (req.url.startsWith('/api/')) return payload;
    if (!String(reply.getHeader('content-type') ?? '').startsWith('text/html')) return payload;
    const ids = (req as any).bilkoIds as BilkoIds | undefined;
    if (!ids) return payload;

    const fwd = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim().toLowerCase();
    const secure = req.protocol === 'https' || fwd === 'https' ? '; Secure' : '';
    const attrs = `Path=/; SameSite=Lax${secure}`;

    const existing = reply.getHeader('set-cookie');
    const prior = existing === undefined ? [] : Array.isArray(existing) ? existing.map(String) : [String(existing)];
    reply.header('set-cookie', [
      ...prior,
      `${VID_COOKIE}=${ids.visitorId}; Max-Age=${VID_MAX_AGE_S}; ${attrs}`,
      `${SID_COOKIE}=${ids.sessionId}; Max-Age=${SID_IDLE_S}; ${attrs}`,
    ]);
    return payload;
  });
}
