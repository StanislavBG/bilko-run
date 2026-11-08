import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAdmin, requireAdminSession } from '../clerk.js';
import { dbAll, dbGet, dbRun } from '../db.js';
import { readSessionIds } from '../session-identity.js';
import { parseUa } from '../services/analytics.js';

// Marks the requesting browser's bilko_vid cookie id as one of the owner's own devices (internal_devices).
// loadOwnerIds() in server/traffic-filters.ts counts every marked id as the owner's with no time window, so the
// traffic console's Mine filter drops the device's visits even while it is signed out.

const LABEL_MAX = 80;
const DEVICE_LIST_CAP = 500;
const NO_VISITOR_COOKIE = 'This request carries no valid bilko_vid cookie. Load any bilko.run page in this browser, then retry.';

export interface InternalDevice {
  visitorId: string;
  label: string | null;
  markedAtMs: number;
}

export interface InternalDeviceState {
  /** The requesting browser; visitorId is null when it sent no valid bilko_vid cookie. */
  current: { visitorId: string | null; marked: boolean };
  /** Every marked device, newest mark first. */
  devices: InternalDevice[];
}

/** The request's own bilko_vid cookie id; never the id the session-identity hook mints for a cookieless request. */
function cookieVisitorId(req: FastifyRequest): string | null {
  return readSessionIds(req.headers.cookie).visitorId;
}

/** A default label from the marking request's user agent, e.g. "Chrome on Mac"; null when nothing is recognised. */
function userAgentLabel(ua: string | undefined): string | null {
  const { browser, os } = parseUa(ua ?? '');
  if (browser === 'other' && os === 'other') return null;
  return `${browser} on ${os}`;
}

async function readState(visitorId: string | null): Promise<InternalDeviceState> {
  const [rows, own] = await Promise.all([
    dbAll<{ visitor_id: string; label: string | null; marked_at_ms: number }>(
      `SELECT visitor_id, label, marked_at_ms FROM internal_devices ORDER BY marked_at_ms DESC, visitor_id LIMIT ?`,
      DEVICE_LIST_CAP,
    ),
    visitorId ? dbGet<{ one: number }>(`SELECT 1 AS one FROM internal_devices WHERE visitor_id = ?`, visitorId) : undefined,
  ]);
  return {
    current: { visitorId, marked: own !== undefined },
    devices: rows.map((r) => ({
      visitorId: String(r.visitor_id),
      label: r.label === null ? null : String(r.label),
      markedAtMs: Number(r.marked_at_ms),
    })),
  };
}

export function registerAdminInternalDeviceRoutes(app: FastifyInstance): void {
  // Read-only, so a personal admin API key may list the devices too.
  app.get('/api/admin/internal-device', async (req, reply) => {
    if (!(await requireAdmin(req, reply))) return;
    return await readState(cookieVisitorId(req));
  });

  // Marking and unmarking change what the console counts as the owner, so they need a real Clerk admin session.
  app.post('/api/admin/internal-device', async (req, reply) => {
    if (!(await requireAdminSession(req, reply))) return;
    const visitorId = cookieVisitorId(req);
    if (!visitorId) {
      reply.status(400).send({ error: NO_VISITOR_COOKIE });
      return;
    }
    const body = req.body;
    const label = body !== null && typeof body === 'object' ? (body as { label?: unknown }).label : undefined;
    if (label !== undefined && label !== null && typeof label !== 'string') {
      reply.status(400).send({ error: 'label must be a string.' });
      return;
    }
    const given = typeof label === 'string' ? label.trim().slice(0, LABEL_MAX).trim() || null : null;
    // Re-marking keeps the first mark time and replaces the label only when one is given.
    await dbRun(
      `INSERT INTO internal_devices (visitor_id, label, marked_at_ms) VALUES (?, ?, ?)
       ON CONFLICT(visitor_id) DO UPDATE SET label = COALESCE(?, internal_devices.label)`,
      visitorId, given ?? userAgentLabel(req.headers['user-agent']), Date.now(), given,
    );
    return await readState(visitorId);
  });

  app.delete('/api/admin/internal-device', async (req, reply) => {
    if (!(await requireAdminSession(req, reply))) return;
    const visitorId = cookieVisitorId(req);
    if (!visitorId) {
      reply.status(400).send({ error: NO_VISITOR_COOKIE });
      return;
    }
    await dbRun(`DELETE FROM internal_devices WHERE visitor_id = ?`, visitorId);
    return await readState(visitorId);
  });
}
