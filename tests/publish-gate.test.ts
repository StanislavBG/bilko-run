import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, mkdirSync, openSync, ftruncateSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import type { GateContext } from '../mcp-host-server/src/gates/index.js';

const FIXTURES = resolve(fileURLToPath(import.meta.url), '..', 'fixtures', 'bundles');

// ── Module mocks (hoisted by vitest) ────────────────────────────────────────

vi.mock('../mcp-host-server/src/db.js', () => ({
  mcpGet: vi.fn().mockResolvedValue(undefined),
  mcpRun: vi.fn().mockResolvedValue(undefined),
  getHostDb: vi.fn(),
  ensureGateTables: vi.fn(),
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        addScriptTag: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue([]),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return { ...actual, existsSync: vi.fn().mockImplementation(actual.existsSync) };
});

// ── Deferred imports (after mocks) ──────────────────────────────────────────

import { manifestGate } from '../mcp-host-server/src/gates/manifest.js';
import { budgetGate, GITHUB_FILE_LIMIT_BYTES } from '../mcp-host-server/src/gates/budget.js';

// A sparse file of n bytes: no real disk write, so 100 MiB fixtures stay fast.
function sparse(path: string, n: number): void {
  const fd = openSync(path, 'w');
  try { ftruncateSync(fd, n); } finally { closeSync(fd); }
}
import { a11yGate } from '../mcp-host-server/src/gates/a11y.js';
import { goldenGate } from '../mcp-host-server/src/gates/golden.js';
import { auditGate } from '../mcp-host-server/src/gates/audit.js';
import { runGates, gateSummary, gateLines } from '../mcp-host-server/src/gates/index.js';
import { mcpGet } from '../mcp-host-server/src/db.js';
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// ── Shared fixture manifest (matches valid/manifest.json) ────────────────────

const VALID_MANIFEST = {
  schemaVersion: 1 as const,
  slug: 'test-gate-app',
  version: '1.0.0',
  builtAt: '2026-05-08T12:00:00.000Z',
  gitSha: 'abc1234',
  gitBranch: 'main',
  hostKit: { version: '0.3.0' },
  golden: { path: '/projects/test-gate-app/', expect: 'Hello' },
  health: {},
  bundle: { sizeBytesGz: 50_000, fileCount: 5 },
};

function makeCtx(overrides: Partial<GateContext> = {}): GateContext {
  return {
    slug: 'test-gate-app',
    bundleDir: resolve(FIXTURES, 'valid'),
    bypass: new Set(),
    ...overrides,
  };
}

// ── manifest gate ────────────────────────────────────────────────────────────

describe('manifestGate', () => {
  it('pass: valid bundle', async () => {
    const ctx = makeCtx();
    const result = await manifestGate(ctx);
    expect(result.status).toBe('pass');
    expect(result.name).toBe('manifest');
    expect(ctx.manifest).toBeDefined();
    expect(ctx.manifest?.slug).toBe('test-gate-app');
  });

  it('fail: manifest.json missing', async () => {
    const ctx = makeCtx({ bundleDir: resolve(FIXTURES, 'no-manifest') });
    const result = await manifestGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('manifest.json missing');
  });

  it('fail: manifest schema invalid', async () => {
    const ctx = makeCtx({ bundleDir: resolve(FIXTURES, 'bad-manifest') });
    const result = await manifestGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toMatch(/schema errors|invalid/i);
  });

  it('fail: slug mismatch', async () => {
    const ctx = makeCtx({ slug: 'wrong-slug' });
    const result = await manifestGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('≠ registered slug');
  });
});

// ── budget gate ──────────────────────────────────────────────────────────────
// The gate measures real gzipped bytes under ctx.bundleDir (not the DB, not
// the manifest's self-reported size), so these fixtures write real files
// rather than mocking a size.

describe('budgetGate', () => {
  it('pass: small bundle reports measured size, file count and largest file', async () => {
    const ctx = makeCtx({ manifest: VALID_MANIFEST });
    const result = await budgetGate(ctx);
    expect(result.status).toBe('pass');
    expect(result.details).toMatch(/^measured \d+\.\d KB gz over \d+ files \(manifest reported 48\.8 KB\); largest file \S+ \d+\.\d MiB; no size budget, only GitHub's 100 MiB per-file limit$/);
  });

  it.each(['threewinds', 'brand-new-app'])('pass: a 2,600,000-byte incompressible bundle passes for %s', async (slug) => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-gate-big-'));
    writeFileSync(join(dir, 'blob.bin'), randomBytes(2_600_000));
    const result = await budgetGate(makeCtx({ slug, bundleDir: dir, manifest: VALID_MANIFEST }));
    expect(result.status).toBe('pass');
    expect(result.details).toContain('over 1 files');
    expect(result.details).toContain('largest file blob.bin 2.5 MiB');
  });

  it('fail: one file over GitHub\'s 100 MiB per-file limit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-gate-huge-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html>');
    sparse(join(dir, 'assets', 'huge.bin'), GITHUB_FILE_LIMIT_BYTES + 1);
    const result = await budgetGate(makeCtx({ bundleDir: dir, manifest: VALID_MANIFEST }));
    expect(result.status).toBe('fail');
    expect(result.details).toBe('assets/huge.bin is 100.0 MiB; GitHub rejects files over 100 MiB, so this bundle cannot be pushed');
  });

  it('pass: a file of exactly 100 MiB is allowed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-gate-edge-'));
    sparse(join(dir, 'edge.bin'), 104_857_600);
    const result = await budgetGate(makeCtx({ bundleDir: dir, manifest: VALID_MANIFEST }));
    expect(result.status).toBe('pass');
    expect(result.details).toContain('largest file edge.bin 100.0 MiB');
  });

  it('pass: manifest under-reports size; details show measured and reported numbers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-gate-underreport-'));
    writeFileSync(join(dir, 'blob.bin'), randomBytes(250_000));
    const underReportingManifest = { ...VALID_MANIFEST, bundle: { sizeBytesGz: 50_000, fileCount: 1 } };
    const ctx = makeCtx({ bundleDir: dir, manifest: underReportingManifest });
    const result = await budgetGate(ctx);
    expect(result.status).toBe('pass');
    // mentions both the measured (actual) and manifest-reported numbers
    expect(result.details).toContain('48.8 KB');
    expect(result.details).toMatch(/2\d\d\.\d KB/);
  });

  it('fail: manifest not loaded', async () => {
    const ctx = makeCtx({ manifest: undefined });
    const result = await budgetGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toBe('manifest not loaded');
  });
});

