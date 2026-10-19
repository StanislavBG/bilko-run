// Persistence for the bilko.run Forum: members/handles, threads, posts, the
// "I WAS HERE!" log-book and moderation. User text is stored raw (the React
// client escapes it). No function here ever returns a member's email.
import { randomBytes } from 'node:crypto';
import { dbAll, dbGet, dbRun, dbTransaction, txGet, txRun } from '../db.js';
import {
  FORUM_CAME_VIA,
  FORUM_LIMITS,
  isForumBoardId,
  normalizeHandle,
  validateHandle,
} from '../../shared/forum.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type ForumError = 'invalid' | 'taken' | 'not_found' | 'locked';
export type ForumFail = { ok: false; error: ForumError; msg: string };

export interface ForumMemberRow {
  id: number;
  handle: string;
  created_at: number;
  last_seen_at: number | null;
}

export interface PublicMember {
  no: number;
  handle: string;
  joinedAt: number;
  posts: number;
}

const newId = (prefix: string) => `${prefix}_${randomBytes(8).toString('base64url')}`;
const clampLimit = (n: number | undefined) =>
  Math.min(Math.max(Math.trunc(n ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
const fail = (error: ForumError, msg: string): ForumFail => ({ ok: false, error, msg });

// ── Members ─────────────────────────────────────────────────────────────────

const normEmail = (email: string) => email.trim().toLowerCase();

export async function getMemberByEmail(email: string): Promise<ForumMemberRow | null> {
  const row = await dbGet<ForumMemberRow>(
    'SELECT id, handle, created_at, last_seen_at FROM forum_members WHERE email = ?',
    normEmail(email),
  );
  return row ? { ...row } : null;
}

export async function touchMember(memberId: number, now: number = Date.now()): Promise<void> {
  await dbRun('UPDATE forum_members SET last_seen_at = ? WHERE id = ?', now, memberId);
}

export async function toPublicMember(
  row: { id: number; handle: string; created_at: number },
): Promise<PublicMember> {
  const c = await dbGet<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM forum_posts WHERE member_id = ? AND hidden_at IS NULL)
          + (SELECT COUNT(*) FROM forum_logbook WHERE member_id = ? AND hidden_at IS NULL) AS n`,
    row.id, row.id,
  );
  return { no: Number(row.id), handle: row.handle, joinedAt: Number(row.created_at), posts: Number(c?.n ?? 0) };
}

export async function setHandle(
  email: string,
  handle: string,
  now: number = Date.now(),
): Promise<{ ok: true; member: PublicMember } | ForumFail> {
  const e = normEmail(email);
  const existing = await dbGet<ForumMemberRow>(
    'SELECT id, handle, created_at, last_seen_at FROM forum_members WHERE email = ?',
    e,
  );
  const check = validateHandle(handle, existing?.handle ?? null);
  if (!check.ok) return fail('invalid', check.msg);
  const h = handle.trim();
  const lc = normalizeHandle(h);

  const clash = await dbGet<{ id: number }>(
    'SELECT id FROM forum_members WHERE handle_lc = ? AND email <> ?',
    lc, e,
  );
  if (clash) return fail('taken', `@${h} is taken.`);

  try {
    if (existing) {
      await dbRun('UPDATE forum_members SET handle = ?, handle_lc = ? WHERE id = ?', h, lc, existing.id);
    } else {
      await dbRun(
        'INSERT INTO forum_members (email, handle, handle_lc, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
        e, h, lc, now, now,
      );
    }
  } catch (err) {
    // Lost a race against another claim of the same handle (UNIQUE handle_lc).
    if (/UNIQUE/i.test(String((err as Error)?.message))) return fail('taken', `@${h} is taken.`);
    throw err;
  }
  const row = (await dbGet<ForumMemberRow>(
    'SELECT id, handle, created_at, last_seen_at FROM forum_members WHERE email = ?',
    e,
  ))!;
  return { ok: true, member: await toPublicMember(row) };
}

// ── Reads ───────────────────────────────────────────────────────────────────

export interface ForumIndex {
  logbook: { count: number; preview: LogbookEntry[]; lastAt: number | null };
  brought: { replies: number; tally: { label: string; count: number }[]; lastAt: number | null };
  threads: ForumThreadSummary[];
  newestMember: string | null;
}

export interface ForumThreadSummary {
  id: string;
  title: string;
  board: string;
  starterHandle: string;
  isStarter: boolean;
  replies: number;
  views: number;
  lastByHandle: string;
  lastAt: number;
  isNew: boolean;
}

export interface LogbookEntry {
  no: number;
  id: number;
  handle: string;
  msg: string;
  from: string | null;
  at: number;
}

interface LogRow {
  id: number;
  handle: string;
  msg: string;
  from_place: string | null;
  created_at: number;
  no: number;
}

const toLogEntry = (r: LogRow): LogbookEntry => ({
  no: Number(r.no),
  id: Number(r.id),
  handle: r.handle,
  msg: r.msg,
  from: r.from_place,
  at: Number(r.created_at),
});

// `no` = rank among visible signatures, so 1 is the first ever signature.
const LOG_SELECT = `
  SELECT l.id, m.handle, l.msg, l.from_place, l.created_at,
         (SELECT COUNT(*) FROM forum_logbook x WHERE x.hidden_at IS NULL AND x.id <= l.id) AS no
    FROM forum_logbook l JOIN forum_members m ON m.id = l.member_id
   WHERE l.hidden_at IS NULL`;

export async function listLogbook(
  opts: { before?: number; limit?: number } = {},
): Promise<LogbookEntry[]> {
  const limit = clampLimit(opts.limit);
  const rows =
    opts.before != null
      ? await dbAll<LogRow>(`${LOG_SELECT} AND l.id < ? ORDER BY l.id DESC LIMIT ?`, opts.before, limit)
      : await dbAll<LogRow>(`${LOG_SELECT} ORDER BY l.id DESC LIMIT ?`, limit);
  return rows.map(toLogEntry);
}

export async function getForumIndex(opts: { board?: string; now?: number } = {}): Promise<ForumIndex> {
  const now = opts.now ?? Date.now();

  const logAgg = await dbGet<{ n: number; last: number | null }>(
    'SELECT COUNT(*) AS n, MAX(created_at) AS last FROM forum_logbook WHERE hidden_at IS NULL',
  );
  const preview = await listLogbook({ limit: 3 });

  const broughtRows = await dbAll<{ came: string; n: number; last: number }>(
    `SELECT p.came AS came, COUNT(*) AS n, MAX(p.created_at) AS last
       FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id
      WHERE t.kind = 'brought' AND t.hidden_at IS NULL AND p.hidden_at IS NULL AND p.came IS NOT NULL
      GROUP BY p.came`,
  );
  const byLabel = new Map(broughtRows.map((r) => [r.came, Number(r.n)]));
  const tally = FORUM_CAME_VIA.map((label) => ({ label: label as string, count: byLabel.get(label) ?? 0 }));
  const broughtReplies = broughtRows.reduce((s, r) => s + Number(r.n), 0);
  const broughtLast = broughtRows.reduce<number | null>(
    (m, r) => (m == null || Number(r.last) > m ? Number(r.last) : m),
    null,
  );

  const boardFilter = opts.board && isForumBoardId(opts.board) ? opts.board : null;
  const rows = await dbAll<{
    id: string; title: string; board: string; starter_thread: number; views: number;
    last_post_at: number; starter_handle: string; n: number; last_by: string | null;
  }>(
    `SELECT t.id, t.title, t.board, t.starter_thread, t.views, t.last_post_at,
            sm.handle AS starter_handle,
            (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id AND p.hidden_at IS NULL) AS n,
            (SELECT lm.handle FROM forum_posts lp JOIN forum_members lm ON lm.id = lp.member_id
              WHERE lp.thread_id = t.id AND lp.hidden_at IS NULL
              ORDER BY lp.created_at DESC, lp.rowid DESC LIMIT 1) AS last_by
       FROM forum_threads t JOIN forum_members sm ON sm.id = t.member_id
      WHERE t.pinned = 0 AND t.hidden_at IS NULL AND (? IS NULL OR t.board = ?)
      ORDER BY t.last_post_at DESC`,
    boardFilter, boardFilter,
  );
  const threads: ForumThreadSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    board: r.board,
    starterHandle: r.starter_handle,
    isStarter: Number(r.starter_thread) === 1,
    replies: Math.max(Number(r.n) - 1, 0),
    views: Number(r.views),
    lastByHandle: r.last_by ?? r.starter_handle,
    lastAt: Number(r.last_post_at),
    isNew: now - Number(r.last_post_at) < DAY_MS,
  }));

  const newest = await dbGet<{ handle: string }>('SELECT handle FROM forum_members ORDER BY id DESC LIMIT 1');

  return {
    logbook: { count: Number(logAgg?.n ?? 0), preview, lastAt: logAgg?.last != null ? Number(logAgg.last) : null },
    brought: { replies: broughtReplies, tally, lastAt: broughtLast },
    threads,
    newestMember: newest?.handle ?? null,
  };
}

export interface ForumPost {
  id: string;
  body: string;
  came: string | null;
  at: number;
  author: PublicMember;
}

export interface ForumThread {
  id: string;
  kind: string;
  board: string;
  title: string;
  lede: string | null;
  pinned: boolean;
  isStarter: boolean;
  views: number;
  createdAt: number;
  lastAt: number;
  starterHandle: string;
  posts: ForumPost[];
  earlier: number;
}

/** Visible posts oldest-first: the newest `limit` posts created before `before`. */
export async function getThread(
  id: string,
  opts: { before?: number; limit?: number } = {},
): Promise<ForumThread | null> {
  const t = await dbGet<{
    id: string; kind: string; board: string; title: string; lede: string | null; pinned: number;
    starter_thread: number; views: number; created_at: number; last_post_at: number; starter_handle: string;
  }>(
    `SELECT t.id, t.kind, t.board, t.title, t.lede, t.pinned, t.starter_thread, t.views,
            t.created_at, t.last_post_at, m.handle AS starter_handle
       FROM forum_threads t JOIN forum_members m ON m.id = t.member_id
      WHERE t.id = ? AND t.hidden_at IS NULL`,
    id,
  );
  if (!t) return null;

  const limit = clampLimit(opts.limit);
  const before = opts.before ?? Number.MAX_SAFE_INTEGER;
  const rows = (
    await dbAll<{
      id: string; body: string; came: string | null; created_at: number;
      mid: number; handle: string; m_created: number;
    }>(
      `SELECT p.id, p.body, p.came, p.created_at, m.id AS mid, m.handle, m.created_at AS m_created
         FROM forum_posts p JOIN forum_members m ON m.id = p.member_id
        WHERE p.thread_id = ? AND p.hidden_at IS NULL AND p.created_at < ?
        ORDER BY p.created_at DESC, p.rowid DESC LIMIT ?`,
      id, before, limit,
    )
  ).reverse();

  const authors = new Map<number, PublicMember>();
  for (const r of rows) {
    const mid = Number(r.mid);
    if (!authors.has(mid)) authors.set(mid, await toPublicMember({ id: mid, handle: r.handle, created_at: r.m_created }));
  }

  const oldest = rows[0] ? Number(rows[0].created_at) : before;
  const earlierRow = await dbGet<{ n: number }>(
    'SELECT COUNT(*) AS n FROM forum_posts WHERE thread_id = ? AND hidden_at IS NULL AND created_at < ?',
    id, oldest,
  );

  return {
    id: t.id,
    kind: t.kind,
    board: t.board,
    title: t.title,
    lede: t.lede,
    pinned: Number(t.pinned) === 1,
    isStarter: Number(t.starter_thread) === 1,
    views: Number(t.views),
    createdAt: Number(t.created_at),
    lastAt: Number(t.last_post_at),
    starterHandle: t.starter_handle,
    posts: rows.map((r) => ({
      id: r.id,
      body: r.body,
      came: r.came,
      at: Number(r.created_at),
      author: authors.get(Number(r.mid))!,
    })),
    earlier: rows.length ? Number(earlierRow?.n ?? 0) : 0,
  };
}

export async function incrementViews(id: string): Promise<void> {
  await dbRun('UPDATE forum_threads SET views = views + 1 WHERE id = ? AND hidden_at IS NULL', id);
}

// ── Writes ──────────────────────────────────────────────────────────────────

export async function createThread(
  memberId: number,
  input: { board: string; title: string; body: string },
  now: number = Date.now(),
): Promise<{ ok: true; id: string } | ForumFail> {
  if (!isForumBoardId(input.board)) return fail('invalid', 'Pick a board.');
  const title = String(input.title ?? '').trim();
  const body = String(input.body ?? '').trim();
  if (title.length < FORUM_LIMITS.titleMin || title.length > FORUM_LIMITS.titleMax) {
    return fail('invalid', `Title must be ${FORUM_LIMITS.titleMin}–${FORUM_LIMITS.titleMax} characters.`);
  }
  if (body.length < 1 || body.length > FORUM_LIMITS.bodyMax) {
    return fail('invalid', `Post must be 1–${FORUM_LIMITS.bodyMax} characters.`);
  }
  const threadId = newId('t');
  await dbTransaction(async (tx) => {
    await txRun(
      tx,
      `INSERT INTO forum_threads (id, kind, board, title, member_id, created_at, last_post_at)
       VALUES (?, 'classic', ?, ?, ?, ?, ?)`,
      threadId, input.board, title, memberId, now, now,
    );
    await txRun(
      tx,
      'INSERT INTO forum_posts (id, thread_id, member_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
      newId('p'), threadId, memberId, body, now,
    );
  });
  return { ok: true, id: threadId };
}

export async function addPost(
  memberId: number,
  threadId: string,
  input: { body: string; came?: string | null },
  now: number = Date.now(),
): Promise<{ ok: true; id: string } | ForumFail> {
  const body = String(input.body ?? '').trim();
  if (body.length < 1 || body.length > FORUM_LIMITS.bodyMax) {
    return fail('invalid', `Post must be 1–${FORUM_LIMITS.bodyMax} characters.`);
  }
  const postId = newId('p');
  return dbTransaction(async (tx): Promise<{ ok: true; id: string } | ForumFail> => {
    const t = await txGet<{ kind: string; hidden_at: number | null }>(
      tx, 'SELECT kind, hidden_at FROM forum_threads WHERE id = ?', threadId,
    );
    if (!t || t.hidden_at != null) return fail('not_found', 'No such thread.');
    if (t.kind === 'logbook') return fail('locked', 'The log-book takes signatures, not replies.');
    let came: string | null = null;
    if (t.kind === 'brought') {
      if (!(FORUM_CAME_VIA as readonly string[]).includes(String(input.came))) {
        return fail('invalid', 'Pick where you came from.');
      }
      came = String(input.came);
    }
    await txRun(
      tx,
      'INSERT INTO forum_posts (id, thread_id, member_id, body, came, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      postId, threadId, memberId, body, came, now,
    );
    await txRun(tx, 'UPDATE forum_threads SET last_post_at = MAX(last_post_at, ?) WHERE id = ?', now, threadId);
    return { ok: true, id: postId };
  });
}

export async function signLogbook(
  memberId: number,
  input: { msg: string; from?: string | null },
  now: number = Date.now(),
): Promise<{ ok: true; id: number } | ForumFail> {
  const msg = String(input.msg ?? '').trim();
  const from = String(input.from ?? '').trim();
  if (msg.length < 1 || msg.length > FORUM_LIMITS.logMsgMax) {
    return fail('invalid', `Say something in 1–${FORUM_LIMITS.logMsgMax} characters.`);
  }
  if (from.length > FORUM_LIMITS.logFromMax) {
    return fail('invalid', `"From" is at most ${FORUM_LIMITS.logFromMax} characters.`);
  }
  const r = await dbRun(
    'INSERT INTO forum_logbook (member_id, msg, from_place, created_at) VALUES (?, ?, ?, ?)',
    memberId, msg, from || null, now,
  );
  return { ok: true, id: r.lastInsertRowid };
}

const HIDE_TABLES = { thread: 'forum_threads', post: 'forum_posts', logbook: 'forum_logbook' } as const;

/** Soft-hide (or restore) a row. Returns whether a row matched. */
export async function setHidden(
  kind: 'thread' | 'post' | 'logbook',
  id: string | number,
  hidden: boolean,
  now: number = Date.now(),
): Promise<boolean> {
  const table = HIDE_TABLES[kind];
  if (!table) return false;
  const r = await dbRun(`UPDATE ${table} SET hidden_at = ? WHERE id = ?`, hidden ? now : null, id);
  return r.changes > 0;
}

// ── Launch-day seed ─────────────────────────────────────────────────────────

const SEED_BROUGHT_OPENER =
  "Roll call. How did you end up here? A link, a friend, a wrong turn — all valid.\n" +
  "Pick a tag when you reply so I can stop guessing what's working.";
const SEED_SM_OPENER =
  'Home thread for Session Manager, the desktop cockpit for Claude Code.\n' +
  'Post your setup, the screen that confused you, or the Field Manual chapter that needs a rewrite. Mac, Windows and Linux all welcome.';

/** Idempotent: safe on every boot. Seeds @bilko plus the three launch-day threads, nothing else. */
export async function ensureForumSeed(hostEmail: string, now: number = Date.now()): Promise<void> {
  const email = normEmail(hostEmail);
  await dbRun(
    `INSERT OR IGNORE INTO forum_members (email, handle, handle_lc, created_at, last_seen_at)
     VALUES (?, 'bilko', 'bilko', ?, ?)`,
    email, now, now,
  );
  const host = await dbGet<{ id: number }>('SELECT id FROM forum_members WHERE email = ?', email);
  if (!host) throw new Error('ensureForumSeed: could not create the host member (handle "bilko" already in use?)');
  const hid = Number(host.id);

  const threads: Array<{
    id: string; kind: string; board: string; title: string; lede: string | null;
    pinned: number; starter: number; opener?: string;
  }> = [
    {
      id: 'log', kind: 'logbook', board: 'porch', title: 'I WAS HERE!',
      lede: 'The log-book. One line, no replies, newest on top. Sign it once or every time you stop by.',
      pinned: 1, starter: 0,
    },
    {
      id: 'brought', kind: 'brought', board: 'porch', title: 'What brought you here?',
      lede: 'Roll call. Tag where you came from, then tell the story if there is one.',
      pinned: 1, starter: 0, opener: SEED_BROUGHT_OPENER,
    },
    {
      id: 'sm', kind: 'classic', board: 'tools', title: 'Session Manager — setups, questions, field notes',
      lede: null, pinned: 0, starter: 1, opener: SEED_SM_OPENER,
    },
  ];
  for (const t of threads) {
    const ins = await dbRun(
      `INSERT OR IGNORE INTO forum_threads
         (id, kind, board, title, lede, pinned, starter_thread, member_id, created_at, last_post_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.id, t.kind, t.board, t.title, t.lede, t.pinned, t.starter, hid, now, now,
    );
    if (ins.changes > 0 && t.opener) {
      await dbRun(
        'INSERT OR IGNORE INTO forum_posts (id, thread_id, member_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
        `${t.id}-open`, t.id, hid, t.opener, now,
      );
    }
  }
}
