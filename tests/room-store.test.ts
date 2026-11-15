import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, dbAll, initDb } from '../server/db.js';
import {
  saveTable, heartbeatTables, suspendTables, claimTable, loadTable,
  findTableIdForEmail, deleteTable, listTables, type RoomTableRow,
} from '../server/services/room-store.js';

const APP = 'three-winds';
const STALE = 30_000;

function row(over: Partial<RoomTableRow> = {}): RoomTableRow {
  return {
    id: 't1', app: APP, tier: 'low', status: 'active', owner: 'inst-a', heartbeatAt: 1_000,
    hand: 3, dealer: 1, seats: { '0': 'a@test.com', '1': 'b@test.com', '2': 'c@test.com' },
    escrowed: { 'a@test.com': 200 }, snapshot: { wall: [1, 2, 3] }, ...over,
  };
}

async function seatRows() {
  return dbAll<{ app: string; email: string; table_id: string }>(
    'SELECT app, email, table_id FROM room_table_seats ORDER BY email');
}

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM room_table_seats');
  await dbRun('DELETE FROM room_tables');
});

describe('room store', () => {
  it('saves and loads a table round-trip', async () => {
    expect(await saveTable(row())).toBe(true);
    const t = await loadTable('t1');
    expect(t).toMatchObject(row());
    expect(typeof t?.updatedAt).toBe('number');
    expect(await loadTable('nope')).toBeNull();
    expect((await listTables()).map((x) => x.id)).toEqual(['t1']);
  });

  it('keeps the seat index equal to the row seats', async () => {
    await saveTable(row());
    expect(await findTableIdForEmail(APP, 'B@test.com ')).toBe('t1');
    expect((await seatRows()).map((r) => r.email)).toEqual(['a@test.com', 'b@test.com', 'c@test.com']);
    await saveTable(row({ seats: { '0': 'a@test.com', '2': 'd@test.com' } }));
    expect((await seatRows()).map((r) => r.email)).toEqual(['a@test.com', 'd@test.com']);
    expect(await findTableIdForEmail(APP, 'b@test.com')).toBeNull();
    expect(await findTableIdForEmail('other-app', 'a@test.com')).toBeNull();
  });

  it('refuses a save from an instance that does not own the table', async () => {
    await saveTable(row());
    expect(await saveTable(row({ owner: 'inst-b', hand: 9 }))).toBe(false);
    expect((await loadTable('t1'))?.hand).toBe(3);
  });

  it('heartbeats only the owner\'s active tables', async () => {
    await saveTable(row());
    await saveTable(row({ id: 't2', owner: 'inst-b', seats: {} }));
    expect(await heartbeatTables('inst-a', 5_000)).toBe(1);
    expect((await loadTable('t1'))?.heartbeatAt).toBe(5_000);
    expect((await loadTable('t2'))?.heartbeatAt).toBe(1_000);
  });

  it('suspends the owner\'s tables and releases ownership', async () => {
    await saveTable(row());
    expect(await suspendTables('inst-a')).toBe(1);
    const t = await loadTable('t1');
    expect(t).toMatchObject({ status: 'suspended', owner: null });
    expect(await heartbeatTables('inst-a', 9_000)).toBe(0);
    expect(await saveTable(row({ hand: 4 }))).toBe(false);
  });

  it('refuses a claim while the heartbeat is fresh', async () => {
    await saveTable(row({ heartbeatAt: 10_000 }));
    expect(await claimTable('t1', 'inst-b', 10_000 + STALE, STALE)).toBe(false);
    expect((await loadTable('t1'))?.owner).toBe('inst-a');
  });

  it('wins a claim after the heartbeat goes stale', async () => {
    await saveTable(row({ heartbeatAt: 10_000 }));
    expect(await claimTable('t1', 'inst-b', 10_000 + STALE + 1, STALE)).toBe(true);
    expect(await loadTable('t1')).toMatchObject({ owner: 'inst-b', status: 'active', heartbeatAt: 10_000 + STALE + 1 });
    expect(await saveTable(row({ hand: 9 }))).toBe(false);
    expect(await saveTable(row({ owner: 'inst-b', hand: 9 }))).toBe(true);
  });

  it('wins a claim after suspend even with a fresh heartbeat', async () => {
    await saveTable(row({ heartbeatAt: 10_000 }));
    await suspendTables('inst-a');
    expect(await claimTable('t1', 'inst-b', 10_001, STALE)).toBe(true);
    expect(await loadTable('t1')).toMatchObject({ owner: 'inst-b', status: 'active' });
  });

  it('lets exactly one of two concurrent claims win', async () => {
    await saveTable(row());
    await suspendTables('inst-a');
    const results = await Promise.all([
      claimTable('t1', 'inst-b', 50_000, STALE),
      claimTable('t1', 'inst-c', 50_000, STALE),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await loadTable('t1'))?.owner).toBe(results[0] ? 'inst-b' : 'inst-c');
    expect(await claimTable('missing', 'inst-b', 50_000, STALE)).toBe(false);
  });

  it('deletes a table and its seat index', async () => {
    await saveTable(row());
    await deleteTable('t1');
    expect(await loadTable('t1')).toBeNull();
    expect(await seatRows()).toEqual([]);
    expect(await listTables()).toEqual([]);
  });
});
