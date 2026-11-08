import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Passthrough db module: dbAll fails only while `dbFail.match` matches the SQL,
// so loadOwnerIds can be driven through a real database error path.
const dbFail = vi.hoisted(() => ({ match: null as RegExp | null }));
vi.mock('../server/db.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/db.js')>();
  const dbAll = (async (sql: string, ...args: unknown[]) => {
    if (dbFail.match?.test(sql)) throw new Error('simulated database failure');
    return original.dbAll(sql, ...args);
  }) as typeof original.dbAll;
  return { ...original, dbAll };
});

import { initDb, dbRun, dbAll, dbGet } from '../server/db.js';
import {
  parseTrafficFilters,
  loadOwnerIds,
  mineExclusionSql,
  mineMatchSql,
  isOwnerRow,
  type OwnerIds,
} from '../server/traffic-filters.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// Fixed clock: loadOwnerIds takes nowMs, so the 30-day window is deterministic.
const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
const COLS = { isAdmin: 'is_admin', hashId: 'visitor_id', cookieId: 'client_vid' };
const IDS: OwnerIds = { hashIds: ['h1', 'h2'], cookieIds: ['c1', 'c2', 'c3'] };
const NONE: OwnerIds = { hashIds: [], cookieIds: [] };

type Seed = { ts: number; isAdmin?: number | null; visitorId?: string | null; clientVid?: string | null };

const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const adminFlag = (s: Seed) => ('isAdmin' in s ? s.isAdmin : 0);

async function hit(s: Seed) {
  await dbRun(
    `INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_id, client_vid, is_admin)
     VALUES (?, ?, '/', 200, 0, ?, ?, ?)`,
    s.ts, day(s.ts), s.visitorId ?? null, s.clientVid ?? null, adminFlag(s),
  );
}

async function click(s: Seed) {
  await dbRun(
    `INSERT INTO click_events (ts_ms, date, path, is_bot, visitor_id, client_vid, is_admin)
     VALUES (?, ?, '/', 0, ?, ?, ?)`,
    s.ts, day(s.ts), s.visitorId ?? null, s.clientVid ?? null, adminFlag(s),
  );
}

// page_views.visitor_id is the bilko_vid cookie id; its clock is created_at_ms (NULL on legacy rows).
async function view(s: { ts: number | null; isAdmin?: number | null; visitorId?: string | null }) {
  await dbRun(
    `INSERT INTO page_views (path, date, visitor_id, is_admin, created_at_ms) VALUES ('/', ?, ?, ?, ?)`,
    day(s.ts ?? NOW), s.visitorId ?? null, 'isAdmin' in s ? s.isAdmin : 0, s.ts,
  );
}

// A device the owner marked as internal on /admin/secrets (bilko_vid cookie id).
async function mark(visitorId: string, markedAtMs: number) {
  await dbRun(
    `INSERT INTO internal_devices (visitor_id, label, marked_at_ms) VALUES (?, NULL, ?)`,
    visitorId, markedAtMs,
  );
}

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  dbFail.match = null;
  await dbRun('DELETE FROM page_hits');
  await dbRun('DELETE FROM click_events');
  await dbRun('DELETE FROM page_views');
  await dbRun('DELETE FROM internal_devices');
});

describe('parseTrafficFilters', () => {
  it('reads mine=exclude and the legacy self=exclude alias', () => {
    expect(parseTrafficFilters({ mine: 'exclude' })).toEqual({ excludeMine: true, excludeBots: false });
    expect(parseTrafficFilters({ self: 'exclude' })).toEqual({ excludeMine: true, excludeBots: false });
    expect(parseTrafficFilters({ mine: 'include', self: 'exclude' })).toEqual({ excludeMine: true, excludeBots: false });
  });

  it('reads bots=exclude, alone or with mine', () => {
    expect(parseTrafficFilters({ bots: 'exclude' })).toEqual({ excludeMine: false, excludeBots: true });
    expect(parseTrafficFilters({ mine: 'exclude', bots: 'exclude', days: '7' })).toEqual({ excludeMine: true, excludeBots: true });
  });

  it('treats junk values, missing keys and a missing query as false', () => {
    const junk: unknown[] = [
      undefined,
      null,
      {},
      { days: '7', slug: 'exclude' },
      { mine: 'include', self: 'include', bots: 'include' },
      { mine: 'EXCLUDE', self: 'Exclude', bots: 'exclude ' },
      { mine: '', self: '', bots: '' },
      { mine: '1', self: 'true', bots: 'yes' },
      { mine: ['exclude'], self: ['exclude'], bots: ['exclude', 'exclude'] },
      { mine: 1, self: true, bots: null },
      'mine=exclude&bots=exclude',
    ];
    for (const q of junk) {
      expect(parseTrafficFilters(q), JSON.stringify(q)).toEqual({ excludeMine: false, excludeBots: false });
    }
  });
});

