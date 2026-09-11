import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Static text checks only — this script shells out to `curl` and `claude -p`,
// neither of which this suite may invoke. See PRD 1002's postmortem: the
// properties asserted here are the concrete fixes for a run that reported
// pre-existing draft files as its own authored work.
let script: string;

beforeAll(() => {
  script = readFileSync(join(__dirname, '../scripts/blog-cadence-watchdog.sh'), 'utf-8');
});

describe('blog-cadence-watchdog.sh', () => {
  it('has a drafts-already-present guard that exits 0 without invoking claude -p', () => {
    const guardMatch = script.match(
      /EXISTING_DRAFTS=\("\$DRAFTS_DIR"\/\*\.md\)[\s\S]*?exit 0\s*\nfi/
    );
    expect(guardMatch).not.toBeNull();
    const guardBlock = guardMatch![0];
    expect(guardBlock).toMatch(/exit 0/);
    expect(guardBlock).not.toMatch(/claude -p/);

    // the guard must appear textually before the claude -p invocation
    const guardIndex = script.indexOf('EXISTING_DRAFTS=');
    const claudeInvocationIndex = script.indexOf('timeout 2400 claude -p');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(claudeInvocationIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(claudeInvocationIndex);
  });

  it('writes .watchdog-state before invoking claude -p, not after', () => {
    const stateWriteIndex = script.indexOf('> "$STATE_FILE"');
    const claudeInvocationIndex = script.indexOf('timeout 2400 claude -p');
    expect(stateWriteIndex).toBeGreaterThan(-1);
    expect(claudeInvocationIndex).toBeGreaterThan(-1);
    expect(stateWriteIndex).toBeLessThan(claudeInvocationIndex);
  });

  it('requires authored_by and authored_at in draft front matter', () => {
    expect(script).toMatch(/authored_by:\s*blog-cadence-watchdog/);
    expect(script).toMatch(/authored_at:\s*\$AUTHORED_AT/);
    // the timestamp must come from the script's own clock, not the model's guess
    expect(script).toMatch(/AUTHORED_AT="\$\(TZ=America\/Los_Angeles date -Iseconds\)"/);
  });

  it('prohibits deleting pre-existing drafts', () => {
    expect(script.toLowerCase()).toMatch(/delete, move, or overwrite any pre-existing file/);
  });

  it('pins an explicit --model on every claude -p call', () => {
    const claudeCalls = script.match(/claude -p[\s\S]*?--output-format text/g) ?? [];
    expect(claudeCalls.length).toBeGreaterThan(0);
    for (const call of claudeCalls) {
      expect(call).toMatch(/--model\s+\S+/);
    }
  });

  it('escalates the pending-drafts heartbeat to warn: once the oldest draft crosses pending_draft_alert_days, reading the threshold from blog.config.yaml', () => {
    const guardMatch = script.match(
      /EXISTING_DRAFTS=\("\$DRAFTS_DIR"\/\*\.md\)[\s\S]*?exit 0\s*\nfi/
    );
    expect(guardMatch).not.toBeNull();
    const guardBlock = guardMatch![0];

    // threshold comes from the config file, never a hard-coded number
    expect(guardBlock).toMatch(/pending_draft_alert_days:/);
    expect(guardBlock).toMatch(/\$CONFIG_FILE/);

    // oldest draft is found by file mtime, per the PRD's implementation note
    expect(guardBlock).toMatch(/date -r "\$draft" \+%s/);

    // escalation compares age-in-days to the threshold and only then writes warn:
    const pendingAlertIndex = guardBlock.indexOf('PENDING_ALERT_DAYS');
    const warnWriteIndex = guardBlock.indexOf('write_heartbeat "warn:');
    const okWriteIndex = guardBlock.lastIndexOf('write_heartbeat "ok:');
    expect(pendingAlertIndex).toBeGreaterThan(-1);
    expect(warnWriteIndex).toBeGreaterThan(pendingAlertIndex);
    expect(okWriteIndex).toBeGreaterThan(warnWriteIndex);
    expect(guardBlock).toMatch(/OLDEST_DRAFT_AGE_DAYS\s*>=\s*PENDING_ALERT_DAYS/);

    // a config-parse failure fails loud rather than silently defaulting
    expect(guardBlock).toMatch(/error: could not parse pending_draft_alert_days/);
  });

  it('retries the /api/blog fetch with a backoff before giving up', () => {
    // three attempts, each keeping the original --max-time 20 curl
    const curlMatches = script.match(/curl -s --max-time 20 https:\/\/bilko\.run\/api\/blog/g) ?? [];
    expect(curlMatches.length).toBeGreaterThanOrEqual(1);
    expect(script).toMatch(/for attempt in 1 2 3/);
    expect(script).toMatch(/sleep 10/);
  });

  it('validates the fetch response is a non-empty JSON array before indexing .published_at', () => {
    const shapeGateIndex = script.indexOf("jq -e 'type == \"array\" and length > 0'");
    const firstPublishedAtAccessIndex = script.indexOf(
      "jq -r '[.[].published_at] | max'",
      shapeGateIndex + 1
    );
    expect(shapeGateIndex).toBeGreaterThan(-1);
    expect(firstPublishedAtAccessIndex).toBeGreaterThan(-1);
    expect(shapeGateIndex).toBeLessThan(firstPublishedAtAccessIndex);
  });

  it('falls through to the existing FATAL branch with a heartbeat when all fetch retries are exhausted', () => {
    expect(script).toMatch(/FETCH_OK" -ne 1/);
    const fatalMatches = script.match(/FATAL: could not read published_at from https:\/\/bilko\.run\/api\/blog/g) ?? [];
    expect(fatalMatches.length).toBeGreaterThanOrEqual(1);
    expect(script).toMatch(/write_heartbeat "error: could not read published_at from \/api\/blog"/);
  });

  it('installs an EXIT trap that guarantees a heartbeat on any unhandled exit, without double-writing one already sent', () => {
    expect(script).toMatch(/trap on_exit EXIT/);
    expect(script).toMatch(/HEARTBEAT_WRITTEN=0/);
    // write_heartbeat marks itself written so the trap's fallback never overwrites a real one
    const writeHeartbeatFn = script.match(/write_heartbeat\(\) \{[\s\S]*?\n\}/);
    expect(writeHeartbeatFn).not.toBeNull();
    expect(writeHeartbeatFn![0]).toMatch(/HEARTBEAT_WRITTEN=1/);
    const onExitFn = script.match(/on_exit\(\) \{[\s\S]*?\n\}/);
    expect(onExitFn).not.toBeNull();
    expect(onExitFn![0]).toMatch(/HEARTBEAT_WRITTEN"\s*-eq\s*0/);
  });

  it('behaviorally verifies the shape gate rejects non-array/empty bodies and accepts a valid array', () => {
    const gateExpr = 'type == "array" and length > 0';
    const cases: Array<[string, boolean]> = [
      ['0', false],
      ['null', false],
      ['[]', false],
      ['{}', false],
      ['[{"published_at":"2026-01-01"}]', true],
    ];
    for (const [body, shouldPass] of cases) {
      let exitCode = 0;
      try {
        execFileSync('jq', ['-e', gateExpr], { input: body, stdio: ['pipe', 'ignore', 'ignore'] });
      } catch (err: any) {
        exitCode = typeof err.status === 'number' ? err.status : 1;
      }
      if (shouldPass) {
        expect(exitCode).toBe(0);
      } else {
        expect(exitCode).not.toBe(0);
      }
    }
  });
});
