import { execSync } from 'node:child_process';
function parseCounts(json) {
    return {
        high: json.metadata?.vulnerabilities?.high ?? 0,
        crit: json.metadata?.vulnerabilities?.critical ?? 0,
    };
}
export const auditGate = async (ctx) => {
    if (!ctx.sourceRepo)
        return { name: 'audit', status: 'fail', details: 'sourceRepo missing' };
    try {
        const out = execSync('pnpm audit --prod --audit-level=high --json', {
            cwd: ctx.sourceRepo, stdio: 'pipe', timeout: 60_000, encoding: 'utf8',
        });
        const { high, crit } = parseCounts(JSON.parse(out));
        if (high + crit > 0) {
            return { name: 'audit', status: 'fail', details: `${crit} critical / ${high} high CVE(s)` };
        }
        return { name: 'audit', status: 'pass', details: 'no high/critical CVEs' };
    }
    catch (err) {
        // pnpm audit exits non-zero when vulns found but still prints JSON to stdout.
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
            return { name: 'audit', status: 'fail', details: `pnpm audit failed: ${e.message ?? 'unknown error'}` };
        }
    }
};
