import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Spawns the pure-local heartbeat checker only — never curl or claude -p (see
// tests/blog-cadence-watchdog.test.ts's postmortem note on that boundary).
const SCRIPT = join(__dirname, '../scripts/check-blog-watchdog-heartbeat.sh');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runChecker(heartbeatPath: string): RunResult {
  try {
    const stdout = execFileSync('bash', [SCRIPT], {
      env: { ...process.env, BLOG_WATCHDOG_HEARTBEAT_FILE: heartbeatPath },
      timeout: 10_000,
      encoding: 'utf-8',
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('check-blog-watchdog-heartbeat.sh', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'blog-heartbeat-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeHeartbeat(name: string, contents: string): string {
    const p = join(dir, name);
    writeFileSync(p, contents);
    return p;
  }

  const freshTs = () => new Date().toISOString();
  const staleTs = () => new Date(Date.now() - 40 * 3600 * 1000).toISOString();

  it('exits 0 for a fresh ok: status', () => {
    const p = writeHeartbeat('ok.txt', `${freshTs()} ok: within cadence gap=1d no action`);
    expect(runChecker(p).status).toBe(0);
  });

  it('exits 1 for a fresh warn: status and quotes the status text', () => {
    const p = writeHeartbeat(
      'warn.txt',
      `${freshTs()} warn: 1 unreviewed draft(s) pending review, oldest 3d`
    );
    const result = runChecker(p);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/WARNING/);
    expect(result.stderr).toMatch(/unreviewed draft\(s\) pending review, oldest 3d/);
  });

  it('exits 1 for a fresh error: status', () => {
    const p = writeHeartbeat('error.txt', `${freshTs()} error: claude -p exited 1`);
    const result = runChecker(p);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/CRITICAL/);
  });

  it('exits 1 for a stale ok: status (staleness wins regardless of status text)', () => {
    const p = writeHeartbeat('stale-ok.txt', `${staleTs()} ok: within cadence gap=1d no action`);
    const result = runChecker(p);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/CRITICAL/);
  });

  it('exits 1 for a malformed file with no status field after the timestamp', () => {
    const p = writeHeartbeat('malformed.txt', `${freshTs()}`);
    const result = runChecker(p);
    expect(result.status).toBe(1);
  });

  it('exits 1 for an empty file', () => {
    const p = writeHeartbeat('empty.txt', '');
    const result = runChecker(p);
    expect(result.status).toBe(1);
  });

  it('exits 1 for an unrecognized status prefix (fail closed)', () => {
    const p = writeHeartbeat('unknown.txt', `${freshTs()} weird: something happened`);
    const result = runChecker(p);
    expect(result.status).toBe(1);
  });

  it('exits 1 for a missing heartbeat file', () => {
    const result = runChecker(join(dir, 'does-not-exist.txt'));
    expect(result.status).toBe(1);
  });
});
