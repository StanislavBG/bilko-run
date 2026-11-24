import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GateContext } from '../mcp-host-server/src/gates/index.js';

// Never launch a real Playwright run: the gate's execSync is stubbed.
vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

import { execSync } from 'node:child_process';
import { goldenGate } from '../mcp-host-server/src/gates/golden.js';

const TEMPLATE = 'https://github.com/StanislavBG/bilko-run/blob/main/packages/host-kit/src/testing/golden.template.ts';

let repo: string;

function touch(path: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, '');
}

function ctx(bundleDir: string, sourceRepo: string = repo): GateContext {
  mkdirSync(bundleDir, { recursive: true });
  return { slug: 'golden-app', bundleDir, sourceRepo, bypass: new Set() };
}

function lastCall(): { cmd: string; cwd: string } {
  const call = vi.mocked(execSync).mock.calls.at(-1)!;
  return { cmd: String(call[0]), cwd: String((call[1] as { cwd: string }).cwd) };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'golden-gate-'));
  vi.mocked(execSync).mockReset();
  vi.mocked(execSync).mockReturnValue(Buffer.from('1 passed'));
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('goldenGate spec lookup', () => {
  it('root spec: dist at <repo>/dist runs from the repo root with pnpm exec', async () => {
    touch(join(repo, 'tests', 'golden.spec.ts'));
    const result = await goldenGate(ctx(join(repo, 'dist')));
    expect(result.status).toBe('pass');
    expect(result.details).toContain(join(repo, 'tests', 'golden.spec.ts'));
    const { cmd, cwd } = lastCall();
    expect(cwd).toBe(repo);
    expect(cmd).toBe('pnpm exec playwright test tests/golden.spec.ts --reporter=line');
  });

  it('subfolder spec: dist at app/dist uses app/tests/golden.spec.ts and app/node_modules/.bin/playwright', async () => {
    const app = join(repo, 'app');
    touch(join(repo, 'tests', 'golden.spec.ts')); // root spec exists too; nearest wins
    touch(join(app, 'tests', 'golden.spec.ts'));
    touch(join(app, 'node_modules', '.bin', 'playwright'));
    const result = await goldenGate(ctx(join(app, 'dist')));
    expect(result.status).toBe('pass');
    expect(result.details).toContain(join(app, 'tests', 'golden.spec.ts'));
    const { cmd, cwd } = lastCall();
    expect(cwd).toBe(app);
    expect(cmd).toBe(`${JSON.stringify(join(app, 'node_modules', '.bin', 'playwright'))} test tests/golden.spec.ts --reporter=line`);
  });

  it('subfolder dist with only a root spec walks up to the root', async () => {
    touch(join(repo, 'tests', 'golden.spec.ts'));
    const result = await goldenGate(ctx(join(repo, 'web', 'remote-app', 'dist')));
    expect(result.status).toBe('pass');
    expect(lastCall().cwd).toBe(repo);
  });

  it('fail details name the spec path that ran', async () => {
    const app = join(repo, 'app');
    touch(join(app, 'tests', 'golden.spec.ts'));
    const err = Object.assign(new Error('Command failed'), { stdout: Buffer.from('1 failed') });
    vi.mocked(execSync).mockImplementation(() => { throw err; });
    const result = await goldenGate(ctx(join(app, 'dist')));
    expect(result.status).toBe('fail');
    expect(result.details).toContain(join(app, 'tests', 'golden.spec.ts'));
    expect(result.details).toContain('1 failed');
  });

  it('no spec: names every folder checked and the template link', async () => {
    const app = join(repo, 'web', 'app');
    const result = await goldenGate(ctx(join(app, 'dist')));
    expect(result.status).toBe('fail');
    expect(result.details).toContain('tests/golden.spec.ts missing');
    expect(result.details).toContain(`${app}, ${join(repo, 'web')}, ${repo}`);
    expect(result.details).toContain(TEMPLATE);
    expect(execSync).not.toHaveBeenCalled();
  });

  it('never looks above sourceRepo, even when dist is outside it', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'golden-outside-'));
    try {
      // A spec above/outside sourceRepo must be ignored.
      touch(join(outside, 'tests', 'golden.spec.ts'));
      const inner = join(outside, 'repo');
      mkdirSync(inner, { recursive: true });
      const r1 = await goldenGate(ctx(join(outside, 'dist'), inner));
      expect(r1.status).toBe('fail');
      expect(r1.details).toContain(`checked: ${inner}.`);
      expect(r1.details).not.toContain(`${outside},`);

      // dist path with .. that escapes sourceRepo is treated as outside it.
      const r2 = await goldenGate(ctx(join(inner, '..', 'elsewhere', 'dist'), inner));
      expect(r2.status).toBe('fail');
      expect(r2.details).toContain(`checked: ${inner}.`);
      expect(execSync).not.toHaveBeenCalled();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
