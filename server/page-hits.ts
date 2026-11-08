import type { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import type { InStatement } from '@libsql/client';
import { getClient, dbAll, dbTransaction, txRun } from './db.js';
import { dayKey } from './egress.js';
import { parseUa, classifyVisitor } from './services/analytics.js';
import { readSessionIds } from './session-identity.js';
import { isInternalRequest } from './internal-traffic.js';
import { verifyClerkToken, ADMIN_EMAILS } from './clerk.js';

// Server-side page-hit recorder: logs every HTML document response, so pages
// that never run client JS (static-path apps) still show up in observability.
//
// Same constraints as egress.ts: nothing touches the DB on the request path
// (rows buffer in memory, flushed on a timer), and a recording failure never
// fails a response. Rows carry full request detail (IP, user-agent, referrer),
// a cross-day visitor_id, and the Clerk email when a __session cookie resolves.

const FLUSH_MS = 60_000;
const BATCH_CHUNK = 100;
const MAX_BUFFER = 5000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export interface PageHitInput {
  ts: number;
  path: string;
  status: number;
  ip: string;
  ua: string;
  referer?: string | null;
  host?: string | null;
  country?: string | null;
  userEmail?: string | null;
  sessionId?: string | null;
  clientVid?: string | null;
  botId?: string | null;
  mcp?: boolean;
  /** The request carried the bilko_internal marker (server/internal-traffic.ts). */
  internal?: boolean;
}

interface PageHitRow {
  ts_ms: number;
  date: string;
  path: string;
  slug: string | null;
  status: number;
  referrer_host: string | null;
  visitor_hash: string;
  country: string | null;
  device: string;
  browser: string;
  os: string;
  is_bot: number;
  ip: string;
  ua: string;
  referrer: string | null;
  visitor_id: string;
  user_email: string | null;
  is_admin: number;
  is_internal: number;
  session_id: string | null;
  client_vid: string | null;
  visitor_class: string;
}

let buffer: PageHitRow[] = [];
let timer: NodeJS.Timeout | null = null;
let lastPruneDay = '';
let flushInFlight: Promise<void> | null = null;

// Host-rendered pages (not under /projects/<slug>/) that still count as a
// project's traffic: the Human For Hire page and its two aliases, with or
// without the trailing slash.
export const HOST_PAGE_SLUG = 'human-for-hire';
export const HOST_PAGE_PATHS: readonly string[] = ['/bilko', '/hire', '/human-for-hire', '/book'].flatMap((p) => [p, `${p}/`]);

export function slugFromPath(path: string): string | null {
  if (HOST_PAGE_PATHS.includes(path)) return HOST_PAGE_SLUG;
  const m = /^\/projects\/([^/?#]+)\//.exec(path);
  return m ? m[1] : null;
}

function hostOf(raw: string): string {
  return raw.toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
}

function refHost(referer: string | null | undefined, ownHost: string | null | undefined): string | null {
  if (!referer) return null;
  let h: string;
  try {
    h = new URL(referer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  if (!h) return null;
  if (ownHost && h === hostOf(ownHost)) return null;
  return h;
}

export function visitorHash(date: string, ip: string, ua: string): string {
  return createHash('sha256').update(`${date}|${ip}|${ua}`).digest('hex').slice(0, 16);
}

export function stableVisitorId(ip: string, ua: string): string {
  const salt = process.env.ANALYTICS_VISITOR_SALT ?? 'bilko-visitor-v1';
  return createHash('sha256').update(`${salt}|${ip}|${ua}`).digest('hex').slice(0, 16);
}

export function sessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === '__session') return part.slice(eq + 1).trim() || null;
  }
  return null;
}

export function recordPageHit(input: PageHitInput): void {
  if (buffer.length >= MAX_BUFFER) return;
  const date = dayKey(input.ts);
  const path = input.path.split('?')[0].slice(0, 300);
  const { device, browser, os } = parseUa(input.ua);
  const visitorClass = classifyVisitor(input.ua, { botId: input.botId, mcp: input.mcp });
  buffer.push({
    ts_ms: input.ts,
    date,
    path,
    slug: slugFromPath(path),
    status: input.status,
    referrer_host: refHost(input.referer, input.host),
    visitor_hash: visitorHash(date, input.ip, input.ua),
    country: input.country ? input.country.slice(0, 8) : null,
    device,
    browser,
    os,
    is_bot: visitorClass !== 'human' ? 1 : 0,
    ip: input.ip.slice(0, 64),
    ua: input.ua.slice(0, 400),
    referrer: input.referer ? input.referer.slice(0, 500) : null,
    visitor_id: stableVisitorId(input.ip, input.ua),
    user_email: input.userEmail ?? null,
    is_admin: input.userEmail && ADMIN_EMAILS.includes(input.userEmail.toLowerCase()) ? 1 : 0,
    is_internal: input.internal ? 1 : 0,
    session_id: input.sessionId ?? null,
    client_vid: input.clientVid ?? null,
    visitor_class: visitorClass,
  });
}

// Automation visitors (bilko_vid cookie ids from a navigator.webdriver === true
// pageview). The automation_visitors table is the source of truth; this set is its
// in-memory copy, loaded once per process, so rows are stamped at write time.
let automationVids = new Set<string>();
let automationLoad: Promise<void> | null = null;

function loadAutomationVisitors(): Promise<void> {
  if (!automationLoad) {
    automationLoad = (async () => {
      try {
        const rows = await dbAll<{ visitor_id: string }>('SELECT visitor_id FROM automation_visitors');
        for (const r of rows) automationVids.add(r.visitor_id);
      } catch {
        automationLoad = null; // retry on next use
      }
    })();
  }
  return automationLoad;
}

/** True when `vid` is a known automation visitor. Never throws. */
export async function isAutomationVisitor(vid: string | null | undefined): Promise<boolean> {
  if (!vid) return false;
  await loadAutomationVisitors();
  return automationVids.has(vid);
}

/**
 * Records `vid` as an automation visitor. Returns true only on first detection
 * (the INSERT OR IGNORE added the row), so the caller backfills once per visitor.
 */
export async function markAutomationVisitor(vid: string, nowMs: number): Promise<boolean> {
  await loadAutomationVisitors();
  if (automationVids.has(vid)) return false;
  automationVids.add(vid);
  const res = await getClient().execute({
    sql: 'INSERT OR IGNORE INTO automation_visitors (visitor_id, first_seen_ms) VALUES (?, ?)',
    args: [vid, nowMs],
  });
  return res.rowsAffected > 0;
}

/** Test hook: drop the in-memory copy so the next use reloads it from the table. */
export function resetAutomationVisitorCache(): void {
  automationVids = new Set<string>();
  automationLoad = null;
}

function stampAutomation(r: PageHitRow): void {
  if (r.client_vid && r.is_bot !== 1 && automationVids.has(r.client_vid)) {
    r.is_bot = 1;
    r.visitor_class = 'script';
  }
}

function insertStmt(r: PageHitRow): InStatement {
  return {
    sql: `INSERT INTO page_hits (ts_ms, date, path, slug, status, referrer_host, visitor_hash, country, device, browser, os, is_bot, ip, ua, referrer, visitor_id, user_email, is_admin, is_internal, session_id, client_vid, visitor_class)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [r.ts_ms, r.date, r.path, r.slug, r.status, r.referrer_host, r.visitor_hash, r.country, r.device, r.browser, r.os, r.is_bot, r.ip, r.ua, r.referrer, r.visitor_id, r.user_email, r.is_admin, r.is_internal, r.session_id, r.client_vid, r.visitor_class],
  };
}

export async function flushPageHits(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    try {
      const rows = buffer;
      buffer = [];
      const client = getClient();
      await loadAutomationVisitors();
      for (let i = 0; i < rows.length; i += BATCH_CHUNK) {
        // Stamp each chunk just before it is written, so a visitor detected while
        // an earlier chunk was in flight is still caught.
        const chunk = rows.slice(i, i + BATCH_CHUNK);
        chunk.forEach(stampAutomation);
        try {
          await client.batch(chunk.map(insertStmt), 'write');
        } catch { /* dropped chunk: don't re-queue, avoids unbounded growth */ }
      }
      // A visitor first detected while this flush's batches were in flight may have
      // run its one-time backfill before these rows landed: flag them now.
      const late = new Map<string, number>();
      for (const r of rows) {
        if (r.client_vid && r.is_bot !== 1 && automationVids.has(r.client_vid)) {
          late.set(r.client_vid, Math.min(late.get(r.client_vid) ?? r.ts_ms, r.ts_ms));
        }
      }
      for (const [vid, sinceMs] of late) {
        try {
          await client.execute({
            sql: 'UPDATE page_hits SET is_bot = ?, visitor_class = ? WHERE ts_ms >= ? AND client_vid = ? AND is_bot IS NOT ?',
            args: [1, 'script', sinceMs, vid, 1],
          });
        } catch { /* best effort */ }
      }

      const today = dayKey(Date.now());
      if (lastPruneDay !== today) {
        lastPruneDay = today;
        try {
          await client.execute({
            sql: 'DELETE FROM page_hits WHERE ts_ms < ?',
            args: [Date.now() - RETENTION_MS],
          });
        } catch { lastPruneDay = ''; }
      }
    } catch { /* recording must never break the server */ }
  })();
  // Clear after assignment: an IIFE with nothing to await finishes synchronously.
  const p = flushInFlight;
  void p.finally(() => { if (flushInFlight === p) flushInFlight = null; });
  return p;
}

const BACKFILL_BATCH = 500;

// Classifies legacy rows (visitor_class IS NULL) from their stored ua. Never throws.
export async function backfillVisitorClass(maxBatches = 200): Promise<number> {
  let total = 0;
  try {
    for (let i = 0; i < maxBatches; i++) {
      const batch = await dbAll<{ id: number; ua: string | null }>(
        'SELECT id, ua FROM page_hits WHERE visitor_class IS NULL ORDER BY id LIMIT ?', BACKFILL_BATCH);
      if (batch.length === 0) break;
      await dbTransaction(async (tx) => {
        for (const r of batch) {
          await txRun(tx, 'UPDATE page_hits SET visitor_class = ? WHERE id = ?', classifyVisitor(r.ua ?? ''), r.id);
        }
      });
      total += batch.length;
    }
  } catch (e) {
    console.error('[page-hits] backfillVisitorClass failed', e);
  }
  return total;
}

export function registerPageHitRecorder(app: FastifyInstance, opts: { flush?: boolean } = {}): void {
  app.addHook('onResponse', async (req, reply) => {
    try {
      const path = req.url.split('?')[0];
      const isMcp = req.method === 'POST' && path === '/mcp';
      const isAgentPath = req.method === 'GET' && (path === '/llms.txt' || path === '/api/offers' || path.startsWith('/buy/'));
      // The tip jar is a bodyless 302 to a Stripe Payment Link. Record it so each
      // coffee Checkout Session can be matched to a visitor class and referrer.
      const isTipRedirect = req.method === 'GET' && path === '/coffee';
      if (!isMcp && !isAgentPath && !isTipRedirect) {
        if (req.method !== 'GET') return;
        if (path.startsWith('/api/')) return;
        const ct = String(reply.getHeader('content-type') ?? '');
        if (!ct.toLowerCase().startsWith('text/html')) return;
      }

      const h = req.headers;
      const country = (h['cf-ipcountry'] ?? h['x-vercel-ip-country'] ?? h['x-country']) as string | undefined;
      const input: PageHitInput = {
        ts: Date.now(),
        path,
        status: reply.statusCode,
        ip: req.ip,
        ua: String(h['user-agent'] ?? ''),
        referer: h.referer as string | undefined,
        host: h.host as string | undefined,
        country,
        mcp: isMcp,
        botId: typeof h['x-bot-id'] === 'string' ? h['x-bot-id'].slice(0, 100) : null,
        internal: isInternalRequest(req),
      };
      const ids = req.bilkoIds ?? readSessionIds(h.cookie);
      input.sessionId = ids.sessionId;
      input.clientVid = ids.visitorId;
      const token = classifyVisitor(input.ua, { botId: input.botId, mcp: input.mcp }) !== 'human' ? null : sessionCookie(h.cookie);
      // Identity lookup runs detached: the response is already sent, and any
      // failure just records the hit anonymously.
      void (async () => {
        try {
          if (token) input.userEmail = await verifyClerkToken('Bearer ' + token);
        } catch { /* anonymous */ }
        try { recordPageHit(input); } catch { /* never break the server */ }
      })();
    } catch { /* recording must never break a response */ }
  });

  if (opts.flush !== false) void backfillVisitorClass();

  if (opts.flush !== false && !timer) {
    timer = setInterval(() => { void flushPageHits(); }, FLUSH_MS);
    timer.unref?.();
    // Flush before the deploy drain too (see server/egress.ts).
    app.addHook('preClose', async () => { await flushPageHits(); });
    app.addHook('onClose', async () => {
      if (timer) { clearInterval(timer); timer = null; }
      await flushPageHits();
    });
  }
}
