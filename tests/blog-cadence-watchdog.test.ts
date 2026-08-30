import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
});
