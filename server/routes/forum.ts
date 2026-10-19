import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { ADMIN_EMAILS, requireAdmin, requireAuth, verifyClerkToken } from '../clerk.js';
import { hashIp } from './tools/_shared.js';
import { normalizeHandle, validateHandle } from '../../shared/forum.js';
import {
  addPost,
  createThread,
  ensureForumSeed,
  getForumIndex,
  getMemberByEmail,
  getThread,
  incrementViews,
  listLogbook,
  setHandle,
  setHidden,
  signLogbook,
  toPublicMember,
  touchMember,
  type ForumFail,
  type ForumMemberRow,
} from '../services/forum.js';

// Site-level Forum API (/forum in the React app). Public reads, Clerk sign-in
// plus a forum handle for every write, admin-only moderation. Nothing here ever
// puts an email in a response body. Timestamps are epoch-ms; the client formats.
//
//   GET  /api/forum/index[?board=]          GET  /api/forum/threads/:id[?before=]
//   GET  /api/forum/logbook[?before=&limit=] GET  /api/forum/me
//   POST /api/forum/handle                  GET  /api/forum/handle-check?handle=
//   POST /api/forum/logbook                 POST /api/forum/threads
//   POST /api/forum/threads/:id/posts       POST /api/forum/moderate

const BODY_LIMIT = 32 * 1024;
const ONLINE_WINDOW_MS = 10 * 60_000;
const VIEW_WINDOW_MS = 60 * 60_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;
const WRITES_PER_MINUTE = 6;
const WRITES_PER_DAY = 60;
const CHECKS_PER_MINUTE = 30;
const LOGBOOK_PAGE_MAX = 50;
const MAP_CAP = 20_000;
const RENAMES_PER_DAY = 3;

// In-process abuse damping and presence. A restart resetting these is harmless.
const lurkerSeen = new Map<string, number>(); // ipHash -> last forum GET
const viewSeen = new Map<string, number>(); // `${ipHash}:${threadId}` -> last counted view
const writeLog = new Map<number, number[]>(); // memberId -> write timestamps (last 24h)
const checkLog = new Map<string, number[]>(); // ipHash -> handle-check timestamps
const renameLog = new Map<number, number[]>(); // memberId -> successful rename timestamps (last 24h)

function prune(map: Map<string, number>, windowMs: number, now: number): void {
  if (map.size <= MAP_CAP) return;
  for (const [k, t] of map) if (now - t > windowMs) map.delete(k);
  if (map.size > MAP_CAP) map.clear();
}

function writeLimited(memberId: number, now: number): boolean {
  const recent = (writeLog.get(memberId) ?? []).filter((t) => now - t < DAY_MS);
  const lastMinute = recent.filter((t) => now - t < MINUTE_MS).length;
  if (lastMinute >= WRITES_PER_MINUTE || recent.length >= WRITES_PER_DAY) {
    writeLog.set(memberId, recent);
    return true;
  }
  recent.push(now);
  writeLog.set(memberId, recent);
  if (writeLog.size > MAP_CAP) writeLog.clear();
  return false;
}

function recentRenames(memberId: number, now: number): number[] {
  return (renameLog.get(memberId) ?? []).filter((t) => now - t < DAY_MS);
}

function recordRename(memberId: number, now: number): void {
  const recent = recentRenames(memberId, now);
  recent.push(now);
  renameLog.set(memberId, recent);
  if (renameLog.size > MAP_CAP) renameLog.clear();
}

function checkLimited(ipHash: string, now: number): boolean {
  const recent = (checkLog.get(ipHash) ?? []).filter((t) => now - t < MINUTE_MS);
  recent.push(now);
  checkLog.set(ipHash, recent);
  if (checkLog.size > MAP_CAP) checkLog.clear();
  return recent.length > CHECKS_PER_MINUTE;
}

const intParam = (v: unknown): number | undefined => {
  if (typeof v !== 'string' || !/^\d{1,16}$/.test(v)) return undefined;
  return Number(v);
};

const statusFor = (f: ForumFail) => (f.error === 'not_found' ? 404 : f.error === 'taken' || f.error === 'locked' ? 409 : 400);

