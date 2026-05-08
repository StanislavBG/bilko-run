import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { registerObservabilityRoutes } from '../server/routes/admin-observability.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';

// Mock requireAdmin directly so tests control auth without a real Clerk connection.
// Default: reject with 403. asAdmin() switches it to admit the admin email.
vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    requireAdmin: vi.fn().mockImplementation(async (_req: any, reply: any) => {
      reply.status(403).send({ error: 'Admin access required.' });
      return null;
    }),
  };
});

import { requireAdmin } from '../server/clerk.js';
const mockAdmin = requireAdmin as ReturnType<typeof vi.fn>;

function asAdmin() {
  mockAdmin.mockImplementation(async () => ADMIN_EMAIL);
}

const app = Fastify({ logger: false });
registerObservabilityRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM app_manifests');
  await dbRun('DELETE FROM app_errors');
  await dbRun('DELETE FROM app_logs');
  await dbRun('DELETE FROM synthetic_runs');
  await dbRun('DELETE FROM cost_alerts');
  delete process.env.BILKO_LATEST_HOST_KIT;
  // Reset to default: reject
  mockAdmin.mockImplementation(async (_req: any, reply: any) => {
    reply.status(403).send({ error: 'Admin access required.' });
    return null;
  });
});

function get(url: string) {
  return app.inject({ method: 'GET', url });
}

async function insertManifest(slug: string, opts: {
  appVersion?: string;
  gitSha?: string;
  hostKitVersion?: string;
  bundleSizeGz?: number;
} = {}) {
  await dbRun(
    `INSERT INTO app_manifests
       (slug, schema_version, app_version, built_at, git_sha, git_branch,
        host_kit_version, golden_path, golden_expect, health_path,
        bundle_size_gz, bundle_files, manifest_json, updated_at)
     VALUES (?, 1, ?, '2026-05-08T12:00:00.000Z', ?, 'main', ?, '/projects/test/', '', NULL, ?, 10, '{}', ?)
     ON CONFLICT(slug) DO UPDATE SET app_version=excluded.app_version, updated_at=excluded.updated_at`,
    slug,
    opts.appVersion ?? '1.0.0',
    opts.gitSha ?? 'abc1234def',
    opts.hostKitVersion ?? '0.3.0',
    opts.bundleSizeGz ?? 204800,
    Math.floor(Date.now() / 1000),
  );
}

describe('auth gate', () => {
  it('rejects unauthenticated request with 403', async () => {
    const res = await get('/api/admin/observability');
    expect(res.statusCode).toBe(403);
  });

  it('rejects non-admin user with 403', async () => {
    // default mock already rejects — just confirm
    const res = await get('/api/admin/observability');
    expect(res.statusCode).toBe(403);
  });

  it('allows admin user through', async () => {
    asAdmin();
    const res = await get('/api/admin/observability');
    expect(res.statusCode).toBe(200);
  });
});

describe('aggregator — empty state', () => {
  it('returns empty rows when no manifests', async () => {
    asAdmin();
    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    expect(body.rows).toEqual([]);
    expect(typeof body.generatedAt).toBe('number');
  });
});

