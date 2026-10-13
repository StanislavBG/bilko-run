import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
function parseCounts(json) {
    return {
        high: json.metadata?.vulnerabilities?.high ?? 0,
        crit: json.metadata?.vulnerabilities?.critical ?? 0,
    };
}
// pnpm by default; npm for npm-only repos (package-lock.json, no pnpm-lock.yaml).
function auditTool(repo) {
    if (!existsSync(join(repo, 'pnpm-lock.yaml')) && existsSync(join(repo, 'package-lock.json'))) {
        return { tool: 'npm', cmd: 'npm audit --omit=dev --audit-level=high --json' };
    }
    return { tool: 'pnpm', cmd: 'pnpm audit --prod --audit-level=high --json' };
}
export const auditGate = async (ctx) => {
    if (!ctx.sourceRepo)
        return { name: 'audit', status: 'fail', details: 'sourceRepo missing' };
    const { tool, cmd } = auditTool(ctx.sourceRepo);
    try {
        const out = execSync(cmd, {
            cwd: ctx.sourceRepo, stdio: 'pipe', timeout: 60_000, encoding: 'utf8',
        });
        const { high, crit } = parseCounts(JSON.parse(out));
        if (high + crit > 0) {
            return { name: 'audit', status: 'fail', details: `${crit} critical / ${high} high CVE(s)` };
        }
        return { name: 'audit', status: 'pass', details: 'no high/critical CVEs' };
    }
    catch (err) {
        // pnpm/npm audit exit non-zero when vulns found but still prints JSON to stdout.
        const e = err;
        const stdout = e.stdout?.toString() ?? '';
        try {
            const { high, crit } = parseCounts(JSON.parse(stdout));
            if (high + crit > 0) {
                return { name: 'audit', status: 'fail', details: `${crit} critical / ${high} high CVE(s)` };
            }
            return { name: 'audit', status: 'pass', details: 'no high/critical CVEs' };
        }
        catch {
            return { name: 'audit', status: 'fail', details: `${tool} audit failed: ${e.message ?? 'unknown error'}` };
        }
    }
};
