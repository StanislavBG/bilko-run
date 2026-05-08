import type { Manifest } from '../manifest-schema.js';

export interface GateContext {
  slug:        string;
  bundleDir:   string;        // /home/bilko/Projects/Bilko/public/projects/<slug>/ (staged)
  sourceRepo?: string;        // absolute path to sibling source repo, if known
  manifest?:   Manifest;      // pre-validated by the manifest gate
  bypass:      Set<string>;   // gate names the caller asked to skip
  adminEmail?: string;        // for audit log
}

export interface GateResult {
  name:    string;
  status:  'pass' | 'fail' | 'skipped';
  details: string;
  data?:   Record<string, unknown>;
}

export type Gate = (ctx: GateContext) => Promise<GateResult>;

import { manifestGate } from './manifest.js';
import { budgetGate }   from './budget.js';
import { a11yGate }     from './a11y.js';
import { goldenGate }   from './golden.js';
import { auditGate }    from './audit.js';

const GATES: Gate[] = [manifestGate, budgetGate, goldenGate, a11yGate, auditGate];

export async function runGates(ctx: GateContext): Promise<GateResult[]> {
  const results: GateResult[] = [];
  for (const gate of GATES) {
    const name = gate.name.replace(/Gate$/, '').toLowerCase();
    if (ctx.bypass.has(name)) {
      results.push({ name, status: 'skipped', details: 'bypassed by admin' });
      continue;
    }
    try {
      results.push(await gate(ctx));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name, status: 'fail', details: `gate threw: ${msg}` });
    }
    // Short-circuit: if manifest gate failed, later gates are meaningless.
    if (name === 'manifest' && results[results.length - 1].status === 'fail') break;
  }
  return results;
}

export function gateSummary(results: GateResult[]): { ok: boolean; failed: string[] } {
  const failed = results.filter(r => r.status === 'fail').map(r => r.name);
  return { ok: failed.length === 0, failed };
}