const suggest = (h: string) => `@${h} is taken. Try @${h}_${10 + Math.floor(Math.random() * 90)}?`;

export function registerForumRoutes(app: FastifyInstance): void {
  app.addHook('onReady', async () => {
    try {
      await ensureForumSeed(ADMIN_EMAILS[0]);
    } catch (err) {
      app.log.error({ err }, 'forum seed failed');
    }
  });

  // Lurker tracking: distinct hashed IPs that hit any forum GET.
  app.addHook('onRequest', async (req) => {
    if (req.method !== 'GET' || !req.url.startsWith('/api/forum/')) return;
    const now = Date.now();
    lurkerSeen.set(hashIp(req.ip), now);
    prune(lurkerSeen, ONLINE_WINDOW_MS, now);
  });

  /** Resolve the signed-in member or reply 401/403. */
  async function requireMember(req: any, reply: any): Promise<ForumMemberRow | null> {
    const email = await requireAuth(req, reply);
    if (!email) return null;
    const member = await getMemberByEmail(email);
    if (!member) {
      reply.status(403).send({ error: 'Pick a forum handle first.', code: 'needs_handle' });
      return null;
    }
    return member;
  }

  function throttle(member: ForumMemberRow, reply: any): boolean {
    if (writeLimited(member.id, Date.now())) {
      reply.status(429).send({ error: 'Slow down — you are posting too fast. Try again in a bit.' });
      return true;
    }
    return false;
  }

  // ── Public reads ──────────────────────────────────────────────────────────

  app.get('/api/forum/index', async (req) => {
    const { board } = req.query as { board?: string };
    const now = Date.now();
    const index = await getForumIndex({ board: typeof board === 'string' ? board : undefined, now });
    const rows = await dbAll<{ handle: string }>(
      'SELECT handle FROM forum_members WHERE last_seen_at >= ? ORDER BY last_seen_at DESC LIMIT 50',
      now - ONLINE_WINDOW_MS,
    );
    const handles = rows.map((r) => r.handle);
    let ips = 0;
    for (const t of lurkerSeen.values()) if (now - t < ONLINE_WINDOW_MS) ips++;
    return { ...index, online: { handles, lurkers: Math.max(ips - handles.length, 0) } };
  });

  app.get('/api/forum/threads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { before } = req.query as { before?: string };
    const thread = await getThread(id, { before: intParam(before) });
    if (!thread) return reply.status(404).send({ error: 'No such thread.' });
    const now = Date.now();
    const key = `${hashIp(req.ip)}:${id}`;
    const last = viewSeen.get(key);
    if (last == null || now - last >= VIEW_WINDOW_MS) {
      viewSeen.set(key, now);
      prune(viewSeen, VIEW_WINDOW_MS, now);
      await incrementViews(id);
    }
    return thread;
  });

  app.get('/api/forum/logbook', async (req) => {
    const q = req.query as { before?: string; limit?: string };
    const limit = Math.min(intParam(q.limit) ?? LOGBOOK_PAGE_MAX, LOGBOOK_PAGE_MAX);
    return { entries: await listLogbook({ before: intParam(q.before), limit: Math.max(limit, 1) }) };
  });

  // ── Identity ──────────────────────────────────────────────────────────────

  app.get('/api/forum/me', async (req) => {
    const email = await verifyClerkToken(req.headers.authorization);
    if (!email) return { member: null, signedIn: false };
    const row = await getMemberByEmail(email);
    if (row) await touchMember(row.id);
    return {
      signedIn: true,
      member: row ? await toPublicMember(row) : null,
      isHost: ADMIN_EMAILS.includes(email.toLowerCase()),
    };
  });

  app.get('/api/forum/handle-check', async (req, reply) => {
    if (checkLimited(hashIp(req.ip), Date.now())) {
      return reply.status(429).send({ ok: false, msg: 'Too many checks — wait a moment.', tone: 'bad' });
    }
    const { handle } = req.query as { handle?: string };
    const raw = typeof handle === 'string' ? handle : '';
    const email = await verifyClerkToken(req.headers.authorization);
    const mine = email ? await getMemberByEmail(email) : null;
    const check = validateHandle(raw, mine?.handle ?? null);
    if (!check.ok || check.reason === 'same') return { ok: check.ok, msg: check.msg, tone: check.tone };
    const clash = await dbGet<{ id: number }>(
      'SELECT id FROM forum_members WHERE handle_lc = ?',
      normalizeHandle(raw),
    );
    if (clash) return { ok: false, msg: suggest(raw.trim()), tone: 'bad' };
    return { ok: check.ok, msg: check.msg, tone: check.tone };
  });

  app.post('/api/forum/handle', { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const handle = (req.body as { handle?: unknown } | null)?.handle;
    if (typeof handle !== 'string') return reply.status(400).send({ error: 'Pick a handle.' });
    // Only a real rename (member already has a different handle) is throttled; first claim is free.
    const existing = await getMemberByEmail(email);
    const isRename = !!existing && normalizeHandle(handle) !== normalizeHandle(existing.handle);
    if (existing && isRename && recentRenames(existing.id, Date.now()).length >= RENAMES_PER_DAY) {
      return reply.status(429).send({ error: 'You can change your handle 3 times a day. Try again tomorrow.' });
    }
    const r = await setHandle(email, handle);
    if (r.ok && existing && isRename) recordRename(existing.id, Date.now());
    if (!r.ok) {
      if (r.error === 'taken') return reply.status(409).send({ error: suggest(handle.trim()) });
      return reply.status(400).send({ error: r.msg });
    }
    return { member: r.member };
  });

  // ── Writes ────────────────────────────────────────────────────────────────

  app.post('/api/forum/logbook', { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    const member = await requireMember(req, reply);
    if (!member || throttle(member, reply)) return;
    const b = (req.body ?? {}) as { msg?: unknown; from?: unknown };
    const r = await signLogbook(member.id, {
      msg: typeof b.msg === 'string' ? b.msg : '',
      from: typeof b.from === 'string' ? b.from : '',
    });
    if (!r.ok) return reply.status(statusFor(r)).send({ error: r.msg });
    await touchMember(member.id);
    return reply.status(201).send({ id: r.id });
  });

  app.post('/api/forum/threads', { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    const member = await requireMember(req, reply);
    if (!member || throttle(member, reply)) return;
    const b = (req.body ?? {}) as { board?: unknown; title?: unknown; body?: unknown };
    const r = await createThread(member.id, {
      board: typeof b.board === 'string' ? b.board : '',
      title: typeof b.title === 'string' ? b.title : '',
      body: typeof b.body === 'string' ? b.body : '',
    });
    if (!r.ok) return reply.status(statusFor(r)).send({ error: r.msg });
    await touchMember(member.id);
    return reply.status(201).send({ id: r.id });
  });

  app.post('/api/forum/threads/:id/posts', { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    const member = await requireMember(req, reply);
    if (!member || throttle(member, reply)) return;
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { body?: unknown; came?: unknown };
    const r = await addPost(member.id, id, {
      body: typeof b.body === 'string' ? b.body : '',
      came: typeof b.came === 'string' ? b.came : null,
    });
    if (!r.ok) return reply.status(statusFor(r)).send({ error: r.msg });
    await touchMember(member.id);
    return reply.status(201).send({ id: r.id });
  });

  // ── Moderation ────────────────────────────────────────────────────────────

  app.post('/api/forum/moderate', { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const b = (req.body ?? {}) as { kind?: unknown; id?: unknown; hidden?: unknown };
    if (b.kind !== 'thread' && b.kind !== 'post' && b.kind !== 'logbook') {
      return reply.status(400).send({ error: 'kind must be thread, post or logbook.' });
    }
    if (typeof b.hidden !== 'boolean') return reply.status(400).send({ error: 'hidden must be true or false.' });
    const id = b.kind === 'logbook' ? Number(b.id) : b.id;
    if (b.kind === 'logbook' ? !Number.isInteger(id) : typeof id !== 'string' || !id) {
      return reply.status(400).send({ error: 'Bad id.' });
    }
    const found = await setHidden(b.kind, id as string | number, b.hidden);
    if (!found) return reply.status(404).send({ error: 'Nothing matched that id.' });
    return { ok: true };
  });
}
