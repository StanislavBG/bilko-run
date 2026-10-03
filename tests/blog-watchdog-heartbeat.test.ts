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

describe('check-blog-watchdog-heartbeat.sh', () => {
  let dir: string;
  let fakeSystemctl: string;
  let retryMarkerFile: string;

  function runChecker(heartbeatPath: string): RunResult {
    try {
      const stdout = execFileSync('bash', [SCRIPT], {
        env: {
          ...process.env,
          BLOG_WATCHDOG_HEARTBEAT_FILE: heartbeatPath,
          // Never let a test touch the real systemd service or the real
          // retry marker file — both are stubbed/isolated into the tmp dir.
          SYSTEMCTL: fakeSystemctl,
          BLOG_WATCHDOG_RETRY_MARKER_FILE: retryMarkerFile,
        },
        timeout: 10_000,
        encoding: 'utf-8',
      });
      return { status: 0, stdout, stderr: '' };
    } catch (err: unknown) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { status: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
    }
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'blog-heartbeat-'));
    fakeSystemctl = join(dir, 'fake-systemctl.sh');
    writeFileSync(
      fakeSystemctl,
      '#!/usr/bin/env bash\n' +
        'if [[ "$1 $2" == "--user is-active" ]]; then\n' +
        '  echo inactive\n' +
        '  exit 3\n' +
        'fi\n' +
        'exit 0\n',
      { mode: 0o755 }
    );
    retryMarkerFile = join(dir, '.watchdog-retry-test');
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

// should_retry is a pure function sourced directly out of the script (guarded
// by a BASH_SOURCE/$0 check so sourcing it never runs the file-reading main
// logic above). Never calls real systemctl.
function runShouldRetry(
  status: string,
  nowEpoch: number,
  markerContents: string,
  serviceActive: string
): string {
  return execFileSync(
    'bash',
    [
      '-c',
      'source "$1"; should_retry "$2" "$3" "$4" "$5"',
      '_',
      SCRIPT,
      status,
      String(nowEpoch),
      markerContents,
      serviceActive,
    ],
    { timeout: 10_000, encoding: 'utf-8' }
  ).trim();
}

describe('should_retry', () => {
  // Fixed mid-afternoon PT timestamp, not Date.now(): a real-clock "now"
  // near PT midnight would make "N hours ago" cross into the previous PT
  // calendar day and make the same-day-count tests flaky.
  const now = Math.floor(new Date('2026-06-15T20:00:00Z').getTime() / 1000);

  it('retries on error: status with no prior marker and an inactive service', () => {
    expect(runShouldRetry('error: claude -p exited 1', now, '', 'inactive')).toBe('retry');
  });

  it('retries on warn: status with no prior marker and an inactive service', () => {
    expect(runShouldRetry('warn: over cadence, skipping', now, '', 'inactive')).toBe('retry');
  });

  it('does not retry on ok: status', () => {
    expect(runShouldRetry('ok: within cadence', now, '', 'inactive')).toBe('none');
  });

  it('does not retry within 6h of the last retry', () => {
    const lastRetry = now - 3600; // 1h ago
    expect(runShouldRetry('error: claude -p exited 1', now, String(lastRetry), 'inactive')).toBe(
      'none'
    );
  });

  it('does not retry after 3 retries already logged today', () => {
    const marker = [now - 9 * 3600, now - 8 * 3600, now - 7 * 3600].join('\n');
    expect(runShouldRetry('warn: over cadence, skipping', now, marker, 'inactive')).toBe('none');
  });

  it('does not retry when the watchdog service is already active', () => {
    expect(runShouldRetry('error: claude -p exited 1', now, '', 'active')).toBe('none');
  });
});
