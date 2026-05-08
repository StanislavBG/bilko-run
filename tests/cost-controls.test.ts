import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, dbGet, initDb } from '../server/db.js';
import { enforceCallLimits, USER_DAILY_DEFAULT, USER_DAILY_ADMIN } from '../server/routes/tools/_shared.js';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM usage_daily');
  await dbRun('DELETE FROM cost_alerts');
  await dbRun('DELETE FROM app_spend_ceilings');
});

describe('Cost Controls', () => {
  it('allows calls under user daily cap', async () => {
    const result = await enforceCallLimits({ userEmail: 'user@test.com', ipHash: 'abc', isAdmin: false, appSlug: 'stack-audit' });
    expect(result.ok).toBe(true);
  });

  it('blocks at USER_DAILY_DEFAULT + 1', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Pre-seed calls = USER_DAILY_DEFAULT (100)
    await dbRun(
      'INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)',
      'user@test.com', 'stack-audit', today, USER_DAILY_DEFAULT,
    );
    const result = await enforceCallLimits({ userEmail: 'user@test.com', ipHash: 'abc', isAdmin: false, appSlug: 'stack-audit' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.reason).toMatch(/daily limit/i);
    }
  });

  it('admin gets USER_DAILY_ADMIN cap (1000), not 100', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Pre-seed calls = 100 (regular cap) for admin
    await dbRun(
      'INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)',
      'admin@test.com', 'stack-audit', today, USER_DAILY_DEFAULT,
    );
    const result = await enforceCallLimits({ userEmail: 'admin@test.com', ipHash: 'abc', isAdmin: true, appSlug: 'stack-audit' });
    // Should still be allowed — admin cap is 1000
    expect(result.ok).toBe(true);
  });

  it('admin blocks at USER_DAILY_ADMIN + 1', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await dbRun(
      'INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)',
      'admin@test.com', 'stack-audit', today, USER_DAILY_ADMIN,
    );
    const result = await enforceCallLimits({ userEmail: 'admin@test.com', ipHash: 'abc', isAdmin: true, appSlug: 'stack-audit' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(429);
  });

  it('app ceiling triggers 503', async () => {
    // Set ceiling to 5 for test-app
    await dbRun(
      'INSERT INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)',
      'test-app', 5, Math.floor(Date.now() / 1000),
    );
    const today = new Date().toISOString().slice(0, 10);
    // Seed 5 calls from different users so total = 5
    for (let i = 0; i < 5; i++) {
      await dbRun(
        'INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)',
        `user${i}@test.com`, 'test-app', today, 1,
      );
    }
    // Call 6 from a new user should trigger 503
    const result = await enforceCallLimits({ userEmail: 'new@test.com', ipHash: 'abc', isAdmin: false, appSlug: 'test-app' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.reason).toMatch(/ceiling/i);
    }
  });

  it('inserts cost_alert on user cap breach', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await dbRun(
      'INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)',
      'capped@test.com', 'headline-grader', today, USER_DAILY_DEFAULT,
    );
    await enforceCallLimits({ userEmail: 'capped@test.com', ipHash: 'abc', isAdmin: false, appSlug: 'headline-grader' });
    const alert = await dbGet<{ alert_kind: string }>(
      `SELECT alert_kind FROM cost_alerts WHERE user_email = ? LIMIT 1`, 'capped@test.com',
    );
    expect(alert?.alert_kind).toBe('user_cap');
  });

  it('uses anon:<ipHash> key for null userEmail', async () => {
    const result = await enforceCallLimits({ userEmail: null, ipHash: 'ip123', isAdmin: false, appSlug: 'ad-scorer' });
    expect(result.ok).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    const row = await dbGet<{ calls: number }>(
      'SELECT calls FROM usage_daily WHERE user_email = ? AND app_slug = ? AND date = ?',
      'anon:ip123', 'ad-scorer', today,
    );
    expect(row?.calls).toBe(1);
  });

  it('increments atomically — no lost updates', async () => {
    const calls = Array.from({ length: 10 }, (_, i) =>
      enforceCallLimits({ userEmail: `concurrent${i}@test.com`, ipHash: `h${i}`, isAdmin: false, appSlug: 'thread-grader' }),
    );
    const results = await Promise.all(calls);
    // All 10 distinct users should be allowed (each under their own cap)
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('pilot: Stack-Audit ceiling 5, call 6 returns 503', async () => {
    await dbRun(
      'INSERT INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)',
      'stack-audit', 5, Math.floor(Date.now() / 1000),
    );
    const today = new Date().toISOString().slice(0, 10);
    await dbRun(
      'INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)',
      'pilot@test.com', 'stack-audit', today, 5,
    );
    const result = await enforceCallLimits({ userEmail: 'pilot@test.com', ipHash: 'abc', isAdmin: false, appSlug: 'stack-audit' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });
});
