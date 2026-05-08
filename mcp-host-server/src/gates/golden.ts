import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { Gate } from './index.js';

export const goldenGate: Gate = async (ctx) => {
  if (!ctx.sourceRepo) {
    return {
      name: 'golden', status: 'fail',
      details: 'sourceRepo not provided to publish call — cannot locate golden.spec.ts',
    };
  }
  const spec = join(ctx.sourceRepo, 'tests', 'golden.spec.ts');
  if (!existsSync(spec)) {
    return {
      name: 'golden', status: 'fail',
      details: `tests/golden.spec.ts missing in ${ctx.sourceRepo}. Copy template from @bilkobibitkov/host-kit/dist/testing/golden.template.ts.txt.`,
    };
  }
  try {
    execSync('pnpm exec playwright test tests/golden.spec.ts --reporter=line', {
      cwd: ctx.sourceRepo, stdio: 'pipe', timeout: 120_000,
    });
    return { name: 'golden', status: 'pass', details: 'golden.spec.ts green' };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string };
    const tail = (e.stdout?.toString() ?? '').split('\n').slice(-12).join('\n');
    return { name: 'golden', status: 'fail', details: `golden.spec.ts failed:\n${tail}` };
  }
};
