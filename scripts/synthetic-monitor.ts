#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import { dbAll, dbRun, dbGet, initDb } from '../server/db.js';

const BASE = process.env.BILKO_BASE ?? 'https://bilko.run';
const MAX_LOAD_MS = 20_000;
const STREAK_TO_ALERT = 3;

interface ManifestRow {
  slug: string;
  golden_path: string;
  golden_expect: string;
}

async function main() {
  await initDb();

  const rows = await dbAll<ManifestRow>(
    `SELECT slug, golden_path, golden_expect FROM app_manifests`,
  );
  if (rows.length === 0) {
    console.log('synthetic-monitor: no manifests registered, exit 0');
    return;
  }

  const browser = await chromium.launch();
  try {
    for (const row of rows) {
      const startedAt = Date.now();
      let ok = false;
      let status: number | null = null;
      let found: 0 | 1 | null = null;
      let errMsg: string | null = null;
      let loadMs = 0;

      const page = await browser.newPage();
      try {
        const url = new URL(row.golden_path, BASE).toString();
        const resp = await page.goto(url, { timeout: MAX_LOAD_MS, waitUntil: 'domcontentloaded' });
        status = resp?.status() ?? null;
        loadMs = Date.now() - startedAt;
        if (resp && resp.ok()) {
          if (row.golden_expect) {
            const text = await page.textContent('body', { timeout: 5000 });
            found = (text?.includes(row.golden_expect) ? 1 : 0);
            ok = found === 1;
          } else {
            found = null;
            ok = true;
          }
        } else {
          ok = false;
          errMsg = `http ${status}`;
        }
      } catch (e: any) {
        ok = false;
        errMsg = e.message?.slice(0, 500) ?? String(e);
        loadMs = Date.now() - startedAt;
      } finally {
        await page.close();
      }

      await dbRun(
        `INSERT INTO synthetic_runs (slug, ok, http_status, load_ms, expect_found, error_msg, ran_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row.slug, ok ? 1 : 0, status, loadMs, found, errMsg, Math.floor(Date.now() / 1000),
      );
      console.log(`${row.slug}: ${ok ? 'OK' : 'FAIL'} ${status ?? '-'} ${loadMs}ms ${errMsg ?? ''}`);
      await maybeAlert(row.slug, ok);
    }
  } finally {
    await browser.close();
  }
}

export async function maybeAlert(slug: string, ok: boolean) {
  if (ok) {
    await dbRun(
      `UPDATE synthetic_alerts SET resolved_at = ? WHERE slug = ? AND resolved_at IS NULL`,
      Math.floor(Date.now() / 1000), slug,
    );
    return;
  }

  // Count consecutive failures from most recent run (ORDER BY ran_at DESC)
  const recent = await dbAll<{ ok: number }>(
    `SELECT ok FROM synthetic_runs WHERE slug = ? ORDER BY ran_at DESC LIMIT ?`,
    slug, STREAK_TO_ALERT,
  );
  let streak = 0;
  for (const r of recent) {
    if (r.ok === 0) streak++;
    else break;
  }

  if (streak < STREAK_TO_ALERT) return;

  // Dedupe — only one open alert per slug
  const open = await dbGet<{ slug: string }>(
    `SELECT slug FROM synthetic_alerts WHERE slug = ? AND resolved_at IS NULL`, slug,
  );
  if (open) return;

  await dbRun(
    `INSERT INTO synthetic_alerts (slug, first_failed_at, notified_at)
     VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       first_failed_at = excluded.first_failed_at,
       notified_at = excluded.notified_at,
       resolved_at = NULL`,
    slug, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000),
  );

  console.error(`ALERT: ${slug} synthetic failed ${streak}x consecutive`);

  // Emit structured error log via telemetry
  await fetch(`${BASE}/api/telemetry/log`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      batch: [{
        app: 'platform',
        version: '1.0.0',
        level: 'error',
        msg: 'synthetic.fail.streak',
        fields: { slug, streak },
        visitor_id: 'synthetic-monitor',
        session_id: 'cron',
        ts: Date.now(),
      }],
    }),
  }).catch(() => {});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
}
