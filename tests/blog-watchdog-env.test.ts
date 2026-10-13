import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

// Sources the env file under a bare systemd-like environment. Never invokes
// curl, claude -p, or the watchdog itself (it calls production bilko.run).
const ROOT = join(__dirname, '..');
const ENV_FILE = join(ROOT, 'scripts/blog-watchdog-env.sh');

describe('blog-watchdog-env.sh', () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'blog-watchdog-env-'));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  function stub(rel: string) {
    const path = join(home, rel);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  }

  function missing(): string {
    const r = spawnSync(
      'env',
      ['-i', `HOME=${home}`, 'PATH=/usr/bin:/bin', 'bash', '-c', `source ${ENV_FILE}; watchdog_missing_binaries`],
      { encoding: 'utf8' },
    );
    return r.stdout;
  }

  it('resolves pnpm and claude from ~/.npm-global/bin and ~/.local/bin', () => {
    stub('.npm-global/bin/pnpm');
    stub('.local/bin/claude');
    const out = missing();
    expect(out).not.toContain('pnpm');
    expect(out).not.toContain('claude');
  });

  it('reports pnpm and claude missing when the stubs are absent', () => {
    const out = missing();
    expect(out).toContain('pnpm');
    expect(out).toContain('claude');
  });

  it.skipIf(!existsSync(join(homedir(), '.npm-global/bin/pnpm')))(
    'runs the cadence gate under a bare PATH once the env file is sourced',
    () => {
      const r = spawnSync(
        'env',
        [
          '-i',
          `HOME=${homedir()}`,
          'PATH=/usr/bin:/bin',
          'bash',
          '-c',
          'source scripts/blog-watchdog-env.sh && timeout 180 pnpm tsx scripts/blog-cadence-gate.ts next-slot',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      );
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    },
    200_000,
  );
});