// ── a11y gate ────────────────────────────────────────────────────────────────

// A browser whose axe scan finds no violations.
function mockCleanBrowser(): void {
  vi.mocked(chromium.launch).mockResolvedValue({
    newPage: vi.fn().mockResolvedValue({
      goto: vi.fn().mockResolvedValue(undefined),
      addScriptTag: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue([]),
    }),
    close: vi.fn().mockResolvedValue(undefined),
  } as never);
}

describe('a11yGate', () => {
  beforeEach(mockCleanBrowser);

  it('pass: zero violations returned by mocked axe', async () => {
    const ctx = makeCtx({ manifest: VALID_MANIFEST });
    const result = await a11yGate(ctx);
    expect(result.status).toBe('pass');
    expect(result.details).toContain('0 serious');
  });

  it('fail: serious violations found', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      addScriptTag: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue([
        { id: 'color-contrast', impact: 'serious', help: 'Elements must have sufficient color contrast', nodes: [{}, {}] },
        { id: 'label', impact: 'critical', help: 'Form elements must have labels', nodes: [{}] },
      ]),
    };
    vi.mocked(chromium.launch).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    } as never);

    const ctx = makeCtx({ manifest: VALID_MANIFEST });
    const result = await a11yGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('2 serious/critical');
    expect(result.data?.violations).toBeDefined();
  });

  it('fail: manifest not loaded', async () => {
    const ctx = makeCtx({ manifest: undefined });
    const result = await a11yGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toBe('manifest not loaded');
  });
});

