import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { mintAdminApiKey } from '../server/services/admin-api-keys.js';
import {
  mintAgentApiKey,
  verifyAgentApiKey,
  listAgentApiKeys,
  revokeAgentApiKey,
  AgentApiKeyLimitError,
} from '../server/services/agent-api-keys.js';

const EMAIL = 'buyer@example.com';

async function mint(email = EMAIL, label: string | null = null, opts?: { checkoutSessionId?: string }) {
  const r = await mintAgentApiKey(email, label, opts);
  if ('alreadyMinted' in r) throw new Error('unexpected alreadyMinted');
  return r;
}

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM agent_api_keys');
  await dbRun('DELETE FROM admin_api_keys');
});

describe('agent api keys', () => {
  it('mint then verify returns the normalized email', async () => {
    const k = await mint('  Buyer@Example.COM ', 'laptop');
    expect(k.key.startsWith('bkk_')).toBe(true);
    expect(k.prefix).toBe(k.key.slice(0, 12));
    expect(await verifyAgentApiKey(k.key)).toBe(EMAIL);
  });

  it('never stores the raw key', async () => {
    const k = await mint();
    const row = await dbGet<Record<string, unknown>>('SELECT * FROM agent_api_keys WHERE id = ?', k.id);
    expect(JSON.stringify(row)).not.toContain(k.key);
    expect(row?.key_hash).not.toBe(k.key);
  });

  it('rejects wrong, unprefixed and revoked keys', async () => {
    const k = await mint();
    expect(await verifyAgentApiKey(k.key + 'x')).toBeNull();
    expect(await verifyAgentApiKey(k.key.slice(4))).toBeNull();
    expect(await verifyAgentApiKey('')).toBeNull();
    expect(await revokeAgentApiKey(k.id, EMAIL)).toBe(true);
    expect(await verifyAgentApiKey(k.key)).toBeNull();
  });

  it('rejects bka_ admin keys', async () => {
    const a = await mintAdminApiKey('admin@example.com', null);
    expect(await verifyAgentApiKey(a.key)).toBeNull();
  });

  it('list never exposes key_hash and is scoped to the email', async () => {
    await mint(EMAIL, 'a');
    await mint('other@example.com', 'b');
    const rows = await listAgentApiKeys(EMAIL);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain('key_hash');
  });

  it('revoke by a different email returns false', async () => {
    const k = await mint();
    expect(await revokeAgentApiKey(k.id, 'other@example.com')).toBe(false);
    expect(await verifyAgentApiKey(k.key)).toBe(EMAIL);
  });

  it('caps unrevoked keys at 10 per email; revoking frees a slot', async () => {
    const first = await mint();
    for (let i = 1; i < 10; i++) await mint();
    await expect(mintAgentApiKey(EMAIL, null)).rejects.toBeInstanceOf(AgentApiKeyLimitError);
    await mint('other@example.com');
    await revokeAgentApiKey(first.id, EMAIL);
    await expect(mintAgentApiKey(EMAIL, null)).resolves.toHaveProperty('key');
  });

  it('is idempotent per checkout session', async () => {
    const a = await mintAgentApiKey(EMAIL, null, { checkoutSessionId: 'cs_1' });
    expect(a).toHaveProperty('key');
    const b = await mintAgentApiKey(EMAIL, null, { checkoutSessionId: 'cs_1' });
    expect(b).toEqual({ alreadyMinted: true });
    const row = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM agent_api_keys');
    expect(Number(row?.n)).toBe(1);
  });

  it('throttles last_used_at updates to once per 60s', async () => {
    const k = await mint();
    await verifyAgentApiKey(k.key);
    const t0 = (await dbGet<{ last_used_at: number }>('SELECT last_used_at FROM agent_api_keys WHERE id = ?', k.id))!.last_used_at;
    expect(t0).toBeGreaterThan(0);
    await dbRun('UPDATE agent_api_keys SET last_used_at = ? WHERE id = ?', t0 + 1000, k.id);
    await verifyAgentApiKey(k.key);
    const t1 = (await dbGet<{ last_used_at: number }>('SELECT last_used_at FROM agent_api_keys WHERE id = ?', k.id))!.last_used_at;
    expect(t1).toBe(t0 + 1000);
    await dbRun('UPDATE agent_api_keys SET last_used_at = ? WHERE id = ?', t0 - 120, k.id);
    await verifyAgentApiKey(k.key);
    const t2 = (await dbGet<{ last_used_at: number }>('SELECT last_used_at FROM agent_api_keys WHERE id = ?', k.id))!.last_used_at;
    expect(t2).toBeGreaterThanOrEqual(t0);
  });
});
