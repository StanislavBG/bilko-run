import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDb, dbRun } from '../server/db.js';
import {
  emailHash, quotaUsed, recordCall, nextResetAt, PER_DAY_LIMIT,
} from '../server/services/academy-quota.js';

const USER = 'student@test.com';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM academy_quota_daily');
});

describe('academy quota', () => {
  it('starts at zero', async () => {
    expect(await quotaUsed(USER)).toBe(0);
  });

  it('increments for each ok call', async () => {
    await recordCall(USER, 'ok', 10, 5);
    await recordCall(USER, 'ok', 8, 4);
    expect(await quotaUsed(USER)).toBe(2);
  });

  it('only counts ok outcome toward the quota', async () => {
    await recordCall(USER, 'ok');
    await recordCall(USER, 'error');
    await recordCall(USER, 'denied');
    await recordCall(USER, 'rate_limited');
    expect(await quotaUsed(USER)).toBe(1);
  });

  it('respects PER_DAY_LIMIT constant (5)', () => {
    expect(PER_DAY_LIMIT).toBe(5);
  });

  it('window is rolling 24h, not calendar day', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const eh = emailHash(USER);

    // Insert a call 25h ago — should be outside the 24h window
    await dbRun(
      'INSERT INTO academy_quota_daily (email_hash, call_at, outcome) VALUES (?, ?, ?)',
      eh, nowSec - 90_000, 'ok',
    );
    // Insert a call 23h ago — inside the window
    await dbRun(
      'INSERT INTO academy_quota_daily (email_hash, call_at, outcome) VALUES (?, ?, ?)',
      eh, nowSec - 82_800, 'ok',
    );

    expect(await quotaUsed(USER)).toBe(1);
  });

  it('resets after 24h (oldest ok call expires)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const eh = emailHash(USER);

    // Insert 5 calls clearly outside the 24h window (25h ago and older)
    for (let i = 0; i < 5; i++) {
      await dbRun(
        'INSERT INTO academy_quota_daily (email_hash, call_at, outcome) VALUES (?, ?, ?)',
        eh, nowSec - 90_000 - i, 'ok',
      );
    }

    // All 5 are outside the 24h window → quota is 0 (effectively reset)
    expect(await quotaUsed(USER)).toBe(0);
  });

  it('nextResetAt returns null when no ok calls exist', async () => {
    expect(await nextResetAt(USER)).toBeNull();
  });

  it('nextResetAt is 24h after the oldest ok call inside the window', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const eh = emailHash(USER);
    const oldest = nowSec - 3600; // 1h ago

    await dbRun(
      'INSERT INTO academy_quota_daily (email_hash, call_at, outcome) VALUES (?, ?, ?)',
      eh, oldest, 'ok',
    );
    await dbRun(
      'INSERT INTO academy_quota_daily (email_hash, call_at, outcome) VALUES (?, ?, ?)',
      eh, nowSec - 100, 'ok',
    );

    const reset = await nextResetAt(USER);
    expect(reset).not.toBeNull();
    // Should be oldest + 86400s (within 5s tolerance for test execution time)
    const expectedMs = (oldest + 86_400) * 1000;
    expect(Math.abs(reset!.getTime() - expectedMs)).toBeLessThan(5000);
  });

  it('emailHash is deterministic and non-reversible', () => {
    const h1 = emailHash('Alice@Example.COM');
    const h2 = emailHash('alice@example.com');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(16);
    expect(h1).not.toContain('alice');
  });
});
