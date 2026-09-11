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
  it('has a drafts-already-present guard that exits 0 without invoking claude -p ONLY in non-autonomous mode', () => {
    const guardMatch = script.match(
      /EXISTING_DRAFTS=\("\$DRAFTS_DIR"\/\*\.md\)[\s\S]*?exit 0\s*\nfi/
    );
    expect(guardMatch).not.toBeNull();
    const guardBlock = guardMatch![0];
    expect(guardBlock).toMatch(/exit 0/);
    expect(guardBlock).not.toMatch(/claude -p/);
    // the skip-exit path is gated behind autonomous_publish being false
    expect(guardBlock).toMatch(/AUTONOMOUS_PUBLISH.*!=.*"true"/);

    // the guard must appear textually before the claude -p invocation
    const guardIndex = script.indexOf('EXISTING_DRAFTS=');
    const claudeInvocationIndex = script.indexOf('claude -p "$PROMPT"');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(claudeInvocationIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(claudeInvocationIndex);
  });

  it('consumes pending drafts (seeds instead of skipping) when autonomous_publish is true', () => {
    expect(script).toMatch(/CONSUME_EXISTING_DRAFTS=1/);
    expect(script).toMatch(/CONSUME_EXISTING_DRAFTS=0/);
    // the consuming branch does NOT exit 0 — it falls through to invoke claude -p
    const consumeIndex = script.indexOf('CONSUME_EXISTING_DRAFTS=1');
    const claudeInvocationIndex = script.indexOf('claude -p "$PROMPT"');
    expect(consumeIndex).toBeGreaterThan(-1);
    expect(consumeIndex).toBeLessThan(claudeInvocationIndex);
  });

  it('writes .watchdog-state before invoking claude -p, not after', () => {
    const stateWriteIndex = script.indexOf('> "$STATE_FILE"');
    const claudeInvocationIndex = script.indexOf('timeout "$CLAUDE_TIMEOUT" claude -p');
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

  it('prohibits deleting a deferred draft, but allows deleting a draft that was actually seeded (autonomous consumption)', () => {
    // non-autonomous prompt: still an unconditional prohibition
    expect(script.toLowerCase()).toMatch(/delete, move, or overwrite any pre-existing file/);
    // autonomous prompt: a seeded draft's file IS deleted as part of its seed commit,
    // but a deferred (over-the-cap) draft must be left untouched
    expect(script).toMatch(/delete its file from \.claude\/skills\/blog-from-git\/drafts\//);
    expect(script.toLowerCase()).toMatch(/never delete, move, or overwrite a draft you are not seeding/);
  });

  it('parses the autonomy.autonomous_publish kill switch and autonomy.max_posts_per_run with the same defensive grep pattern as target_gap_days, FATAL on parse failure', () => {
    expect(script).toMatch(/AUTONOMOUS_PUBLISH="\$\(grep -m1 'autonomous_publish:' "\$CONFIG_FILE" \| grep -oP/);
    expect(script).toMatch(/MAX_POSTS_PER_RUN="\$\(grep -m1 'max_posts_per_run:' "\$CONFIG_FILE" \| grep -oP/);
    const guardIndex = script.indexOf('AUTONOMOUS_PUBLISH=');
    const fatalBlock = script.slice(guardIndex, guardIndex + 500);
    expect(fatalBlock).toMatch(/-z "\$AUTONOMOUS_PUBLISH" \|\| -z "\$MAX_POSTS_PER_RUN"/);
    expect(fatalBlock).toMatch(/FATAL: could not parse autonomy settings/);
    expect(fatalBlock).toMatch(/write_heartbeat "error: could not parse autonomy settings"/);
    expect(fatalBlock).toMatch(/exit 1/);
  });

  it('runs the full pipeline (phases 1-7) when autonomous_publish is true, phases 1-5 only when false', () => {
    expect(script).toMatch(/running PHASES 1-7/);
    expect(script).toMatch(/run PHASES 1-5 ONLY/);
    const autonomousBranch = script.slice(
      script.indexOf('running PHASES 1-7') - 200,
      script.indexOf('running PHASES 1-7') + 400
    );
    expect(autonomousBranch).toMatch(/7 Seed \(seed\.md\)/);
  });

  it('seeds using explicit git add pathspecs, and never a blanket add anywhere in the script', () => {
    expect(script).toMatch(/git add server\/db\.ts \.claude\/skills\/blog-from-git\/blog-ledger\.md/);
    expect(script).not.toMatch(/git add -A/);
    expect(script).not.toMatch(/git add \./);
    expect(script).not.toMatch(/git commit -a/);
  });

  it('asserts the configured push remote resolves to StanislavBG/bilko-run before any autonomous run proceeds', () => {
    expect(script).toMatch(/git remote get-url "\$PUSH_REMOTE_NAME"/);
    expect(script).toMatch(/StanislavBG\/bilko-run/);
    expect(script).toMatch(/write_heartbeat "error: push remote does not resolve to StanislavBG\/bilko-run"/);
  });

  it('distinguishes a published outcome from a no-op and an error via a SEED_RESULT line', () => {
    expect(script).toMatch(/SEED_RESULT: published=/);
    expect(script).toMatch(/SEED_RESULT: noop/);
    expect(script).toMatch(/SEED_RESULT: error/);
    expect(script).toMatch(/SEED_LINE="\$\(echo "\$CLAUDE_OUTPUT" \| grep -o 'SEED_RESULT:\.\*' \| tail -1\)"/);
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
