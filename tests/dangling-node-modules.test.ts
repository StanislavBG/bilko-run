import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countDanglingLinks, describeDanglingModule } from '../mcp-host-server/src/gates/dangling-deps.js';

const { assertOwnNodeModules } = createRequire(import.meta.url)('../.pnpmfile.cjs') as {
  assertOwnNodeModules: (dir: string) => void;
};

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'dangling-'));
}

describe('describeDanglingModule (publish a11y gate)', () => {
  it('names the dangling link, its target and the repair command', () => {
    const root = tmp();
    const modules = join(root, 'node_modules');
    mkdirSync(join(modules, '@playwright'), { recursive: true });
    symlinkSync('/gone/worktree/.pnpm/@playwright+test/node_modules/@playwright/test', join(modules, '@playwright', 'test'));
    symlinkSync('/gone/worktree/.pnpm/vite/node_modules/vite', join(modules, 'vite'));
    mkdirSync(join(modules, 'zod'));
    const from = join(root, 'mcp-host-server', 'dist', 'gates');
    mkdirSync(from, { recursive: true });

    const msg = describeDanglingModule(['playwright', '@playwright/test'], from);
    expect(msg).toContain(join(modules, '@playwright', 'test'));
    expect(msg).toContain('-> /gone/worktree/');
    expect(msg).toContain('2 top-level link(s)');
    expect(msg).toContain(`cd ${root} && CI=true pnpm install --frozen-lockfile`);
  });

  it('returns null when the module is simply absent', () => {
    const root = tmp();
    mkdirSync(join(root, 'node_modules'));
    expect(describeDanglingModule(['@playwright/test'], root)).toBeNull();
  });

  it('does not count live links', () => {
    const root = tmp();
    const modules = join(root, 'node_modules');
    mkdirSync(join(modules, '.pnpm', 'zod'), { recursive: true });
    symlinkSync(join(modules, '.pnpm', 'zod'), join(modules, 'zod'));
    expect(countDanglingLinks(modules)).toBe(0);
  });
});

describe('.pnpmfile.cjs install guard', () => {
  it('refuses to install through a symlinked node_modules', () => {
    const main = tmp();
    mkdirSync(join(main, 'node_modules'));
    const worktree = tmp();
    symlinkSync(join(main, 'node_modules'), join(worktree, 'node_modules'));
    expect(() => assertOwnNodeModules(worktree)).toThrow(/is a symlink to .*rm node_modules/);
  });

  it('allows a real node_modules dir or none at all', () => {
    const own = tmp();
    mkdirSync(join(own, 'node_modules'));
    expect(() => assertOwnNodeModules(own)).not.toThrow();
    expect(() => assertOwnNodeModules(tmp())).not.toThrow();
  });
});