// ── golden gate ──────────────────────────────────────────────────────────────

describe('goldenGate', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockImplementation((p) => {
      // Default: spec file exists
      const path = String(p);
      return path.endsWith('golden.spec.ts') ? true : require('node:fs').existsSync(p);
    });
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
  });

  it('fail: no sourceRepo provided', async () => {
    const ctx = makeCtx({ sourceRepo: undefined });
    const result = await goldenGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('sourceRepo not provided');
  });

  it('fail: golden.spec.ts missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const ctx = makeCtx({ sourceRepo: '/tmp/fake-repo' });
    const result = await goldenGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('golden.spec.ts missing');
  });

  it('fail: missing golden.spec.ts names a template location that exists', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const ctx = makeCtx({ sourceRepo: '/tmp/fake-repo' });
    const result = await goldenGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toBe(
      'tests/golden.spec.ts missing; checked: /tmp/fake-repo. Copy the template from '
      + 'https://github.com/StanislavBG/bilko-run/blob/main/packages/host-kit/src/testing/golden.template.ts.',
    );
    expect(result.details).not.toContain('golden.template.ts.txt');
  });

  it('pass: playwright test succeeds', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue(Buffer.from('1 passed'));
    const ctx = makeCtx({ sourceRepo: '/tmp/fake-repo' });
    const result = await goldenGate(ctx);
    expect(result.status).toBe('pass');
    expect(result.details).toBe('/tmp/fake-repo/tests/golden.spec.ts green');
  });

  it('fail: playwright test exits non-zero', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const err = Object.assign(new Error('Command failed'), { stdout: Buffer.from('1 failed') });
    vi.mocked(execSync).mockImplementation(() => { throw err; });
    const ctx = makeCtx({ sourceRepo: '/tmp/fake-repo' });
    const result = await goldenGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('golden.spec.ts failed');
  });
});

// ── audit gate ───────────────────────────────────────────────────────────────

describe('auditGate', () => {
  it('fail: no sourceRepo provided', async () => {
    const ctx = makeCtx({ sourceRepo: undefined });
    const result = await auditGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toBe('sourceRepo missing');
  });

  it('pass: audit exits 0 with no vulns', async () => {
    const clean = JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } });
    vi.mocked(execSync).mockReturnValue(clean as never);
    const ctx = makeCtx({ sourceRepo: '/tmp/fake-repo' });
    const result = await auditGate(ctx);
    expect(result.status).toBe('pass');
    expect(result.details).toBe('no high/critical CVEs');
  });

  it('fail: audit exits non-zero with high vulns in stdout JSON', async () => {
    const vulnJson = JSON.stringify({ metadata: { vulnerabilities: { high: 2, critical: 0 } } });
    const err = Object.assign(new Error('Command failed'), { stdout: Buffer.from(vulnJson) });
    vi.mocked(execSync).mockImplementation(() => { throw err; });
    const ctx = makeCtx({ sourceRepo: '/tmp/fake-repo' });
    const result = await auditGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('2 high');
  });

  it('fail: audit exits non-zero and stdout is not JSON', async () => {
    const err = Object.assign(new Error('Command failed'), { stdout: Buffer.from('network error') });
    vi.mocked(execSync).mockImplementation(() => { throw err; });
    const ctx = makeCtx({ sourceRepo: '/tmp/fake-repo' });
    const result = await auditGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('pnpm audit failed');
  });

  it('uses npm audit in an npm-only repo (package-lock.json, no pnpm-lock.yaml)', async () => {
    const clean = JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } });
    vi.mocked(execSync).mockReturnValue(clean as never);
    vi.mocked(existsSync).mockImplementation((p) => String(p) === '/tmp/fake-npm-repo/package-lock.json');
    try {
      const result = await auditGate(makeCtx({ sourceRepo: '/tmp/fake-npm-repo' }));
      expect(result.status).toBe('pass');
      expect(vi.mocked(execSync).mock.lastCall?.[0]).toBe('npm audit --omit=dev --audit-level=high --json');
    } finally {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      vi.mocked(existsSync).mockImplementation(actual.existsSync);
    }
  });

  it('keeps pnpm audit when pnpm-lock.yaml is present', async () => {
    const clean = JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } });
    vi.mocked(execSync).mockReturnValue(clean as never);
    vi.mocked(existsSync).mockImplementation((p) => String(p).startsWith('/tmp/fake-both-repo/'));
    try {
      await auditGate(makeCtx({ sourceRepo: '/tmp/fake-both-repo' }));
      expect(vi.mocked(execSync).mock.lastCall?.[0]).toBe('pnpm audit --prod --audit-level=high --json');
    } finally {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      vi.mocked(existsSync).mockImplementation(actual.existsSync);
    }
  });
});