describe('loadOwnerIds', () => {
  it('returns admin ids from the last 30 days, split into hash and cookie id spaces', async () => {
    // Admin rows inside the window, one per source.
    await hit({ ts: NOW - HOUR, isAdmin: 1, visitorId: 'hash-ph', clientVid: 'cookie-ph' });
    await click({ ts: NOW - 2 * HOUR, isAdmin: 1, visitorId: 'hash-ce', clientVid: 'cookie-ce' });
    await view({ ts: NOW - 3 * HOUR, isAdmin: 1, visitorId: 'cookie-pv' });
    // Admin rows just inside the 30-day edge still count.
    await hit({ ts: NOW - 30 * DAY + MIN, isAdmin: 1, visitorId: 'hash-edge', clientVid: 'cookie-edge' });
    await view({ ts: NOW - 30 * DAY + 2 * MIN, isAdmin: 1, visitorId: 'cookie-pv-edge' });
    // Admin rows older than 30 days.
    await hit({ ts: NOW - 30 * DAY - MIN, isAdmin: 1, visitorId: 'hash-old-ph', clientVid: 'cookie-old-ph' });
    await click({ ts: NOW - 45 * DAY, isAdmin: 1, visitorId: 'hash-old-ce', clientVid: 'cookie-old-ce' });
    await view({ ts: NOW - 31 * DAY, isAdmin: 1, visitorId: 'cookie-old-pv' });
    await view({ ts: null, isAdmin: 1, visitorId: 'cookie-legacy-pv' });
    // Non-admin rows inside the window (0 and legacy NULL).
    await hit({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'hash-stranger-ph', clientVid: 'cookie-stranger-ph' });
    await hit({ ts: NOW - HOUR, isAdmin: null, visitorId: 'hash-legacy-ph', clientVid: 'cookie-legacy-ph' });
    await click({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'hash-stranger-ce', clientVid: 'cookie-stranger-ce' });
    await view({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'cookie-stranger-pv' });
    // Admin rows inside the window with NULL or empty ids.
    await hit({ ts: NOW - MIN, isAdmin: 1, visitorId: null, clientVid: null });
    await hit({ ts: NOW - MIN, isAdmin: 1, visitorId: '', clientVid: '' });
    await click({ ts: NOW - MIN, isAdmin: 1, visitorId: null, clientVid: '' });
    await view({ ts: NOW - MIN, isAdmin: 1, visitorId: null });
    await view({ ts: NOW - MIN, isAdmin: 1, visitorId: '' });

    expect(await loadOwnerIds(NOW)).toEqual({
      hashIds: ['hash-ph', 'hash-ce', 'hash-edge'],
      cookieIds: ['cookie-ph', 'cookie-ce', 'cookie-pv', 'cookie-pv-edge', 'cookie-edge'],
    });
  });

  it('merges an id seen in several sources once, ranked by its latest sighting', async () => {
    await hit({ ts: NOW - 5 * HOUR, isAdmin: 1, visitorId: 'hash-a', clientVid: 'cookie-a' });
    await click({ ts: NOW - HOUR, isAdmin: 1, visitorId: 'hash-a', clientVid: 'cookie-b' });
    await hit({ ts: NOW - 2 * HOUR, isAdmin: 1, visitorId: 'hash-b', clientVid: 'cookie-b' });
    await hit({ ts: NOW - 3 * HOUR, isAdmin: 1, visitorId: 'hash-a', clientVid: 'cookie-c' });
    await view({ ts: NOW - 30 * MIN, isAdmin: 1, visitorId: 'cookie-c' });
    await view({ ts: NOW - 4 * HOUR, isAdmin: 1, visitorId: 'cookie-a' });

    expect(await loadOwnerIds(NOW)).toEqual({
      hashIds: ['hash-a', 'hash-b'],
      cookieIds: ['cookie-c', 'cookie-b', 'cookie-a'],
    });
  });

  it('caps each list at the 500 most recent ids', async () => {
    // 520 distinct admin hits, n minutes ago: h1/c1 is the newest, h520/c520 the oldest.
    await dbRun(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 520)
       INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_id, client_vid, is_admin)
       SELECT ? - n * 60000, '2026-11-07', '/', 200, 0, 'h' || n, 'c' || n, 1 FROM seq`,
      NOW,
    );
    const { hashIds, cookieIds } = await loadOwnerIds(NOW);
    expect(hashIds).toHaveLength(500);
    expect(cookieIds).toHaveLength(500);
    expect(hashIds.slice(0, 3)).toEqual(['h1', 'h2', 'h3']);
    expect(hashIds[499]).toBe('h500');
    expect(cookieIds.slice(0, 3)).toEqual(['c1', 'c2', 'c3']);
    expect(cookieIds[499]).toBe('c500');
    expect(hashIds).not.toContain('h501');
    expect(cookieIds).not.toContain('c501');
  });

  it('defaults nowMs to the current time', async () => {
    const now = Date.now();
    await hit({ ts: now - HOUR, isAdmin: 1, visitorId: 'hash-now', clientVid: 'cookie-now' });
    await hit({ ts: now - 40 * DAY, isAdmin: 1, visitorId: 'hash-then', clientVid: 'cookie-then' });
    expect(await loadOwnerIds()).toEqual({ hashIds: ['hash-now'], cookieIds: ['cookie-now'] });
  });

  it('returns empty lists instead of throwing when the database errors', async () => {
    await hit({ ts: NOW - HOUR, isAdmin: 1, visitorId: 'hash-x', clientVid: 'cookie-x' });
    await view({ ts: NOW - HOUR, isAdmin: 1, visitorId: 'cookie-y' });
    dbFail.match = /./;
    await expect(loadOwnerIds(NOW)).resolves.toEqual({ hashIds: [], cookieIds: [] });
    // A failure confined to one list's query blanks only that list.
    dbFail.match = /page_views/;
    await expect(loadOwnerIds(NOW)).resolves.toEqual({ hashIds: ['hash-x'], cookieIds: [] });
  });
});

describe('loadOwnerIds with marked internal devices', () => {
  it('includes a device marked 90 days ago that has no is_admin rows, in cookieIds only', async () => {
    await hit({ ts: NOW - HOUR, isAdmin: 1, visitorId: 'hash-admin', clientVid: 'cookie-admin' });
    // The marked device has only ever browsed signed out.
    await hit({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'hash-marked', clientVid: 'cookie-marked' });
    await mark('cookie-marked', NOW - 90 * DAY);

    expect(await loadOwnerIds(NOW)).toEqual({
      hashIds: ['hash-admin'],
      cookieIds: ['cookie-admin', 'cookie-marked'],
    });
  });

  it('appends marked ids after the seen ids, newest mark first, without duplicating a seen id', async () => {
    await hit({ ts: NOW - HOUR, isAdmin: 1, visitorId: 'hash-a', clientVid: 'cookie-a' });
    await view({ ts: NOW - 2 * HOUR, isAdmin: 1, visitorId: 'cookie-b' });
    await mark('cookie-b', NOW - 200 * DAY);
    await mark('cookie-old', NOW - 400 * DAY);
    await mark('cookie-new', NOW - 10 * DAY);

    expect(await loadOwnerIds(NOW)).toEqual({
      hashIds: ['hash-a'],
      cookieIds: ['cookie-a', 'cookie-b', 'cookie-new', 'cookie-old'],
    });
  });

  it('keeps every marked id when the seen ids fill the 500 cap, dropping the oldest unmarked ones instead', async () => {
    // 520 distinct admin hits, n minutes ago: c1 is the newest, c520 the oldest.
    await dbRun(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 520)
       INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_id, client_vid, is_admin)
       SELECT ? - n * 60000, '2026-11-07', '/', 200, 0, 'h' || n, 'c' || n, 1 FROM seq`,
      NOW,
    );
    // One marked id is also seen (c10, keeps its place); the other is not seen at all.
    await mark('c10', NOW - 90 * DAY);
    await mark('cookie-marked', NOW - 90 * DAY);

    const { hashIds, cookieIds } = await loadOwnerIds(NOW);
    expect(hashIds).toHaveLength(500);
    expect(cookieIds).toHaveLength(500);
    expect(new Set(cookieIds).size).toBe(500);
    expect(cookieIds.slice(0, 3)).toEqual(['c1', 'c2', 'c3']);
    expect(cookieIds[9]).toBe('c10');
    expect(cookieIds[498]).toBe('c499');
    expect(cookieIds[499]).toBe('cookie-marked');
    expect(cookieIds).not.toContain('c500');
  });

  it('a failing marked-device query leaves the seen lists intact, and the reverse', async () => {
    await hit({ ts: NOW - HOUR, isAdmin: 1, visitorId: 'hash-x', clientVid: 'cookie-x' });
    await mark('cookie-marked', NOW - 90 * DAY);
    await expect(loadOwnerIds(NOW)).resolves.toEqual({ hashIds: ['hash-x'], cookieIds: ['cookie-x', 'cookie-marked'] });

    dbFail.match = /internal_devices/;
    await expect(loadOwnerIds(NOW)).resolves.toEqual({ hashIds: ['hash-x'], cookieIds: ['cookie-x'] });

    dbFail.match = /page_views/;
    await expect(loadOwnerIds(NOW)).resolves.toEqual({ hashIds: ['hash-x'], cookieIds: ['cookie-marked'] });
  });
});

