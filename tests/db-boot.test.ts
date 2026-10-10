import { describe, it, expect, beforeAll, vi } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Fresh temp DB: set before the module (and its singleton client) loads.
process.env.BILKO_SQLITE_PATH = join(mkdtempSync(join(tmpdir(), 'db-boot-')), 'boot.db');
delete process.env.TURSO_DATABASE_URL;

import { initDb, getClient } from '../server/db.js';

const MAX_SECOND_BOOT_ROUND_TRIPS = 25;

async function snapshot() {
  const c = getClient();
  const schema = (await c.execute("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")).rows
    .map(r => [r.type, r.name, r.sql]);
  const tables = (await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows
    .map(r => String(r.name));
  const data: Record<string, unknown[]> = {};
  for (const t of ['referrer_rules', 'app_budgets', 'app_spend_ceilings', 'secret_metadata', 'blog_posts', 'roast_history', 'data_migrations']) {
    if (!tables.includes(t)) continue;
    const rows = (await c.execute(`SELECT * FROM ${t} ORDER BY 1, 2`)).rows.map(r => ({ ...r }));
    // timestamps seeded with "now" legitimately differ between boots
    data[t] = rows.map(r => {
      const { updated_at, applied_at, created_at, ...rest } = r as Record<string, unknown>;
      return rest;
    });
  }
  return { schema, data };
}

describe('initDb boot cost', () => {
  const counts: number[] = [];
  const snaps: Awaited<ReturnType<typeof snapshot>>[] = [];

  beforeAll(async () => {
    const c = getClient();
    const exec = vi.spyOn(c, 'execute');
    const batch = vi.spyOn(c, 'batch');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    for (let i = 0; i < 2; i++) {
      exec.mockClear();
      batch.mockClear();
      await initDb();
      // libsql's batch does not route through the spied execute, so the sum is the network round-trips
      counts.push(exec.mock.calls.length + batch.mock.calls.length);
      snaps.push(await snapshot());
    }
    log.mockRestore();
    // eslint-disable-next-line no-console
    console.info(`[db-boot] round-trips: boot1=${counts[0]} boot2=${counts[1]}`);
  }, 60_000);

  it(`second boot issues at most ${MAX_SECOND_BOOT_ROUND_TRIPS} round-trips`, () => {
    expect(counts[1]).toBeLessThanOrEqual(MAX_SECOND_BOOT_ROUND_TRIPS);
  });

  it('schema and seeded rows are identical after both boots', () => {
    expect(snaps[1].schema).toEqual(snaps[0].schema);
    expect(snaps[1].data).toEqual(snaps[0].data);
    expect(snaps[0].data.referrer_rules.length).toBeGreaterThan(0);
    expect(snaps[0].data.secret_metadata.length).toBe(6);
  });
});
