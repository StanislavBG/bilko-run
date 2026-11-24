import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import type { Gate } from './index.js';

const TEMPLATE_URL = 'https://github.com/StanislavBG/bilko-run/blob/main/packages/host-kit/src/testing/golden.template.ts';
const SPEC_REL = join('tests', 'golden.spec.ts');

/**
 * Folders to check for tests/golden.spec.ts, nearest first: the published dist
 * folder's parent, then each parent up to and including sourceRepo. Never goes
 * above sourceRepo; a dist folder outside sourceRepo checks sourceRepo only.
 */
export function goldenSearchDirs(bundleDir: string, sourceRepo: string): string[] {
  const root = resolve(sourceRepo);
  const start = dirname(resolve(bundleDir));
  const rel = relative(root, start);
  if (rel.startsWith('..') || isAbsolute(rel)) return [root];
  const dirs: string[] = [];
  let dir = start;
  while (dir !== root) {
    dirs.push(dir);
    dir = dirname(dir);
  }
  dirs.push(root);
  return dirs;
}

export const goldenGate: Gate = async (ctx) => {
  if (!ctx.sourceRepo) {
    return {
      name: 'golden', status: 'fail',
      details: 'sourceRepo not provided to publish call — cannot locate golden.spec.ts',
    };
  }
  const checked = goldenSearchDirs(ctx.bundleDir, ctx.sourceRepo);
  const dir = checked.find((d) => existsSync(join(d, SPEC_REL)));
  if (!dir) {
    return {
      name: 'golden', status: 'fail',
      details: `tests/golden.spec.ts missing; checked: ${checked.join(', ')}. Copy the template from ${TEMPLATE_URL}.`,
    };
  }
  const spec = join(dir, SPEC_REL);
  const localBin = join(dir, 'node_modules', '.bin', 'playwright');
  const playwright = existsSync(localBin) ? JSON.stringify(localBin) : 'pnpm exec playwright';
  try {
    execSync(`${playwright} test tests/golden.spec.ts --reporter=line`, {
      cwd: dir, stdio: 'pipe', timeout: 120_000,
    });
    return { name: 'golden', status: 'pass', details: `${spec} green` };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string };
    const tail = (e.stdout?.toString() ?? '').split('\n').slice(-12).join('\n');
    return { name: 'golden', status: 'fail', details: `${spec} failed:\n${tail}` };
  }
};
