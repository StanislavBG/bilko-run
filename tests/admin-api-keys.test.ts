import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { ADMIN_EMAILS } from '../server/clerk.js';
import {
  mintAdminApiKey,
  verifyAdminApiKey,
  listAdminApiKeys,
  revokeAdminApiKey,
} from '../server/services/admin-api-keys.js';

const ADMIN = ADMIN_EMAILS[0];

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM admin_api_keys');
});

describe('admin api keys', () => {
  it('mint then verify returns the email', async () => {
    const k = await mintAdminApiKey(ADMIN, 'laptop');
    expect(k.key.startsWith('bka_')).toBe(true);
    expect(k.prefix).toBe(k.key.slice(0, 12));
    expect(await verifyAdminApiKey(k.key)).toBe(ADMIN);
  });

  it('never stores the raw key', async () => {
    const k = await mintAdminApiKey(ADMIN, 'x');
    const row = await dbGet<Record<string, unknown>>('SELECT * FROM admin_api_keys WHERE id = ?', k.id);
    expect(JSON.stringify(row)).not.toContain(k.key);
    expect(row?.key_hash).not.toBe(k.key);
  });

  it('rejects wrong, unprefixed, expired, revoked and de-admined keys', async () => {
    const k = await mintAdminApiKey(ADMIN, null);
    expect(await verifyAdminApiKey(k.key + 'x')).toBeNull();
    expect(await verifyAdminApiKey(k.key.slice(4))).toBeNull();

    await dbRun('UPDATE admin_api_keys SET expires_at = ? WHERE id = ?', 1, k.id);
    expect(await verifyAdminApiKey(k.key)).toBeNull();

    const r = await mintAdminApiKey(ADMIN, null);
    expect(await revokeAdminApiKey(r.id, ADMIN)).toBe(true);
    expect(await verifyAdminApiKey(r.key)).toBeNull();

    const o = await mintAdminApiKey('not-admin@example.com', null);
    expect(await verifyAdminApiKey(o.key)).toBeNull();
  });

  it('list never exposes key_hash', async () => {
    await mintAdminApiKey(ADMIN, 'a');
    const rows = await listAdminApiKeys(ADMIN);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).not.toContain('key_hash');
    expect(JSON.stringify(rows)).not.toContain('key_hash');
  });

  it('revoke by a different email returns false', async () => {
    const k = await mintAdminApiKey(ADMIN, null);
    expect(await revokeAdminApiKey(k.id, 'other@example.com')).toBe(false);
    expect(await verifyAdminApiKey(k.key)).toBe(ADMIN);
  });
});
