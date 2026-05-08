import { manifestGate } from './manifest.js';
import { budgetGate } from './budget.js';
import { a11yGate } from './a11y.js';
import { goldenGate } from './golden.js';
import { auditGate } from './audit.js';
const GATES = [manifestGate, budgetGate, goldenGate, a11yGate, auditGate];
export async function runGates(ctx) {
    const results = [];
    for (const gate of GATES) {
        const name = gate.name.replace(/Gate$/, '').toLowerCase();
        if (ctx.bypass.has(name)) {
            results.push({ name, status: 'skipped', details: 'bypassed by admin' });
            continue;
        }
        try {
            results.push(await gate(ctx));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ name, status: 'fail', details: `gate threw: ${msg}` });
        }
        // Short-circuit: if manifest gate failed, later gates are meaningless.
        if (name === 'manifest' && results[results.length - 1].status === 'fail')
            break;
    }
    return results;
}
export function gateSummary(results) {
    const failed = results.filter(r => r.status === 'fail').map(r => r.name);
    return { ok: failed.length === 0, failed };
}
