import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet, dbRun } from '../db.js';
import { requireAdmin, requireAuth } from '../clerk.js';
import { SIGNIN_SOURCES, isSigninSource } from '../../shared/signin-capture.js';

// "Sign in for updates" capture. Everything on the capture pages stays free and
// readable signed out; this only records where a signed-in account came from
// and whether it ticked "send me occasional updates". Collect-only: nothing here
// sends email.

interface CaptureRow {
  email: string;
  source: string;
  consent: number;
  consent_at: number | null;
  created_at: number;
}

const CSV_COLUMNS = ['email', 'source', 'consent', 'consent_at', 'signed_up_at'] as const;

function iso(ms: number | null): string {
  return ms ? new Date(ms).toISOString() : '';
}

/** RFC 4180 field; also defuses spreadsheet formula injection (=, +, -, @ leads). */
function csvField(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function signupsCsv(rows: CaptureRow[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push([r.email, r.source, r.consent ? 'yes' : 'no', iso(r.consent_at), iso(r.created_at)].map(csvField).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function registerSigninCaptureRoutes(app: FastifyInstance): void {
  // Called by the prompt once the visitor is signed in. The first source wins and is
  // never overwritten; consent only ever turns ON here (unticked means "no change").
  app.post('/api/signin-capture', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const body = (req.body ?? {}) as { source?: unknown; consent?: unknown };
    if (!isSigninSource(body.source)) {
      return reply.status(400).send({ error: 'Unknown source.' });
    }
    const consent = body.consent === true;
    const now = Date.now();
    const key = email.toLowerCase();

    const existing = await dbGet<CaptureRow>('SELECT * FROM signin_captures WHERE email = ?', key);
    if (!existing) {
      await dbRun(
        'INSERT INTO signin_captures (email, source, consent, consent_at, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING',
        key, body.source, consent ? 1 : 0, consent ? now : null, now,
      );
      await dbRun(
        'INSERT INTO funnel_events (event, tool, path, metadata) VALUES (?, ?, ?, ?)',
        'signin_completed', body.source, null, JSON.stringify({ consent }),
      ).catch(() => { /* analytics never fails the capture */ });
    } else if (consent && !existing.consent) {
      await dbRun('UPDATE signin_captures SET consent = 1, consent_at = ? WHERE email = ?', now, key);
    }

    const row = await dbGet<CaptureRow>('SELECT * FROM signin_captures WHERE email = ?', key);
    return {
      ok: true,
      created: !existing,
      source: row?.source ?? body.source,
      consent: !!row?.consent,
    };
  });

  // Admin: signups by source + consent, the raw rows, and the prompt funnel for the window.
  app.get('/api/admin/signups', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const q = req.query as { days?: string };
    const days = Math.min(365, Math.max(1, Math.floor(Number(q.days) || 30)));
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');

    const [bySourceRaw, rows, funnelRaw] = await Promise.all([
      dbAll<{ source: string; signups: number; consented: number }>(
        'SELECT source, COUNT(*) AS signups, SUM(consent) AS consented FROM signin_captures GROUP BY source',
      ),
      dbAll<CaptureRow>('SELECT * FROM signin_captures ORDER BY created_at DESC, rowid DESC LIMIT 500'),
      dbAll<{ tool: string | null; event: string; n: number }>(
        `SELECT tool, event, COUNT(*) AS n FROM funnel_events
         WHERE event IN ('prompt_shown', 'prompt_dismissed', 'signin_completed') AND created_at >= ?
         GROUP BY tool, event`,
        since,
      ),
    ]);

    const bySource = SIGNIN_SOURCES.map((source) => {
      const s = bySourceRaw.find((r) => r.source === source);
      const f = (event: string) => Number(funnelRaw.find((r) => r.tool === source && r.event === event)?.n ?? 0);
      return {
        source,
        signups: Number(s?.signups ?? 0),
        consented: Number(s?.consented ?? 0),
        promptShown: f('prompt_shown'),
        promptDismissed: f('prompt_dismissed'),
        signinCompleted: f('signin_completed'),
      };
    });

    return {
      windowDays: days,
      total: bySource.reduce((n, s) => n + s.signups, 0),
      consented: bySource.reduce((n, s) => n + s.consented, 0),
      bySource,
      rows: rows.map((r) => ({
        email: r.email,
        source: r.source,
        consent: !!r.consent,
        consentAt: r.consent_at,
        createdAt: r.created_at,
      })),
    };
  });

  app.get('/api/admin/signups.csv', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const rows = await dbAll<CaptureRow>('SELECT * FROM signin_captures ORDER BY created_at ASC, rowid ASC');
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="bilko-signups.csv"')
      .header('Cache-Control', 'no-store');
    return signupsCsv(rows);
  });
}
