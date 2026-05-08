import { describe, it, expect, beforeAll } from 'vitest';
import { ManifestSchema, validateManifestRaw, computeDrift } from '../shared/manifest-schema.js';
import { dbGet, dbAll, dbRun, initDb } from '../server/db.js';

const VALID_FIXTURE = {
  schemaVersion: 1 as const,
  slug: 'test-app',
  version: '1.2.3',
  builtAt: '2026-05-08T12:00:00.000Z',
  gitSha: 'abc1234',
  gitBranch: 'main',
  hostKit: { version: '0.3.0' },
  golden: { path: '/projects/test-app/', expect: 'TestApp' },
  health: {},
  bundle: { sizeBytesGz: 204800, fileCount: 42 },
};

beforeAll(async () => {
  await initDb();
});

describe('ManifestSchema', () => {
  it('accepts a valid fixture', () => {
    const result = ManifestSchema.parse(VALID_FIXTURE);
    expect(result.slug).toBe('test-app');
    expect(result.bundle.sizeBytesGz).toBe(204800);
  });

  it('rejects a missing required field (bundle.sizeBytesGz)', () => {
    const bad = { ...VALID_FIXTURE, bundle: { fileCount: 42 } };
    expect(() => ManifestSchema.parse(bad)).toThrow();
  });

  it('rejects slug with spaces', () => {
    expect(() => ManifestSchema.parse({ ...VALID_FIXTURE, slug: 'has spaces' })).toThrow();
  });

  it('rejects invalid gitSha (too short)', () => {
    expect(() => ManifestSchema.parse({ ...VALID_FIXTURE, gitSha: 'abc' })).toThrow();
  });
});

describe('validateManifestRaw', () => {
  it('accepts a valid JSON string', () => {
    const result = validateManifestRaw(JSON.stringify(VALID_FIXTURE));
    expect(result.ok).toBe(true);
  });

  it('rejects oversize manifest (>16 KB)', () => {
    const oversized = JSON.stringify({ ...VALID_FIXTURE, _pad: 'x'.repeat(16_001) });
    const result = validateManifestRaw(oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('too large');
  });

  it('rejects invalid manifest JSON', () => {
    const result = validateManifestRaw(JSON.stringify({ ...VALID_FIXTURE, slug: 'INVALID SLUG' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('invalid');
  });
});

describe('computeDrift', () => {
  it('returns current when versions match', () => {
    expect(computeDrift('0.3.0', '0.3.0')).toBe('current');
  });

  it('returns minor_behind when 1 minor behind', () => {
    expect(computeDrift('0.2.0', '0.3.0')).toBe('minor_behind');
  });

  it('returns major_behind when 2+ minors behind', () => {
    expect(computeDrift('0.1.0', '0.3.0')).toBe('major_behind');
  });

  it('returns major_behind when major version differs', () => {
    expect(computeDrift('0.3.0', '1.0.0')).toBe('major_behind');
  });
});

describe('app_manifests DB (UPSERT)', () => {
  it('creates table via initDb', async () => {
    const tables = await dbAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_manifests'"
    );
    expect(tables.length).toBe(1);
  });

  it('UPSERTs — second write for same slug replaces, leaving one row', async () => {
    const slug = 'upsert-test-' + Date.now();
    const insert = (v: string) =>
      dbRun(
        `INSERT INTO app_manifests
          (slug, schema_version, app_version, built_at, git_sha, git_branch,
           host_kit_version, golden_path, golden_expect, health_path,
           bundle_size_gz, bundle_files, manifest_json, updated_at)
         VALUES (?, 1, ?, '2026-05-08T12:00:00.000Z', 'abc1234', 'main',
                 '0.3.0', '/projects/test/', '', NULL, 10240, 20, '{}', ?)
         ON CONFLICT(slug) DO UPDATE SET
           app_version=excluded.app_version,
           updated_at=excluded.updated_at`,
        slug, v, Math.floor(Date.now() / 1000),
      );

    await insert('1.0.0');
    await insert('1.0.1');

    const rows = await dbAll<{ slug: string; app_version: string }>(
      `SELECT slug, app_version FROM app_manifests WHERE slug = ?`, slug
    );
    expect(rows.length).toBe(1);
    expect(rows[0].app_version).toBe('1.0.1');
  });
});
