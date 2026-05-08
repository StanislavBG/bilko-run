import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { budgetGate } from '../mcp-host-server/src/gates/budget.js';
import { a11yGate } from '../mcp-host-server/src/gates/a11y.js';
import { goldenGate } from '../mcp-host-server/src/gates/golden.js';
import { auditGate } from '../mcp-host-server/src/gates/audit.js';
import { runGates, gateSummary } from '../mcp-host-server/src/gates/index.js';
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

describe('budgetGate', () => {
  beforeEach(() => {
    vi.mocked(mcpGet).mockResolvedValue(undefined); // no DB row → uses default 200 KB
  });

  it('pass: bundle within default 200 KB budget', async () => {
    const ctx = makeCtx({ manifest: VALID_MANIFEST });
    const result = await budgetGate(ctx);
    expect(result.status).toBe('pass');
    expect(result.details).toContain('48.8 KB gz');
  });

  it('fail: bundle exceeds default budget', async () => {
    const oversizeManifest = { ...VALID_MANIFEST, bundle: { sizeBytesGz: 512_000, fileCount: 5 } };
    const ctx = makeCtx({ manifest: oversizeManifest });
    const result = await budgetGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('exceeds budget');
  });

  it('fail: bundle exceeds custom DB budget', async () => {
    vi.mocked(mcpGet).mockResolvedValue({ max_size_gz_bytes: 40_000 } as never);
    const ctx = makeCtx({ manifest: VALID_MANIFEST }); // 50 KB > 40 KB limit
    const result = await budgetGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toContain('exceeds budget');
  });

  it('pass: bundle within custom DB budget', async () => {
    vi.mocked(mcpGet).mockResolvedValue({ max_size_gz_bytes: 100_000 } as never);
    const ctx = makeCtx({ manifest: VALID_MANIFEST }); // 50 KB < 100 KB limit
    const result = await budgetGate(ctx);
    expect(result.status).toBe('pass');
  });

  it('fail: manifest not loaded', async () => {
    const ctx = makeCtx({ manifest: undefined });
    const result = await budgetGate(ctx);
    expect(result.status).toBe('fail');
    expect(result.details).toBe('manifest not loaded');
  });
});

// ── a11y gate ────────────────────────────────────────────────────────────────

describe('a11yGate', () => {
  beforeEach(() => {
    vi.mocked(chromium.launch).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        addScriptTag: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue([]),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

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

  it('pass: playwright test succeeds', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue(Buffer.from('1 passed'));
    const ctx = makeCtx({ sourceRepo: '/tmp/fake-repo' });
    const result = await goldenGate(ctx);
    expect(result.status).toBe('pass');
    expect(result.details).toBe('golden.spec.ts green');
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
