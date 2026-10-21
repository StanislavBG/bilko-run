import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const svc = vi.hoisted(() => ({
  mintAdminApiKey: vi.fn(),
  listAdminApiKeys: vi.fn(),
  revokeAdminApiKey: vi.fn(),
}));
const db = vi.hoisted(() => ({ dbGet: vi.fn() }));
vi.mock('../server/services/admin-api-keys.js', () => svc);
vi.mock('../server/db.js', () => db);

import { mintAndRotate, installKeyFile, assertProdDb, main } from '../scripts/mint-admin-key.js';

const EMAIL = 'bilkobibitkov2000@gmail.com';
const row = (id: number, label: string | null, revoked_at: number | null = null) =>
  ({ id, label, prefix: 'bka_x', created_at: 1, expires_at: 2, last_used_at: null, revoked_at });

beforeEach(() => {
  vi.resetAllMocks();
  svc.mintAdminApiKey.mockResolvedValue({ id: 10, key: 'bka_SECRET', prefix: 'bka_SECR', expiresAt: 1_900_000_000 });
  svc.revokeAdminApiKey.mockResolvedValue(true);
});

describe('mintAndRotate', () => {
  it('mints for the first admin email and revokes only older live same-label keys', async () => {
    svc.listAdminApiKeys.mockResolvedValue([row(10, 'bilko-host-mcp@pop-os'), row(7, 'bilko-host-mcp@pop-os'), row(5, 'bilko-host-mcp@pop-os', 99), row(3, 'other')]);
    const r = await mintAndRotate();
    expect(svc.mintAdminApiKey).toHaveBeenCalledWith(EMAIL, 'bilko-host-mcp@pop-os', 365);
    expect(svc.revokeAdminApiKey).toHaveBeenCalledTimes(1);
    expect(svc.revokeAdminApiKey).toHaveBeenCalledWith(7, EMAIL);
    expect(r.revokedIds).toEqual([7]);
  });

  it('rejects non-admin emails before minting', async () => {
    await expect(mintAndRotate({ email: 'x@example.com' })).rejects.toThrow(/ADMIN_EMAILS/);
    expect(svc.mintAdminApiKey).not.toHaveBeenCalled();
  });
});

describe('installKeyFile', () => {
  it('writes the key with 0600 in a 0700 dir', () => {
    const p = join(mkdtempSync(join(tmpdir(), 'mak-')), 'cfg', 'admin-key');
    installKeyFile('bka_abc', p);
    expect(statSync(p).mode & 0o777).toBe(0o600);
    expect(statSync(join(p, '..')).mode & 0o777).toBe(0o700);
    expect(readFileSync(p, 'utf8').trim()).toBe('bka_abc');
  });
});

describe('assertProdDb', () => {
  it('refuses without Turso env', async () => {
    vi.stubEnv('TURSO_DATABASE_URL', '');
    await expect(assertProdDb()).rejects.toThrow(/TURSO_DATABASE_URL/);
    vi.unstubAllEnvs();
  });
  it('refuses when admin_api_keys is missing', async () => {
    vi.stubEnv('TURSO_DATABASE_URL', 'libsql://x');
    vi.stubEnv('TURSO_AUTH_TOKEN', 't');
    db.dbGet.mockResolvedValue(undefined);
    await expect(assertProdDb()).rejects.toThrow(/admin_api_keys/);
    vi.unstubAllEnvs();
  });
});

describe('main', () => {
  it('never prints the raw key', async () => {
    vi.stubEnv('TURSO_DATABASE_URL', 'libsql://x');
    vi.stubEnv('TURSO_AUTH_TOKEN', 't');
    vi.stubEnv('BILKO_ADMIN_KEY_FILE', join(mkdtempSync(join(tmpdir(), 'mak-')), 'k'));
    db.dbGet.mockResolvedValue({ name: 'admin_api_keys' });
    svc.listAdminApiKeys.mockResolvedValue([]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await main(['--install']);
    expect(log.mock.calls.flat().join('\n')).not.toContain('bka_SECRET');
    log.mockRestore();
    vi.unstubAllEnvs();
  });
});