describe('mineExclusionSql', () => {
  it('builds every clause, with args in placeholder order', () => {
    expect(mineExclusionSql(IDS, COLS)).toEqual({
      sql: ' AND COALESCE(is_admin, 0) = 0'
        + ' AND (visitor_id IS NULL OR visitor_id NOT IN (?, ?))'
        + ' AND (client_vid IS NULL OR client_vid NOT IN (?, ?, ?))',
      args: ['h1', 'h2', 'c1', 'c2', 'c3'],
    });
  });

  it('omits an id clause whose list is empty', () => {
    expect(mineExclusionSql({ hashIds: [], cookieIds: ['c1'] }, COLS)).toEqual({
      sql: ' AND COALESCE(is_admin, 0) = 0 AND (client_vid IS NULL OR client_vid NOT IN (?))',
      args: ['c1'],
    });
    expect(mineExclusionSql({ hashIds: ['h1'], cookieIds: [] }, COLS)).toEqual({
      sql: ' AND COALESCE(is_admin, 0) = 0 AND (visitor_id IS NULL OR visitor_id NOT IN (?))',
      args: ['h1'],
    });
    expect(mineExclusionSql(NONE, COLS)).toEqual({ sql: ' AND COALESCE(is_admin, 0) = 0', args: [] });
  });

  it('omits a clause whose column is absent and never binds its ids', () => {
    // page_views: visitor_id holds the cookie id, and there is no hash column.
    expect(mineExclusionSql(IDS, { isAdmin: 'pv.is_admin', cookieId: 'pv.visitor_id' })).toEqual({
      sql: ' AND COALESCE(pv.is_admin, 0) = 0 AND (pv.visitor_id IS NULL OR pv.visitor_id NOT IN (?, ?, ?))',
      args: ['c1', 'c2', 'c3'],
    });
    // sessions: no is_admin column.
    expect(mineExclusionSql(IDS, { cookieId: 'visitor_id' })).toEqual({
      sql: ' AND (visitor_id IS NULL OR visitor_id NOT IN (?, ?, ?))',
      args: ['c1', 'c2', 'c3'],
    });
    expect(mineExclusionSql(IDS, { hashId: 'visitor_id' })).toEqual({
      sql: ' AND (visitor_id IS NULL OR visitor_id NOT IN (?, ?))',
      args: ['h1', 'h2'],
    });
    expect(mineExclusionSql(IDS, {})).toEqual({ sql: '', args: [] });
    expect(mineExclusionSql(NONE, { hashId: 'visitor_id', cookieId: 'client_vid' })).toEqual({ sql: '', args: [] });
  });
});

