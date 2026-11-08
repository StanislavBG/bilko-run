// Owner (MINE) and bot filters for the admin traffic console. Owner identity follows the visitor ids ever seen signed in
// as admin, because row-level is_admin misses the owner's signed-out or stale-token hits (Clerk __session JWTs last ~60 s),
// plus every device the owner marked as internal on /admin/secrets (internal_devices), however long since it signed in.
import { dbAll } from './db.js';

export interface TrafficFilters {
  excludeMine: boolean;
  excludeBots: boolean;
}

/**
 * The owner's visitor ids, one list per id space: ids seen on is_admin rows in the last 30 days, most recent first;
 * cookieIds then appends every marked internal device not already listed, with no time window.
 */
export interface OwnerIds {
  /** stableVisitorId(ip, ua) hashes: page_hits.visitor_id and click_events.visitor_id. */
  hashIds: string[];
  /** bilko_vid cookie ids: page_hits/click_events.client_vid and page_views/sessions/funnel_events/app_errors.visitor_id. */
  cookieIds: string[];
}

/** The query's column for each owner signal; an absent column drops that clause. */
export interface MineColumns {
  isAdmin?: string;
  hashId?: string;
  cookieId?: string;
}

/** A WHERE fragment starting with ' AND ', plus its bound args in placeholder order. */
export interface SqlFragment {
  sql: string;
  args: string[];
}

export interface OwnerRow {
  isAdmin?: boolean | number | null;
  hashId?: string | null;
  cookieId?: string | null;
}

const OWNER_WINDOW_MS = 30 * 86_400_000;
const OWNER_ID_CAP = 500;
// Column names are interpolated (identifiers cannot be bound), so only plain or table-qualified names pass.
const SAFE_COLUMN = /^[a-z_][a-z0-9_.]*$/i;

const HASH_IDS_SQL = `SELECT id FROM (
    SELECT visitor_id AS id, ts_ms AS ts FROM page_hits
      WHERE ts_ms >= ? AND is_admin = 1 AND visitor_id IS NOT NULL AND visitor_id <> ''
    UNION ALL
    SELECT visitor_id AS id, ts_ms AS ts FROM click_events
      WHERE ts_ms >= ? AND is_admin = 1 AND visitor_id IS NOT NULL AND visitor_id <> ''
  ) GROUP BY id ORDER BY MAX(ts) DESC, id LIMIT ?`;

const COOKIE_IDS_SQL = `SELECT id FROM (
    SELECT client_vid AS id, ts_ms AS ts FROM page_hits
      WHERE ts_ms >= ? AND is_admin = 1 AND client_vid IS NOT NULL AND client_vid <> ''
    UNION ALL
    SELECT client_vid AS id, ts_ms AS ts FROM click_events
      WHERE ts_ms >= ? AND is_admin = 1 AND client_vid IS NOT NULL AND client_vid <> ''
    UNION ALL
    SELECT visitor_id AS id, created_at_ms AS ts FROM page_views
      WHERE created_at_ms >= ? AND is_admin = 1 AND visitor_id IS NOT NULL AND visitor_id <> ''
  ) GROUP BY id ORDER BY MAX(ts) DESC, id LIMIT ?`;

// bilko_vid cookie ids the owner marked as internal (server/routes/admin-internal-device.ts), newest mark first, any age.
const MARKED_IDS_SQL = `SELECT visitor_id AS id FROM internal_devices
  WHERE visitor_id IS NOT NULL AND visitor_id <> ''
  ORDER BY marked_at_ms DESC, visitor_id LIMIT ?`;

/** Reads the console's toggles from a raw query object; anything but the exact string 'exclude' is false. */
export function parseTrafficFilters(q: unknown): TrafficFilters {
  const p = q !== null && typeof q === 'object' ? (q as Record<string, unknown>) : {};
  return {
    // `self` is the legacy alias. traffic_report now sends mine/bots; the alias stays for older bilko-host MCP builds.
    excludeMine: p.mine === 'exclude' || p.self === 'exclude',
    excludeBots: p.bots === 'exclude',
  };
}

/**
 * Owner visitor ids from the last 30 days, plus every marked internal device in cookieIds.
 * A query that fails contributes no ids and leaves the others' intact; this never throws.
 */
