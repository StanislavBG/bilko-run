import { execSync } from 'node:child_process';
import type { Gate } from './index.js';

interface AuditJson {
  metadata?: { vulnerabilities?: { high?: number; critical?: number } };
}

function parseCounts(json: AuditJson): { high: number; crit: number } {
  return {
    high: json.metadata?.vulnerabilities?.high ?? 0,
    crit: json.metadata?.vulnerabilities?.critical ?? 0,
  };
}

export const auditGate: Gate = async (ctx) => {
  if (!ctx.sourceRepo) return { name: 'audit', status: 'fail', details: 'sourceRepo missing' };
  try {
    const out = execSync('pnpm audit --prod --audit-level=high --json', {
      cwd: ctx.sourceRepo, stdio: 'pipe', timeout: 60_000, encoding: 'utf8',
    });
    const { high, crit } = parseCounts(JSON.parse(out) as AuditJson);
    if (high + crit > 0) {
      return { name: 'audit', status: 'fail', details: `${crit} critical / ${high} high CVE(s)` };
    }
    return { name: 'audit', status: 'pass', details: 'no high/critical CVEs' };
  } catch (err: unknown) {
    // pnpm audit exits non-zero when vulns found but still prints JSON to stdout.
    const e = err as { stdout?: Buffer | string; message?: string };
    const stdout = e.stdout?.toString() ?? '';
    try {
      const { high, crit } = parseCounts(JSON.parse(stdout) as AuditJson);
      if (high + crit > 0) {
        return { name: 'audit', status: 'fail', details: `${crit} critical / ${high} high CVE(s)` };
      }
      return { name: 'audit', status: 'pass', details: 'no high/critical CVEs' };
    } catch {
      return { name: 'audit', status: 'fail', details: `pnpm audit failed: ${e.message ?? 'unknown error'}` };
    }
  }
};