describe('mineMatchSql', () => {
  it('ORs every clause, with args in placeholder order', () => {
    expect(mineMatchSql(IDS, COLS)).toEqual({
      sql: ' AND (COALESCE(is_admin, 0) = 1 OR visitor_id IN (?, ?) OR client_vid IN (?, ?, ?))',
      args: ['h1', 'h2', 'c1', 'c2', 'c3'],
    });
  });

  it('omits clauses with an empty list or an absent column', () => {
    expect(mineMatchSql({ hashIds: [], cookieIds: ['c1'] }, COLS)).toEqual({
      sql: ' AND (COALESCE(is_admin, 0) = 1 OR client_vid IN (?))',
      args: ['c1'],
    });
    expect(mineMatchSql(IDS, { hashId: 'ph.visitor_id' })).toEqual({
      sql: ' AND (ph.visitor_id IN (?, ?))',
      args: ['h1', 'h2'],
    });
    expect(mineMatchSql(IDS, { cookieId: 'visitor_id' })).toEqual({
      sql: ' AND (visitor_id IN (?, ?, ?))',
      args: ['c1', 'c2', 'c3'],
    });
    expect(mineMatchSql(NONE, COLS)).toEqual({ sql: ' AND (COALESCE(is_admin, 0) = 1)', args: [] });
  });

  it('matches nothing when no clause is left', () => {
    expect(mineMatchSql(NONE, { hashId: 'visitor_id', cookieId: 'client_vid' })).toEqual({ sql: ' AND 0', args: [] });
    expect(mineMatchSql(IDS, {})).toEqual({ sql: ' AND 0', args: [] });
  });
});