export async function loadOwnerIds(nowMs: number = Date.now()): Promise<OwnerIds> {
  const since = nowMs - OWNER_WINDOW_MS;
  const [hashIds, seenCookieIds, markedIds] = await Promise.all([
    idList(HASH_IDS_SQL, since, since, OWNER_ID_CAP),
    idList(COOKIE_IDS_SQL, since, since, since, OWNER_ID_CAP),
    idList(MARKED_IDS_SQL, OWNER_ID_CAP),
  ]);
  return { hashIds, cookieIds: appendMarked(seenCookieIds, markedIds, OWNER_ID_CAP) };
}

/**
 * Appends the marked ids not already in `seen`, keeping the result unique and within `cap`. When it would overflow, the
 * least recently seen unmarked ids give way, so every marked id stays (a marked id that was seen keeps its place).
 */
function appendMarked(seen: string[], marked: string[], cap: number): string[] {
  if (!marked.length) return seen;
  const markedSet = new Set(marked);
  let room = cap - markedSet.size;
  const out: string[] = [];
  for (const id of seen) {
    if (markedSet.has(id)) out.push(id);
    else if (room > 0) {
      out.push(id);
      room--;
    }
  }
  const listed = new Set(out);
  for (const id of markedSet) if (!listed.has(id)) out.push(id);
  return out;
}

async function idList(sql: string, ...args: number[]): Promise<string[]> {
  try {
    const rows = await dbAll<{ id: string }>(sql, ...args);
    return rows.map((r) => String(r.id));
  } catch {
    return [];
  }
}

function checkColumn(name: string | undefined): string | undefined {
  if (name !== undefined && !SAFE_COLUMN.test(name)) {
    throw new Error(`traffic-filters: unsafe column name ${JSON.stringify(name)}`);
  }
  return name;
}

/** Validates every column, then pairs each present id column with its non-empty id list. */
function ownerSignals(ids: OwnerIds, cols: MineColumns): { isAdmin?: string; idCols: Array<[string, string[]]> } {
  const isAdmin = checkColumn(cols.isAdmin);
  const hashId = checkColumn(cols.hashId);
  const cookieId = checkColumn(cols.cookieId);
  const idCols: Array<[string, string[]]> = [];
  if (hashId && ids.hashIds.length) idCols.push([hashId, ids.hashIds]);
  if (cookieId && ids.cookieIds.length) idCols.push([cookieId, ids.cookieIds]);
  return { isAdmin, idCols };
}

const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(', ');

/** WHERE fragment that drops the owner's rows: not is_admin and neither id in its owner list (NULL ids are kept). */
export function mineExclusionSql(ids: OwnerIds, cols: MineColumns): SqlFragment {
  const { isAdmin, idCols } = ownerSignals(ids, cols);
  let sql = isAdmin ? ` AND COALESCE(${isAdmin}, 0) = 0` : '';
  const args: string[] = [];
  for (const [col, list] of idCols) {
    sql += ` AND (${col} IS NULL OR ${col} NOT IN (${placeholders(list.length)}))`;
    args.push(...list);
  }
  return { sql, args };
}

/** WHERE fragment that keeps only the owner's rows; with no usable signal it matches nothing. */
export function mineMatchSql(ids: OwnerIds, cols: MineColumns): SqlFragment {
  const { isAdmin, idCols } = ownerSignals(ids, cols);
  const ors = isAdmin ? [`COALESCE(${isAdmin}, 0) = 1`] : [];
  const args: string[] = [];
  for (const [col, list] of idCols) {
    ors.push(`${col} IN (${placeholders(list.length)})`);
    args.push(...list);
  }
  return ors.length ? { sql: ` AND (${ors.join(' OR ')})`, args } : { sql: ' AND 0', args: [] };
}

/** In-memory twin of mineMatchSql for rows already fetched. */
export function isOwnerRow(ids: OwnerIds, row: OwnerRow): boolean {
  if (row.isAdmin) return true;
  if (row.hashId && ids.hashIds.includes(row.hashId)) return true;
  return !!row.cookieId && ids.cookieIds.includes(row.cookieId);
}
