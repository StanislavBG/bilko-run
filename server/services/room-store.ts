import { dbAll, dbGet, dbRun, dbTransaction, txRun } from '../db.js';

/**
 * Durable store for live realtime tables, so a table survives a bilko.run restart or deploy.
 *
 * Ownership is a lease: `owner` (an opaque per-process id, e.g. RENDER_INSTANCE_ID) plus
 * `heartbeat_at` (ms). The owner calls heartbeatTables on an interval and suspendTables on
 * shutdown. Another instance takes a table only through claimTable, which wins only when the
 * row is suspended or its heartbeat is older than `staleMs`. Render runs old and new instances
 * side by side for ~60 s per deploy, so saveTable is fenced too: it writes only when the row
 * is new or still owned by `row.owner`, so a stale instance cannot overwrite a claimed table.
 */

export type RoomTableStatus = 'active' | 'suspended';

export interface RoomTableRow {
  id: string;
  app: string;
  tier: string;
  status: RoomTableStatus;
  owner: string | null;
  /** Last owner heartbeat, epoch ms. */
  heartbeatAt: number;
  hand: number;
  dealer: number;
  /** Seat (as a string key) to player email. */
  seats: Record<string, string>;
  /** Escrow bookkeeping for the current hand; stored as JSON, shape owned by the room module. */
  escrowed: unknown;
  /** Serialized game state, or null when none is kept. */
  snapshot: unknown | null;
}

export interface StoredRoomTable extends RoomTableRow {
  /** Last write, epoch ms. */
  updatedAt: number;
}

interface DbRow {
  id: string; app: string; tier: string; status: string; owner: string | null;
  heartbeat_at: number; hand: number; dealer: number; seats: string; escrowed: string;
  snapshot: string | null; updated_at: number;
}

const normEmail = (email: string) => String(email).trim().toLowerCase();

// A local libSQL file allows one open write transaction per process; serialize writes in-process.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn);
  writeQueue = run.catch(() => undefined);
  return run;
}

function fromDb(r: DbRow): StoredRoomTable {
  return {
    id: String(r.id),
    app: String(r.app),
    tier: String(r.tier),
    status: r.status === 'suspended' ? 'suspended' : 'active',
    owner: r.owner == null ? null : String(r.owner),
    heartbeatAt: Number(r.heartbeat_at),
    hand: Number(r.hand),
    dealer: Number(r.dealer),
    seats: JSON.parse(String(r.seats)) as Record<string, string>,
    escrowed: JSON.parse(String(r.escrowed)),
    snapshot: r.snapshot == null ? null : JSON.parse(String(r.snapshot)),
    updatedAt: Number(r.updated_at),
  };
}

/**
 * Insert or update a table and replace its seat index with the row's seats (one transaction).
 * Returns false, writing nothing, when the stored row is owned by someone other than `row.owner`
 * (including a suspended row whose owner was released). A player seated here is moved off any
 * other table of the same app in the index.
 */
export async function saveTable(row: RoomTableRow): Promise<boolean> {
  const seats: Record<string, string> = {};
  for (const [seat, email] of Object.entries(row.seats ?? {})) seats[seat] = normEmail(email);
  return serialized(() => dbTransaction(async (tx) => {
    const res = await txRun(tx,
      `INSERT INTO room_tables (id, app, tier, status, owner, heartbeat_at, hand, dealer, seats, escrowed, snapshot, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         app = excluded.app, tier = excluded.tier, status = excluded.status,
         heartbeat_at = excluded.heartbeat_at, hand = excluded.hand, dealer = excluded.dealer,
         seats = excluded.seats, escrowed = excluded.escrowed, snapshot = excluded.snapshot,
         updated_at = excluded.updated_at
       WHERE room_tables.owner IS excluded.owner`,
      row.id, row.app, row.tier, row.status, row.owner, row.heartbeatAt, row.hand, row.dealer,
      JSON.stringify(seats), JSON.stringify(row.escrowed ?? {}),
      row.snapshot == null ? null : JSON.stringify(row.snapshot), Date.now());
    if (res.changes === 0) return false;
    await txRun(tx, 'DELETE FROM room_table_seats WHERE table_id = ?', row.id);
    for (const email of new Set(Object.values(seats))) {
      await txRun(tx,
        'INSERT OR REPLACE INTO room_table_seats (app, email, table_id) VALUES (?, ?, ?)',
        row.app, email, row.id);
    }
    return true;
  }));
}

/** Refresh the lease on every active table `owner` holds. Returns the number of tables touched. */
export async function heartbeatTables(owner: string, nowMs: number): Promise<number> {
  const res = await serialized(() => dbRun(
    "UPDATE room_tables SET heartbeat_at = ? WHERE owner = ? AND status = 'active'", nowMs, owner));
  return res.changes;
}

/**
 * Mark every table `owner` holds as suspended and release ownership (owner = NULL), e.g. on
 * SIGTERM, so the next instance can claim them at once. Returns the number of tables suspended.
 */
export async function suspendTables(owner: string): Promise<number> {
  const res = await serialized(() => dbRun(
    "UPDATE room_tables SET status = 'suspended', owner = NULL, updated_at = ? WHERE owner = ?",
    Date.now(), owner));
  return res.changes;
}

/**
 * Take ownership of a table. One conditional UPDATE: it changes the row only when the table is
 * suspended or its heartbeat is older than nowMs - staleMs, so of concurrent claims exactly one
 * wins. On success the table is active, owned by `owner`, with heartbeat_at = nowMs.
 */
export async function claimTable(id: string, owner: string, nowMs: number, staleMs: number): Promise<boolean> {
  const res = await serialized(() => dbRun(
    `UPDATE room_tables SET owner = ?, status = 'active', heartbeat_at = ?, updated_at = ?
     WHERE id = ? AND (status = 'suspended' OR heartbeat_at < ?)`,
    owner, nowMs, Date.now(), id, nowMs - staleMs));
  return res.changes === 1;
}

/** One table by id, or null. */
export async function loadTable(id: string): Promise<StoredRoomTable | null> {
  const r = await dbGet<DbRow>('SELECT * FROM room_tables WHERE id = ?', id);
  return r ? fromDb(r) : null;
}

/** The id of the table `email` sits at in `app`, or null. */
export async function findTableIdForEmail(app: string, email: string): Promise<string | null> {
  const r = await dbGet<{ table_id: string }>(
    'SELECT table_id FROM room_table_seats WHERE app = ? AND email = ?', app, normEmail(email));
  return r ? String(r.table_id) : null;
}

/** Remove a table and its seat index. */
export async function deleteTable(id: string): Promise<void> {
  await serialized(() => dbTransaction(async (tx) => {
    await txRun(tx, 'DELETE FROM room_table_seats WHERE table_id = ?', id);
    await txRun(tx, 'DELETE FROM room_tables WHERE id = ?', id);
  }));
}

/** Every stored table, oldest write first. */
export async function listTables(): Promise<StoredRoomTable[]> {
  const rows = await dbAll<DbRow>('SELECT * FROM room_tables ORDER BY updated_at, id');
  return rows.map(fromDb);
}