describe('aggregator — 24h counts', () => {
  it('returns correct 24h error count and excludes older errors', async () => {
    asAdmin();
    await insertManifest('error-slug');
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 3; i++) {
      await dbRun(
        `INSERT INTO app_errors (app, version, name, msg, created_at) VALUES (?, '1.0.0', 'Error', 'boom', ?)`,
        'error-slug', now - i * 100,
      );
    }
    // older than 24h — must be excluded
    await dbRun(
      `INSERT INTO app_errors (app, version, name, msg, created_at) VALUES (?, '1.0.0', 'Error', 'old', ?)`,
      'error-slug', now - 90_000,
    );

    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const row = body.rows.find((r: any) => r.slug === 'error-slug');
    expect(row).toBeDefined();
    expect(row.errors24h).toBe(3);
  });

  it('returns correct warn/error log counts', async () => {
    asAdmin();
    await insertManifest('log-slug');
    const now = Math.floor(Date.now() / 1000);
    await dbRun(
      `INSERT INTO app_logs (app, version, level, msg, created_at) VALUES (?, '1.0.0', 'warn', 'w1', ?)`,
      'log-slug', now - 100,
    );
    await dbRun(
      `INSERT INTO app_logs (app, version, level, msg, created_at) VALUES (?, '1.0.0', 'warn', 'w2', ?)`,
      'log-slug', now - 200,
    );
    await dbRun(
      `INSERT INTO app_logs (app, version, level, msg, created_at) VALUES (?, '1.0.0', 'error', 'e1', ?)`,
      'log-slug', now - 300,
    );

    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const row = body.rows.find((r: any) => r.slug === 'log-slug');
    expect(row.warnLogs24h).toBe(2);
    expect(row.errorLogs24h).toBe(1);
  });

  it('returns synthetic pass/fail counts and latestOk', async () => {
    asAdmin();
    await insertManifest('synth-slug');
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 4; i++) {
      await dbRun(
        `INSERT INTO synthetic_runs (slug, ok, http_status, load_ms, expect_found, ran_at)
         VALUES (?, 1, 200, 300, 1, ?)`,
        'synth-slug', now - i * 60,
      );
    }
    await dbRun(
      `INSERT INTO synthetic_runs (slug, ok, http_status, load_ms, expect_found, ran_at)
       VALUES (?, 0, 500, 900, 0, ?)`,
      'synth-slug', now - 500,
    );

    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const row = body.rows.find((r: any) => r.slug === 'synth-slug');
    expect(row.synthetic.passes).toBe(4);
    expect(row.synthetic.fails).toBe(1);
    expect(row.synthetic.latestOk).toBe(true);
  });
});

describe('aggregator — missing data', () => {
  it('sibling with no telemetry has synthetic.latestOk=null, not false', async () => {
    asAdmin();
    await insertManifest('bare-slug');
    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const row = body.rows.find((r: any) => r.slug === 'bare-slug');
    expect(row).toBeDefined();
    expect(row.synthetic.latestOk).toBeNull();
    expect(row.errors24h).toBe(0);
    expect(row.traffic24h).toBe(0);
    expect(row.warnLogs24h).toBe(0);
    expect(row.errorLogs24h).toBe(0);
  });

  it('zero-data slug does not inherit counts from an active sibling', async () => {
    asAdmin();
    await insertManifest('active-slug');
    await insertManifest('inactive-slug');
    const now = Math.floor(Date.now() / 1000);
    await dbRun(
      `INSERT INTO app_errors (app, version, name, msg, created_at) VALUES (?, '1.0.0', 'Error', 'boom', ?)`,
      'active-slug', now - 10,
    );

    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const inactive = body.rows.find((r: any) => r.slug === 'inactive-slug');
    expect(inactive.errors24h).toBe(0);
    expect(inactive.synthetic.latestOk).toBeNull();
  });
});

describe('aggregator — host-kit drift', () => {
  it('returns minor_behind when kit is 1 minor behind', async () => {
    asAdmin();
    process.env.BILKO_LATEST_HOST_KIT = '0.5.0';
    await insertManifest('drift-minor', { hostKitVersion: '0.4.0' });

    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const row = body.rows.find((r: any) => r.slug === 'drift-minor');
    expect(row.hostKitDrift).toBe('minor_behind');
  });

  it('returns major_behind when kit is 2+ minors behind', async () => {
    asAdmin();
    process.env.BILKO_LATEST_HOST_KIT = '0.5.0';
    await insertManifest('drift-major', { hostKitVersion: '0.2.0' });

    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const row = body.rows.find((r: any) => r.slug === 'drift-major');
    expect(row.hostKitDrift).toBe('major_behind');
  });

  it('returns unknown drift when BILKO_LATEST_HOST_KIT is unset', async () => {
    asAdmin();
    await insertManifest('drift-unknown', { hostKitVersion: '0.3.0' });

    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const row = body.rows.find((r: any) => r.slug === 'drift-unknown');
    expect(row.hostKitDrift).toBe('unknown');
  });

  it('returns current when kit matches latest', async () => {
    asAdmin();
    process.env.BILKO_LATEST_HOST_KIT = '0.3.0';
    await insertManifest('drift-current', { hostKitVersion: '0.3.0' });

    const res = await get('/api/admin/observability');
    const body = JSON.parse(res.body);
    const row = body.rows.find((r: any) => r.slug === 'drift-current');
    expect(row.hostKitDrift).toBe('current');
  });
});