describe('SQL builder safety', () => {
  const unsafe = [
    'visitor_id; DROP TABLE page_hits',
    'is_admin)',
    'COALESCE(is_admin, 0)',
    "client_vid'",
    'visitor_id--',
    'col name',
    'a-b',
    '1st_col',
    '.col',
    '',
  ];

  for (const builder of [mineExclusionSql, mineMatchSql]) {
    it(`${builder.name} throws on a column name outside /^[a-z_][a-z0-9_.]*$/i`, () => {
      for (const col of unsafe) {
        expect(() => builder(IDS, { isAdmin: col }), col).toThrow(/column/i);
        expect(() => builder(IDS, { hashId: col }), col).toThrow(/column/i);
        expect(() => builder(IDS, { cookieId: col }), col).toThrow(/column/i);
        // Checked even when an empty id list would drop the clause.
        expect(() => builder(NONE, { hashId: col }), col).toThrow(/column/i);
        expect(() => builder(NONE, { cookieId: col }), col).toThrow(/column/i);
      }
    });

    it(`${builder.name} accepts plain and table-qualified column names`, () => {
      expect(() => builder(IDS, { isAdmin: '_t.is_admin', hashId: 'PH.Visitor_Id', cookieId: 'ce.client_vid2' })).not.toThrow();
    });

    it(`${builder.name} binds ids as parameters and never interpolates them`, () => {
      const hostile: OwnerIds = { hashIds: ["x') OR 1=1 --"], cookieIds: ["'; DROP TABLE page_hits; --"] };
      const { sql, args } = builder(hostile, COLS);
      expect(sql).not.toMatch(/DROP|1=1|'/);
      expect(sql.match(/\?/g)).toHaveLength(2);
      expect(args).toEqual([...hostile.hashIds, ...hostile.cookieIds]);
    });
  }
});

describe('isOwnerRow', () => {
  const ids: OwnerIds = { hashIds: ['h1'], cookieIds: ['c1'] };

  it('is true for a row flagged is_admin', () => {
    expect(isOwnerRow(ids, { isAdmin: 1 })).toBe(true);
    expect(isOwnerRow(ids, { isAdmin: true, hashId: 'stranger', cookieId: null })).toBe(true);
    expect(isOwnerRow(NONE, { isAdmin: 1 })).toBe(true);
  });

  it('is true when either id is in its matching list', () => {
    expect(isOwnerRow(ids, { isAdmin: 0, hashId: 'h1' })).toBe(true);
    expect(isOwnerRow(ids, { isAdmin: null, cookieId: 'c1' })).toBe(true);
    expect(isOwnerRow(ids, { hashId: 'stranger', cookieId: 'c1' })).toBe(true);
  });

  it('is false otherwise, and never matches an id against the other id space', () => {
    expect(isOwnerRow(ids, {})).toBe(false);
    expect(isOwnerRow(ids, { isAdmin: 0, hashId: null, cookieId: null })).toBe(false);
    expect(isOwnerRow(ids, { isAdmin: false, hashId: 'stranger', cookieId: 'stranger' })).toBe(false);
    expect(isOwnerRow(ids, { hashId: 'c1', cookieId: 'h1' })).toBe(false);
    expect(isOwnerRow(NONE, { isAdmin: 0, hashId: 'h1', cookieId: 'c1' })).toBe(false);
  });
});

describe('mine filters against real rows', () => {
  it('a page_hits COUNT(*) with mineExclusionSql drops a signed-out owner hit that shares client_vid with an admin hit', async () => {
    // The owner signed in at home: is_admin = 1.
    await hit({ ts: NOW - 2 * HOUR, isAdmin: 1, visitorId: 'owner-home', clientVid: 'owner-cookie' });
    // Same browser on another network after the Clerk token went stale: is_admin = 0, new hash id, same cookie.
    await hit({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'owner-cafe', clientVid: 'owner-cookie' });
    // Strangers, including a legacy row with no ids and a NULL is_admin.
    await hit({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'stranger', clientVid: 'stranger-cookie' });
    await hit({ ts: NOW - HOUR, isAdmin: null, visitorId: null, clientVid: null });

    const ids = await loadOwnerIds(NOW);
    const count = async (where: { sql: string; args: unknown[] }) =>
      (await dbGet<{ n: number }>(
        `SELECT COUNT(*) AS n FROM page_hits WHERE ts_ms >= ?${where.sql}`,
        NOW - DAY, ...where.args,
      ))?.n;

    expect(await count({ sql: '', args: [] })).toBe(4);
    // Row-level is_admin alone leaks the signed-out owner hit.
    expect(await count({ sql: ' AND COALESCE(is_admin, 0) = 0', args: [] })).toBe(3);
    expect(await count(mineExclusionSql(ids, COLS))).toBe(2);

    const mine = mineMatchSql(ids, COLS);
    const owner = await dbAll<{ visitor_id: string }>(
      `SELECT visitor_id FROM page_hits WHERE 1${mine.sql} ORDER BY ts_ms`,
      ...mine.args,
    );
    expect(owner.map((r) => r.visitor_id)).toEqual(['owner-home', 'owner-cafe']);
  });

  it('drops a signed-out owner page view by its cookie id', async () => {
    await hit({ ts: NOW - 2 * HOUR, isAdmin: 1, visitorId: 'owner-home', clientVid: 'owner-cookie' });
    await view({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'owner-cookie' });
    await view({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'stranger-cookie' });
    await view({ ts: NOW - HOUR, isAdmin: 0, visitorId: null });

    const ids = await loadOwnerIds(NOW);
    const where = mineExclusionSql(ids, { isAdmin: 'is_admin', cookieId: 'visitor_id' });
    const rows = await dbAll<{ visitor_id: string | null }>(
      `SELECT visitor_id FROM page_views WHERE created_at_ms >= ?${where.sql} ORDER BY visitor_id`,
      NOW - DAY, ...where.args,
    );
    expect(rows.map((r) => r.visitor_id)).toEqual([null, 'stranger-cookie']);
  });

  it('drops a signed-out page_hits row carrying a device marked 90 days ago, with no is_admin rows anywhere', async () => {
    await mark('marked-cookie', NOW - 90 * DAY);
    // The marked device browsing signed out: is_admin = 0, and a hash id never seen as admin.
    await hit({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'owner-hash', clientVid: 'marked-cookie' });
    await hit({ ts: NOW - HOUR, isAdmin: 0, visitorId: 'stranger', clientVid: 'stranger-cookie' });
    await hit({ ts: NOW - HOUR, isAdmin: null, visitorId: 'legacy', clientVid: null });

    const kept = async (ids: OwnerIds) => {
      const where = mineExclusionSql(ids, COLS);
      const rows = await dbAll<{ visitor_id: string }>(
        `SELECT visitor_id FROM page_hits WHERE ts_ms >= ?${where.sql} ORDER BY visitor_id`,
        NOW - DAY, ...where.args,
      );
      return rows.map((r) => r.visitor_id);
    };

    const ids = await loadOwnerIds(NOW);
    expect(ids).toEqual({ hashIds: [], cookieIds: ['marked-cookie'] });
    expect(await kept(ids)).toEqual(['legacy', 'stranger']);

    // Unmarked, the same hit counts as a stranger's.
    await dbRun('DELETE FROM internal_devices');
    expect(await kept(await loadOwnerIds(NOW))).toEqual(['legacy', 'owner-hash', 'stranger']);
  });
});
