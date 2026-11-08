// Owner (MINE) and bot filters for the admin traffic console. Owner identity follows the visitor ids ever seen signed in
// as admin, because row-level is_admin misses the owner's signed-out or stale-token hits (Clerk __session JWTs last ~60 s).
import { dbAll } from './db.js';

export interface TrafficFilters {
  excludeMine: boolean;
  excludeBots: boolean;
}

/** Visitor ids seen on is_admin rows in the last 30 days, one list per id space, most recent first. */
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

/** Reads the console's toggles from a raw query object; anything but the exact string 'exclude' is false. */
export function parseTrafficFilters(q: unknown): TrafficFilters {
  const p = q !== null && typeof q === 'object' ? (q as Record<string, unknown>) : {};
  return {
    // `self` is the legacy alias that mcp-host-server's traffic_report still sends.
    excludeMine: p.mine === 'exclude' || p.self === 'exclude',
    excludeBots: p.bots === 'exclude',
  };
}

/** Owner visitor ids from the last 30 days. A list whose query fails comes back empty; this never throws. */
export async function loadOwnerIds(nowMs: number = Date.now()): Promise<OwnerIds> {
  const since = nowMs - OWNER_WINDOW_MS;
  const [hashIds, cookieIds] = await Promise.all([
    idList(HASH_IDS_SQL, since, since, OWNER_ID_CAP),
    idList(COOKIE_IDS_SQL, since, since, since, OWNER_ID_CAP),
  ]);
  return { hashIds, cookieIds };
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
