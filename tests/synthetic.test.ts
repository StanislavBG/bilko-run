import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { dbRun, dbGet, dbAll, initDb } from '../server/db.js';
import { maybeAlert } from '../scripts/synthetic-monitor.js';

beforeAll(async () => {
  await initDb();
});

// Isolate each test with a unique slug so runs don't bleed across tests
function uid() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function insertRun(slug: string, ok: 0 | 1, httpStatus: number | null = 200, loadMs = 100, errorMsg: string | null = null) {
  await dbRun(
    `INSERT INTO synthetic_runs (slug, ok, http_status, load_ms, expect_found, error_msg, ran_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    slug, ok, httpStatus, loadMs, ok, errorMsg, Math.floor(Date.now() / 1000),
  );
}

describe('synthetic_runs table', () => {
  it('exists after initDb', async () => {
    const row = await dbGet<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='synthetic_runs'`,
    );
    expect(row?.name).toBe('synthetic_runs');
  });

  it('synthetic_alerts table exists after initDb', async () => {
    const row = await dbGet<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='synthetic_alerts'`,
    );
    expect(row?.name).toBe('synthetic_alerts');
  });
});

describe('row insertion', () => {
  it('inserts a pass row with ok=1', async () => {
    const slug = uid();
    await insertRun(slug, 1, 200, 350);
    const row = await dbGet<{ ok: number; http_status: number; load_ms: number }>(
      `SELECT ok, http_status, load_ms FROM synthetic_runs WHERE slug = ?`, slug,
    );
    expect(row?.ok).toBe(1);
    expect(row?.http_status).toBe(200);
    expect(row?.load_ms).toBe(350);
  });

  it('inserts a fail row with ok=0, http_status=500', async () => {
    const slug = uid();
    await insertRun(slug, 0, 500, 120, 'http 500');
    const row = await dbGet<{ ok: number; http_status: number; error_msg: string }>(
      `SELECT ok, http_status, error_msg FROM synthetic_runs WHERE slug = ?`, slug,
    );
    expect(row?.ok).toBe(0);
    expect(row?.http_status).toBe(500);
    expect(row?.error_msg).toBe('http 500');
  });

  it('inserts a fail row when expect text is missing', async () => {
    const slug = uid();
    await insertRun(slug, 0, 200, 200, null);
    const row = await dbGet<{ ok: number; expect_found: number }>(
      `SELECT ok, expect_found FROM synthetic_runs WHERE slug = ?`, slug,
    );
    expect(row?.ok).toBe(0);
  });
});

describe('maybeAlert — consecutive failure streak', () => {
  it('does NOT open alert after 1 failure', async () => {
    const slug = uid();
    await insertRun(slug, 0);
    await maybeAlert(slug, false);
    const alert = await dbGet(`SELECT slug FROM synthetic_alerts WHERE slug = ? AND resolved_at IS NULL`, slug);
    expect(alert).toBeUndefined();
  });

  it('does NOT open alert after 2 failures', async () => {
    const slug = uid();
    await insertRun(slug, 0);
    await maybeAlert(slug, false);
    await insertRun(slug, 0);
    await maybeAlert(slug, false);
    const alert = await dbGet(`SELECT slug FROM synthetic_alerts WHERE slug = ? AND resolved_at IS NULL`, slug);
    expect(alert).toBeUndefined();
  });

  it('opens alert after 3 consecutive failures', async () => {
    const slug = uid();
    for (let i = 0; i < 3; i++) {
      await insertRun(slug, 0);
    }
    await maybeAlert(slug, false);
    const alert = await dbGet<{ slug: string }>(
      `SELECT slug FROM synthetic_alerts WHERE slug = ? AND resolved_at IS NULL`, slug,
    );
    expect(alert?.slug).toBe(slug);
  });

  it('does NOT open alert when 2 fails are followed by 1 pass', async () => {
    const slug = uid();
    // Insert in chronological order: pass first, then 2 fails (DESC order = fails first)
    await insertRun(slug, 1);  // oldest
    await insertRun(slug, 0);  // middle
    await insertRun(slug, 0);  // most recent
    await maybeAlert(slug, false);
    // streak = 2 (both recent are fails, but oldest is ok) → no alert
    const alert = await dbGet(`SELECT slug FROM synthetic_alerts WHERE slug = ? AND resolved_at IS NULL`, slug);
    expect(alert).toBeUndefined();
  });

  it('deduplicates: calling maybeAlert again for open slug does not create duplicate', async () => {
    const slug = uid();
    for (let i = 0; i < 3; i++) {
      await insertRun(slug, 0);
    }
    await maybeAlert(slug, false);
    await insertRun(slug, 0);
    await maybeAlert(slug, false);
    const rows = await dbAll(
      `SELECT slug FROM synthetic_alerts WHERE slug = ? AND resolved_at IS NULL`, slug,
    );
    expect(rows.length).toBe(1);
  });
});

describe('maybeAlert — resolution on pass', () => {
  it('resolves an open alert when a pass run arrives', async () => {
    const slug = uid();
    // Open an alert manually
    await dbRun(
      `INSERT INTO synthetic_alerts (slug, first_failed_at, notified_at) VALUES (?, ?, ?)`,
      slug, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000),
    );
    // Call with ok=true
    await maybeAlert(slug, true);
    const alert = await dbGet(
      `SELECT resolved_at FROM synthetic_alerts WHERE slug = ?`, slug,
    ) as { resolved_at: number | null } | undefined;
    expect(alert?.resolved_at).not.toBeNull();
  });

  it('does nothing when no open alert and run is ok', async () => {
    const slug = uid();
    await maybeAlert(slug, true);
    const alert = await dbGet(`SELECT slug FROM synthetic_alerts WHERE slug = ?`, slug);
    expect(alert).toBeUndefined();
  });
});