// ── runGates integration ─────────────────────────────────────────────────────

describe('runGates', () => {
  it('short-circuits after manifest failure', async () => {
    const ctx = makeCtx({ bundleDir: resolve(FIXTURES, 'no-manifest') });
    const results = await runGates(ctx);
    const names = results.map(r => r.name);
    expect(names).toContain('manifest');
    // Only manifest gate ran — rest short-circuited
    expect(names.length).toBe(1);
    expect(results[0].status).toBe('fail');
  });

  it('marks bypassed gates as skipped', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('') as never);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(mcpGet).mockResolvedValue(undefined);
    const ctx = makeCtx({
      manifest: VALID_MANIFEST,
      bypass: new Set(['golden', 'a11y', 'audit']),
      sourceRepo: '/tmp/fake-repo',
    });
    // Run budget + skips for the rest (manifest was pre-loaded so we skip the manifest gate too)
    ctx.manifest = VALID_MANIFEST;
    const results = await runGates(ctx);
    const skipped = results.filter(r => r.status === 'skipped');
    expect(skipped.map(r => r.name)).toEqual(expect.arrayContaining(['golden', 'a11y', 'audit']));
  });

  it('gateLines keeps the name=status summary and adds the budget gate\'s measured size', async () => {
    // Real manifest, budget and share-assets gates on the valid bundle; golden, a11y and audit mocked green.
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith('golden.spec.ts') || actual.existsSync(p));
    vi.mocked(execSync).mockReturnValue(JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } }) as never);
    mockCleanBrowser();
    try {
      const results = await runGates(makeCtx({ sourceRepo: '/tmp/fake-repo' }));
      expect(gateSummary(results).ok).toBe(true);

      const budget = results.find(r => r.name === 'budget')!;
      expect(budget.details).toMatch(/^measured \d+\.\d KB gz over \d+ files \(manifest reported 48\.8 KB\); largest file \S+ \d+\.\d MiB; no size budget, only GitHub's 100 MiB per-file limit$/);

      const lines = gateLines(results);
      expect(lines[0]).toBe('gates: manifest=pass, budget=pass, golden=pass, a11y=pass, audit=pass, share-assets=pass');
      expect(lines).toContain(`  budget: ${budget.details}`);
      expect(lines.slice(1)).toEqual(results.map(r => `  ${r.name}: ${r.details}`));
    } finally {
      vi.mocked(existsSync).mockImplementation(actual.existsSync);
    }
  });

  it('gateSummary returns ok when all pass', () => {
    const results = [
      { name: 'manifest', status: 'pass' as const, details: '' },
      { name: 'budget', status: 'pass' as const, details: '' },
    ];
    const s = gateSummary(results);
    expect(s.ok).toBe(true);
    expect(s.failed).toHaveLength(0);
  });

  it('gateSummary returns failed names when gates fail', () => {
    const results = [
      { name: 'manifest', status: 'pass' as const, details: '' },
      { name: 'budget', status: 'fail' as const, details: 'too big' },
      { name: 'a11y', status: 'fail' as const, details: 'contrast' },
    ];
    const s = gateSummary(results);
    expect(s.ok).toBe(false);
    expect(s.failed).toEqual(['budget', 'a11y']);
  });
});
