import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
    // one shared fetch_blog_json helper, keeping the original --max-time 20 curl
    const curlMatches = script.match(/curl -s --max-time 20 https:\/\/bilko\.run\/api\/blog/g) ?? [];
    expect(curlMatches.length).toBe(1);
    expect(script).toMatch(/fetch_blog_json\(\) \{/);
    expect(script).toMatch(/for attempt in \$\(seq 1 "\$max_attempts"\)/);
    expect(script).toMatch(/sleep "\$backoff_seconds"/);
    // the initial gap-check call keeps the original 3-attempts/10s-backoff behavior
    expect(script).toMatch(/fetch_blog_json 3 10/);
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

  it('recovers a rejected/non-fast-forward push by rebasing the seed commit onto freshly fetched origin/main and retrying, bounded', () => {
    const publishedBranchIndex = script.indexOf('SEED_RESULT:\\ published=*');
    expect(publishedBranchIndex).toBeGreaterThan(-1);
    const publishedBranchOkIndex = script.indexOf('write_heartbeat "ok: ${SEED_LINE#SEED_RESULT: }"', publishedBranchIndex);
    const publishedBranch = script.slice(publishedBranchIndex, publishedBranchOkIndex);

    // bounded retry loop
    expect(publishedBranch).toMatch(/RECOVERY_MAX_ATTEMPTS=3/);
    expect(publishedBranch).toMatch(/for attempt in \$\(seq 1 "\$RECOVERY_MAX_ATTEMPTS"\)/);
    expect(publishedBranch).toMatch(/sleep "\$RECOVERY_BACKOFF_SECONDS"/);

    // recovery uses fetch + rebase, never reset --hard / force push / history rewrite
    expect(publishedBranch).toMatch(/git rebase origin\/main/);
    expect(publishedBranch).not.toMatch(/push --force/);
    expect(publishedBranch).not.toMatch(/push.*--force-with-lease/);
    expect(publishedBranch).not.toMatch(/reset --hard/);

    // gives up loud after exhausting retries
    expect(publishedBranch).toMatch(/exhausted \$RECOVERY_MAX_ATTEMPTS push-race recovery attempts/);
    expect(publishedBranch).toMatch(/write_heartbeat "error: exhausted push-race recovery attempts/);
  });

  it('aborts (never auto-resolves) a rebase conflict during push-race recovery, leaving the working tree untouched', () => {
    expect(script).toMatch(/git rebase --abort/);
    const conflictIndex = script.indexOf('git rebase --abort');
    const surrounding = script.slice(conflictIndex - 600, conflictIndex + 200);
    expect(surrounding).toMatch(/hit a conflict on attempt.*not auto-resolving/);
    expect(surrounding).toMatch(/write_heartbeat "error: rebase conflict recovering seed commit/);
    // unstaged working-tree state is asserted unchanged across the recovery
    expect(surrounding).toMatch(/PRE_REBASE_STATUS="\$\(git status --porcelain\)"/);
  });

  it('asserts the unstaged working tree is unchanged across a successful rebase recovery too', () => {
    expect(script).toMatch(/POST_REBASE_STATUS="\$\(git status --porcelain\)"/);
    expect(script).toMatch(/PRE_REBASE_STATUS"\s*!=\s*"\$POST_REBASE_STATUS"/);
    expect(script).toMatch(/write_heartbeat "error: unstaged working tree changed during push-race recovery"/);
  });

  it('does not retry a push rejected for a non-race reason (auth/network/other) — goes straight to the error heartbeat with git stderr recorded', () => {
    expect(script).toMatch(/non-fast-forward\|fetch first\|\\\[rejected\\\]/);
    expect(script).toMatch(/failed for a reason other than a fast-forward race — not retrying as a push race/);
    expect(script).toMatch(/write_heartbeat "error: git push origin main failed: \$\(echo "\$PUSH_OUTPUT" \| tail -1\)"/);
  });

  it('detects a seed commit already present on origin/main and reports success instead of re-pushing or double-seeding', () => {
    expect(script).toMatch(/git merge-base --is-ancestor "\$SEED_COMMIT" origin\/main/);
    expect(script).toMatch(/already present on origin\/main — publish had actually landed/);
    expect(script).toMatch(/git merge --ff-only origin\/main/);
  });

  it('never uses push --force, push --force-with-lease, reset --hard, or a blanket git add/commit anywhere in the script', () => {
    expect(script).not.toMatch(/push\s+--force(?!-with-lease)/);
    expect(script).not.toMatch(/--force-with-lease/);
    expect(script).not.toMatch(/reset\s+--hard/);
    expect(script).not.toMatch(/git add -A/);
    expect(script).not.toMatch(/git add \./);
    expect(script).not.toMatch(/git commit -a\b/);
  });

  it('re-runs the disallowed-path check and final origin/main HEAD assertion after recovery, before writing ok:', () => {
    const publishedBranchIndex = script.indexOf('SEED_RESULT:\\ published=*');
    const badPathIndex = script.indexOf('BAD_PATH="$changed_file"', publishedBranchIndex);
    const finalHeadCheckIndex = script.indexOf('"$LOCAL_HEAD" != "$REMOTE_HEAD"', publishedBranchIndex);
    const okWriteIndex = script.indexOf('write_heartbeat "ok: ${SEED_LINE#SEED_RESULT: }"', finalHeadCheckIndex);
    expect(publishedBranchIndex).toBeGreaterThan(-1);
    expect(badPathIndex).toBeGreaterThan(publishedBranchIndex);
    expect(finalHeadCheckIndex).toBeGreaterThan(badPathIndex);
    expect(okWriteIndex).toBeGreaterThan(finalHeadCheckIndex);
  });

  describe('allowed_commit_paths parser (behavioral, not just static text match)', () => {
    // Extract the actual awk program from the script so these tests run the
    // real parser, not a re-implementation that could drift from it.
    function extractAllowedPathsAwk(): string {
      const match = script.match(/ALLOWED_PATHS_AWK='([\s\S]*?)'\n/);
      expect(match).not.toBeNull();
      return match![1];
    }

    function runAwk(awkProgram: string, input: string): string[] {
      const output = execFileSync('awk', [awkProgram], { input, encoding: 'utf-8' });
      return output
        .split('\n')
        .map((line) => line.replace(/^[\s]*-[\s]*/, '').replace(/[\s]*#.*$/, '').trim())
        .filter((line) => line.length > 0);
    }

    it('returns exactly the two configured paths when run against the real blog.config.yaml', () => {
      const awkProgram = extractAllowedPathsAwk();
      const configPath = join(__dirname, '../.claude/skills/blog-from-git/blog.config.yaml');
      const output = execFileSync('awk', [awkProgram, configPath], { encoding: 'utf-8' });
      const paths = output
        .split('\n')
        .map((line) => line.replace(/^[\s]*-[\s]*/, '').replace(/[\s]*#.*$/, '').trim())
        .filter((line) => line.length > 0);
      expect(paths).toEqual(['server/db.ts', '.claude/skills/blog-from-git/blog-ledger.md']);
    });

    it('skips a comment-only continuation line between the key and the first item (the exact defect)', () => {
      const awkProgram = extractAllowedPathsAwk();
      const input = [
        'allowed_commit_paths:                 # trailing comment',
        '                                       # wrapped continuation of that comment',
        '  - server/db.ts',
        '  - .claude/skills/blog-from-git/blog-ledger.md',
        'push_branch: main',
      ].join('\n');
      expect(runAwk(awkProgram, input)).toEqual(['server/db.ts', '.claude/skills/blog-from-git/blog-ledger.md']);
    });

    it('skips a blank line inside the block', () => {
      const awkProgram = extractAllowedPathsAwk();
      const input = [
        'allowed_commit_paths:',
        '',
        '  - server/db.ts',
        '',
        '  - .claude/skills/blog-from-git/blog-ledger.md',
        'push_branch: main',
      ].join('\n');
      expect(runAwk(awkProgram, input)).toEqual(['server/db.ts', '.claude/skills/blog-from-git/blog-ledger.md']);
    });

    it('strips an inline trailing comment on a list item', () => {
      const awkProgram = extractAllowedPathsAwk();
      const input = [
        'allowed_commit_paths:',
        '  - server/db.ts   # the seed file',
        '  - .claude/skills/blog-from-git/blog-ledger.md',
      ].join('\n');
      expect(runAwk(awkProgram, input)).toEqual(['server/db.ts', '.claude/skills/blog-from-git/blog-ledger.md']);
    });

    it('terminates the block at the next real YAML key, without swallowing later config', () => {
      const awkProgram = extractAllowedPathsAwk();
      const input = [
        'allowed_commit_paths:',
        '  - server/db.ts',
        '  - .claude/skills/blog-from-git/blog-ledger.md',
        'push_branch: main',
        '  - not/a/real/item',
      ].join('\n');
      expect(runAwk(awkProgram, input)).toEqual(['server/db.ts', '.claude/skills/blog-from-git/blog-ledger.md']);
    });

    it('returns an empty list when the key is genuinely empty or missing (fail-closed still trips)', () => {
      const awkProgram = extractAllowedPathsAwk();
      const emptyKeyInput = ['allowed_commit_paths:', 'push_branch: main'].join('\n');
      expect(runAwk(awkProgram, emptyKeyInput)).toEqual([]);

      const missingKeyInput = ['push_branch: main', 'push_remote: origin'].join('\n');
      expect(runAwk(awkProgram, missingKeyInput)).toEqual([]);
    });

    it('parses list items with extra indentation or a tab instead of spaces', () => {
      const awkProgram = extractAllowedPathsAwk();
      const input = [
        'allowed_commit_paths:',
        '        - server/db.ts',
        '\t- .claude/skills/blog-from-git/blog-ledger.md',
      ].join('\n');
      expect(runAwk(awkProgram, input)).toEqual(['server/db.ts', '.claude/skills/blog-from-git/blog-ledger.md']);
    });
  });

  describe('post-publish live-pickup verification poll', () => {
    function extractVerificationBlock(): string {
      const start = script.indexOf('SEEDED_SLUGS_RAW=');
      const end = script.indexOf('\nelse\n  echo "[blog-cadence-watchdog] claude -p exited 0 but printed no SEED_RESULT');
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      return script.slice(start, end);
    }

    it('exists and is bounded by a config-read deadline, not a fixed loop count', () => {
      const block = extractVerificationBlock();
      expect(block).toMatch(/verify_deploy_timeout_seconds:/);
      expect(block).toMatch(/verify_deploy_interval_seconds:/);
      expect(block).toMatch(/\$CONFIG_FILE/);
      expect(block).toMatch(/VERIFY_DEADLINE_EPOCH=\$\(\( \$\(date \+%s\) \+ VERIFY_DEPLOY_TIMEOUT_SECONDS \)\)/);
      expect(block).toMatch(/while \[\[ "\$\(date \+%s\)" -lt "\$VERIFY_DEADLINE_EPOCH" \]\]/);
    });

    it('FATALs with an error: heartbeat and exit 1 when the verify_deploy config keys fail to parse', () => {
      const block = extractVerificationBlock();
      expect(block).toMatch(/-z "\$VERIFY_DEPLOY_TIMEOUT_SECONDS" \|\| -z "\$VERIFY_DEPLOY_INTERVAL_SECONDS"/);
      expect(block).toMatch(/FATAL: could not parse verify_deploy_timeout_seconds\/verify_deploy_interval_seconds/);
      expect(block).toMatch(/write_heartbeat "error: could not parse verify_deploy settings"/);
    });

    it('reuses fetch_blog_json rather than a second raw curl+jq path', () => {
      const block = extractVerificationBlock();
      expect(block).toMatch(/fetch_blog_json 1 0/);
      expect(block).not.toMatch(/curl -s --max-time 20/);
    });

    it('treats a missing slug as "not yet live" and keeps polling to the deadline', () => {
      const block = extractVerificationBlock();
      expect(block).toMatch(/MISSING_SLUGS=\(\)/);
      expect(block).toMatch(/if ! echo "\$POLL_JSON" \| jq -e --arg s "\$slug"/);
      expect(block).toMatch(/sleep "\$VERIFY_DEPLOY_INTERVAL_SECONDS"/);
    });

    it('on success writes an ok: heartbeat naming the slug(s) and observed live time, and logs the live URL', () => {
      const block = extractVerificationBlock();
      expect(block).toMatch(/VERIFY_LIVE=1/);
      expect(block).toMatch(/live pickup verified at https:\/\/bilko\.run\/api\/blog/);
      expect(block).toMatch(/https:\/\/bilko\.run\/blog\//);
      expect(block).toMatch(/write_heartbeat "ok: \$\{SEED_LINE#SEED_RESULT: \} live_at=\$VERIFY_OBSERVED_AT slugs=\$\{SEEDED_SLUGS\[\*\]\}"/);
    });

    it('on timeout writes an error: heartbeat naming the not-live slug(s) and exits non-zero, without reverting/re-pushing/re-seeding', () => {
      const block = extractVerificationBlock();
      expect(block).toMatch(/FATAL: seeded slug\(s\) not live at https:\/\/bilko\.run\/api\/blog after \$\{VERIFY_DEPLOY_TIMEOUT_SECONDS\}s/);
      expect(block).toMatch(/write_heartbeat "error: seeded slug\(s\) not live after \$\{VERIFY_DEPLOY_TIMEOUT_SECONDS\}s/);
      expect(block).toMatch(/exit 1/);
      expect(block).not.toMatch(/git revert/);
      expect(block).not.toMatch(/push --force/);
      expect(block).not.toMatch(/reset --hard/);
      expect(block).not.toMatch(/git commit/);
      expect(block).not.toMatch(/git push/);
    });

    it('a run that seeded nothing (noop) never enters the verification block', () => {
      const noopIndex = script.indexOf("SEED_LINE\" == SEED_RESULT:\\ noop*");
      const verifyIndex = script.indexOf('SEEDED_SLUGS_RAW=');
      expect(noopIndex).toBeGreaterThan(-1);
      expect(verifyIndex).toBeGreaterThan(noopIndex);
      // the noop branch's write_heartbeat happens before the verification block even starts
      const noopBlock = script.slice(noopIndex, verifyIndex);
      // noop is a stall (over-cadence, nothing seeded) — status is computed, not hard-coded "ok:"
      expect(noopBlock).toMatch(/NOOP_STATUS="\$\(heartbeat_status_for_outcome "\$GAP_DAYS" "\$UPPER_BOUND" 0\)"/);
      expect(noopBlock).toMatch(/write_heartbeat "\$\{NOOP_STATUS\}: \$\{SEED_LINE#SEED_RESULT: \}"/);
    });

    it('the claude -p prompt asks for a slugs= field in SEED_RESULT so verification knows what to check', () => {
      expect(script).toMatch(/slugs=\\"<comma-separated-slugs-you-just-seeded>\\"/);
      expect(script).toMatch(/SEEDED_SLUGS_RAW="\$\(echo "\$SEED_LINE" \| grep -oP 'slugs="\\K\[\^"\]\*'/);
    });
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

  describe('heartbeat status selection (pure, behavioral — no network, no claude -p)', () => {
    function extractHeartbeatStatusFn(): string {
      const match = script.match(/heartbeat_status_for_outcome\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function runStatusFn(gapDays: number, upperBound: number, seeded: 0 | 1): string {
      const fn = extractHeartbeatStatusFn();
      const out = execFileSync(
        'bash',
        ['-c', `${fn}\nheartbeat_status_for_outcome ${gapDays} ${upperBound} ${seeded}`],
        { encoding: 'utf-8' }
      );
      return out.trim();
    }

    it('over-cadence + nothing seeded => warn (the stall this PRD fixes)', () => {
      expect(runStatusFn(12, 5, 0)).toBe('warn');
    });

    it('within-cadence + nothing to publish => ok (an ordinary quiet day)', () => {
      expect(runStatusFn(2, 5, 0)).toBe('ok');
    });

    it('seeded => ok, regardless of gap', () => {
      expect(runStatusFn(12, 5, 1)).toBe('ok');
      expect(runStatusFn(2, 5, 1)).toBe('ok');
    });

    it('the noop branch actually calls this function rather than hard-coding ok:', () => {
      expect(script).toMatch(/heartbeat_status_for_outcome "\$GAP_DAYS" "\$UPPER_BOUND" 0/);
    });
  });

  describe('publish-due gate uses the LOWER bound of target_gap_days, not the upper (behavioral)', () => {
    function extractPublishDueStatusFn(): string {
      const match = script.match(/publish_due_status\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function runPublishDueStatus(gapDays: number, lowerBound: number): string {
      const fn = extractPublishDueStatusFn();
      const out = execFileSync(
        'bash',
        ['-c', `${fn}\npublish_due_status ${gapDays} ${lowerBound}`],
        { encoding: 'utf-8' }
      );
      return out.trim();
    }

    it('gap=3, lower_bound=3 => due', () => {
      expect(runPublishDueStatus(3, 3)).toBe('due');
    });

    it('gap=2, lower_bound=3 => not_due', () => {
      expect(runPublishDueStatus(2, 3)).toBe('not_due');
    });

    it('gap=4 (between lower and upper bound), lower_bound=3 => due — publish does not wait for the upper bound', () => {
      expect(runPublishDueStatus(4, 3)).toBe('due');
    });

    it('parses LOWER_BOUND as the first number in target_gap_days from the real config, distinct from UPPER_BOUND', () => {
      expect(script).toMatch(/LOWER_BOUND="\$\(grep -m1 'target_gap_days:' "\$CONFIG_FILE" \| grep -oP '\\\[\\K\\d\+'\)"/);
      const configPath = join(__dirname, '../.claude/skills/blog-from-git/blog.config.yaml');
      const configText = readFileSync(configPath, 'utf-8');
      const line = configText.match(/target_gap_days:.*/)![0];
      expect(line).toMatch(/\[3,\s*4\]/);
    });

    it('the early "within cadence — no action" exit before scanning has been removed', () => {
      expect(script).not.toMatch(/if \(\( GAP_DAYS < UPPER_BOUND \)\); then/);
    });

    it('scanning runs unconditionally via run_scan_only before the publish-due branch decides anything', () => {
      expect(script).toMatch(/run_scan_only\(\) \{/);
      expect(script).toMatch(/PUBLISH_DUE="\$\(publish_due_status "\$GAP_DAYS" "\$LOWER_BOUND"\)"/);
      const scanFnIndex = script.indexOf('run_scan_only() {');
      const publishDueIndex = script.indexOf('PUBLISH_DUE=');
      expect(scanFnIndex).toBeGreaterThan(-1);
      expect(publishDueIndex).toBeGreaterThan(scanFnIndex);
    });

    it('the same-day state-file lock scans (not exits) rather than short-circuiting the whole run', () => {
      const lockIndex = script.indexOf('LAST_RUN_DATE="$(cut -d\' \' -f1');
      expect(lockIndex).toBeGreaterThan(-1);
      const lockBlock = script.slice(lockIndex, lockIndex + 400);
      expect(lockBlock).toMatch(/run_scan_only/);
    });
  });

  describe('rotation cooldown of N posts (behavioral, fixture ledger content)', () => {
    function extractLedgerRecentProjectsFn(): string {
      const match = script.match(/ledger_recent_projects\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function extractProjectInCooldownFn(): string {
      const match = script.match(/project_in_cooldown\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function writeFixtureLedger(rows: Array<[string, string, string]>): string {
      const header = [
        '# fixture ledger',
        '',
        '| Date | Slug | Project | On /projects? | Tone |',
        '|---|---|---|---|---|',
      ];
      const body = rows.map(([date, slug, project]) => `| ${date} | ${slug} | ${project} | ✅ | changelog |`);
      const content = [...header, ...body].join('\n') + '\n';
      const path = join(tmpdir(), `fixture-ledger-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
      writeFileSync(path, content, 'utf-8');
      return path;
    }

    it('project_cooldown_posts is parsed from blog.config.yaml with a FATAL guard on parse failure', () => {
      expect(script).toMatch(/PROJECT_COOLDOWN_POSTS="\$\(grep -m1 'project_cooldown_posts:' "\$CONFIG_FILE" \| grep -oP/);
      expect(script).toMatch(/FATAL: could not parse project_cooldown_posts/);
      expect(script).toMatch(/write_heartbeat "error: could not parse project_cooldown_posts"/);
    });

    it('extracts the Project column of the last N rows (newest first) from a fixture ledger', () => {
      const fn = extractLedgerRecentProjectsFn();
      const ledgerPath = writeFixtureLedger([
        ['2026-09-10', 'slug-a', 'project-a'],
        ['2026-09-07', 'slug-b', 'project-b'],
        ['2026-09-04', 'slug-c', 'project-c'],
        ['2026-09-01', 'slug-d', 'project-d'],
      ]);
      const out = execFileSync('bash', ['-c', `${fn}\nledger_recent_projects "${ledgerPath}" 3`], {
        encoding: 'utf-8',
      });
      const projects = out.trim().split('\n');
      expect(projects).toEqual(['project-a', 'project-b', 'project-c']);
    });

    it('a project present in one of the last 3 ledger rows is in cooldown', () => {
      const recentFn = extractLedgerRecentProjectsFn();
      const cooldownFn = extractProjectInCooldownFn();
      const ledgerPath = writeFixtureLedger([
        ['2026-09-10', 'slug-a', 'project-a'],
        ['2026-09-07', 'slug-b', 'project-b'],
        ['2026-09-04', 'slug-c', 'project-c'],
      ]);
      const script2 = `${recentFn}\n${cooldownFn}\nrecent="$(ledger_recent_projects "${ledgerPath}" 3)"\nif project_in_cooldown "project-b" "$recent"; then echo BLOCKED; else echo ELIGIBLE; fi`;
      const out = execFileSync('bash', ['-c', script2], { encoding: 'utf-8' }).trim();
      expect(out).toBe('BLOCKED');
    });

    it('a project NOT present in the last 3 ledger rows is eligible', () => {
      const recentFn = extractLedgerRecentProjectsFn();
      const cooldownFn = extractProjectInCooldownFn();
      const ledgerPath = writeFixtureLedger([
        ['2026-09-10', 'slug-a', 'project-a'],
        ['2026-09-07', 'slug-b', 'project-b'],
        ['2026-09-04', 'slug-c', 'project-c'],
      ]);
      const script2 = `${recentFn}\n${cooldownFn}\nrecent="$(ledger_recent_projects "${ledgerPath}" 3)"\nif project_in_cooldown "project-z" "$recent"; then echo BLOCKED; else echo ELIGIBLE; fi`;
      const out = execFileSync('bash', ['-c', script2], { encoding: 'utf-8' }).trim();
      expect(out).toBe('ELIGIBLE');
    });

    it('uses however many rows exist when fewer than N posts are in the ledger, without erroring', () => {
      const fn = extractLedgerRecentProjectsFn();
      const ledgerPath = writeFixtureLedger([
        ['2026-09-10', 'slug-a', 'project-a'],
        ['2026-09-07', 'slug-b', 'project-b'],
      ]);
      const out = execFileSync('bash', ['-c', `${fn}\nledger_recent_projects "${ledgerPath}" 3`], {
        encoding: 'utf-8',
      });
      const projects = out.trim().split('\n').filter(Boolean);
      expect(projects).toEqual(['project-a', 'project-b']);
    });

    it('the real blog-ledger.md yields exactly 3 recent projects for the current cooldown window', () => {
      const fn = extractLedgerRecentProjectsFn();
      const ledgerPath = join(__dirname, '../.claude/skills/blog-from-git/blog-ledger.md');
      const out = execFileSync('bash', ['-c', `${fn}\nledger_recent_projects "${ledgerPath}" 3`], {
        encoding: 'utf-8',
      });
      const projects = out.trim().split('\n').filter(Boolean);
      expect(projects.length).toBe(3);
    });

    it('scan_every_days is parsed from blog.config.yaml with a FATAL guard on parse failure or drift from 1', () => {
      expect(script).toMatch(/SCAN_EVERY_DAYS="\$\(grep -m1 'scan_every_days:' "\$CONFIG_FILE" \| grep -oP/);
      expect(script).toMatch(/FATAL: could not parse scan_every_days/);
      expect(script).toMatch(/write_heartbeat "error: could not parse scan_every_days"/);
      expect(script).toMatch(/"\$SCAN_EVERY_DAYS" != "1"/);
      expect(script).toMatch(/write_heartbeat "error: scan_every_days is not 1/);
    });

    it('mechanically audits the seeded ledger project against the pre-run cooldown list rather than trusting the subprocess self-report', () => {
      expect(script).toMatch(/ledger_recent_projects \/dev\/stdin 1/);
      expect(script).toMatch(/project_in_cooldown "\$SEEDED_LEDGER_PROJECT" "\$RECENT_PROJECTS"/);
      expect(script).toMatch(/write_heartbeat "error: seeded post violates rotation cooldown/);
      // the audit runs after the disallowed-path check and before the final HEAD assertion
      const badPathIndex = script.indexOf('BAD_PATH="$changed_file"');
      const auditIndex = script.indexOf('SEEDED_LEDGER_PROJECT=');
      const headCheckIndex = script.indexOf('"$LOCAL_HEAD" != "$REMOTE_HEAD"');
      expect(badPathIndex).toBeGreaterThan(-1);
      expect(auditIndex).toBeGreaterThan(badPathIndex);
      expect(headCheckIndex).toBeGreaterThan(auditIndex);
    });

    it('a due post with every candidate on cooldown maps to warn: via a distinct cooldown_blocked SEED_RESULT, not the generic noop path', () => {
      expect(script).toMatch(/SEED_RESULT:\s*cooldown_blocked/);
      const blockIndex = script.indexOf('SEED_LINE" == SEED_RESULT:\\ cooldown_blocked*');
      expect(blockIndex).toBeGreaterThan(-1);
      const block = script.slice(blockIndex, blockIndex + 800);
      expect(block).toMatch(/write_heartbeat "warn: \$\{SEED_LINE#SEED_RESULT: \}"/);
      // this branch must come before the generic noop branch so it is matched first
      const noopIndex = script.indexOf('SEED_LINE" == SEED_RESULT:\\ noop*');
      expect(noopIndex).toBeGreaterThan(blockIndex);
    });

    it('heartbeat_status_for_outcome semantics are unchanged by the cooldown_blocked branch', () => {
      expect(runStatusFnForCooldownCheck(12, 5, 0)).toBe('warn');
      expect(runStatusFnForCooldownCheck(2, 5, 0)).toBe('ok');
      expect(runStatusFnForCooldownCheck(2, 5, 1)).toBe('ok');
    });

    function runStatusFnForCooldownCheck(gapDays: number, upperBound: number, seeded: 0 | 1): string {
      const match = script.match(/heartbeat_status_for_outcome\(\) \{[\s\S]*?\n\}/);
      const fn = match![0];
      const out = execFileSync(
        'bash',
        ['-c', `${fn}\nheartbeat_status_for_outcome ${gapDays} ${upperBound} ${seeded}`],
        { encoding: 'utf-8' }
      );
      return out.trim();
    }
  });

  describe('spotlight_candidates (behavioral, fixture registry + ledger — no network, no claude -p)', () => {
    function extractSpotlightCandidatesFn(): string {
      const match = script.match(/spotlight_candidates\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function extractProjectInCooldownFnForSpotlight(): string {
      const match = script.match(/project_in_cooldown\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function writeFixtureRegistry(slugs: string[]): string {
      const content = JSON.stringify(slugs.map((slug) => ({ slug })));
      const path = join(tmpdir(), `fixture-registry-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
      writeFileSync(path, content, 'utf-8');
      return path;
    }

    function writeSpotlightFixtureLedger(rows: Array<[string, string]>): string {
      const header = ['# fixture ledger', '', '| Date | Slug | Project | On /projects? | Tone |', '|---|---|---|---|---|'];
      const body = rows.map(([date, project]) => `| ${date} | some-slug | ${project} | ✅ | changelog |`);
      const content = [...header, ...body].join('\n') + '\n';
      const path = join(tmpdir(), `fixture-ledger-spotlight-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
      writeFileSync(path, content, 'utf-8');
      return path;
    }

    function runSpotlightCandidates(registryPath: string, ledgerPath: string, cooldownCsv: string): string[] {
      const cooldownFn = extractProjectInCooldownFnForSpotlight();
      const spotlightFn = extractSpotlightCandidatesFn();
      const out = execFileSync(
        'bash',
        ['-c', `${cooldownFn}\n${spotlightFn}\nspotlight_candidates "${registryPath}" "${ledgerPath}" "${cooldownCsv}"`],
        { encoding: 'utf-8' }
      );
      return out.trim().split('\n').filter(Boolean);
    }

    it('excludes cooldown slugs', () => {
      const registryPath = writeFixtureRegistry(['a', 'b', 'c']);
      const ledgerPath = writeSpotlightFixtureLedger([]);
      const result = runSpotlightCandidates(registryPath, ledgerPath, 'b');
      expect(result).toEqual(['a', 'c']);
    });

    it('puts a never-covered tiled slug before a covered one', () => {
      const registryPath = writeFixtureRegistry(['x', 'y']);
      const ledgerPath = writeSpotlightFixtureLedger([['2026-01-01', 'y']]);
      const result = runSpotlightCandidates(registryPath, ledgerPath, '');
      expect(result).toEqual(['x', 'y']);
    });

    it('orders covered candidates by oldest last ledger appearance (most overdue first)', () => {
      const registryPath = writeFixtureRegistry(['e', 'f']);
      const ledgerPath = writeSpotlightFixtureLedger([
        ['2026-09-10', 'e'],
        ['2026-09-01', 'f'],
      ]);
      const result = runSpotlightCandidates(registryPath, ledgerPath, '');
      expect(result).toEqual(['f', 'e']);
    });

    it('prints nothing when every tiled slug is on cooldown', () => {
      const registryPath = writeFixtureRegistry(['p', 'q']);
      const ledgerPath = writeSpotlightFixtureLedger([]);
      const result = runSpotlightCandidates(registryPath, ledgerPath, 'p,q');
      expect(result).toEqual([]);
    });

    it('handles an empty ledger without erroring, treating every non-cooldown slug as never-covered', () => {
      const registryPath = writeFixtureRegistry(['m', 'n']);
      const ledgerPath = writeSpotlightFixtureLedger([]);
      const result = runSpotlightCandidates(registryPath, ledgerPath, '');
      expect(result).toEqual(['m', 'n']);
    });

    it('is wired into the main script after RECENT_PROJECTS_CSV is computed, feeding the portfolio and cooldown instructions', () => {
      const registryIndex = script.indexOf('RECENT_PROJECTS_CSV="$(echo "$RECENT_PROJECTS" | paste -sd, -)"');
      const spotlightCallIndex = script.indexOf('SPOTLIGHT_CANDIDATES_TOP3="$(spotlight_top3');
      expect(registryIndex).toBeGreaterThan(-1);
      expect(spotlightCallIndex).toBeGreaterThan(registryIndex);
      expect(script).toMatch(/\$\{SPOTLIGHT_CANDIDATES_TOP3\}/);
    });

    it('allows SEED_RESULT: noop/cooldown_blocked only when the spotlight candidate list is itself empty', () => {
      expect(script).toMatch(/SEED_RESULT: noop \/ cooldown_blocked are allowed ONLY when this candidate list is itself empty/);
      expect(script).toMatch(/SEED_RESULT: cooldown_blocked \/ SEED_RESULT: noop are allowed ONLY when no spotlight candidate exists either/);
    });
  });

  describe('spotlight_top3 (regression for the 2026-10-03 SIGPIPE production failure — PRD 1023)', () => {
    function extractSpotlightTop3Fn(): string {
      const match = script.match(/spotlight_top3\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function extractSpotlightCandidatesFn(): string {
      const match = script.match(/spotlight_candidates\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function extractProjectInCooldownFn(): string {
      const match = script.match(/project_in_cooldown\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function writeFixtureRegistry(slugs: string[]): string {
      const content = JSON.stringify(slugs.map((slug) => ({ slug })));
      const path = join(tmpdir(), `fixture-registry-top3-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
      writeFileSync(path, content, 'utf-8');
      return path;
    }

    function writeEmptyFixtureLedger(): string {
      const content = ['# fixture ledger', '', '| Date | Slug | Project | On /projects? | Tone |', '|---|---|---|---|---|', ''].join(
        '\n'
      );
      const path = join(tmpdir(), `fixture-ledger-top3-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
      writeFileSync(path, content, 'utf-8');
      return path;
    }

    function runSpotlightTop3UnderPipefail(registryPath: string, ledgerPath: string, cooldownCsv: string): string {
      const cooldownFn = extractProjectInCooldownFn();
      const candidatesFn = extractSpotlightCandidatesFn();
      const top3Fn = extractSpotlightTop3Fn();
      return execFileSync(
        'bash',
        [
          '-c',
          `set -euo pipefail\n${cooldownFn}\n${candidatesFn}\n${top3Fn}\nspotlight_top3 "${registryPath}" "${ledgerPath}" "${cooldownCsv}"`,
        ],
        { encoding: 'utf-8' }
      ).trim();
    }

    it('with 30 tiled candidates under set -euo pipefail, exits 0 and returns exactly 3 comma-separated slugs (the production SIGPIPE)', () => {
      const slugs = Array.from({ length: 30 }, (_, i) => `slug-${String(i).padStart(2, '0')}`);
      const registryPath = writeFixtureRegistry(slugs);
      const ledgerPath = writeEmptyFixtureLedger();
      const result = runSpotlightTop3UnderPipefail(registryPath, ledgerPath, '');
      const parts = result.split(',');
      expect(parts.length).toBe(3);
      expect(parts.every((s) => s.length > 0)).toBe(true);
    });

    it('returns an empty string, not an error, when there are fewer than 3 candidates', () => {
      const registryPath = writeFixtureRegistry(['only-one']);
      const ledgerPath = writeEmptyFixtureLedger();
      const result = runSpotlightTop3UnderPipefail(registryPath, ledgerPath, '');
      expect(result).toBe('only-one');
    });

    it('returns an empty string, not an error, when every candidate is on cooldown', () => {
      const registryPath = writeFixtureRegistry(['p', 'q']);
      const ledgerPath = writeEmptyFixtureLedger();
      const result = runSpotlightTop3UnderPipefail(registryPath, ledgerPath, 'p,q');
      expect(result).toBe('');
    });

    it('runs the REAL registry and ledger files under set -euo pipefail and succeeds with a non-empty result', () => {
      const cooldownFn = extractProjectInCooldownFn();
      const candidatesFn = extractSpotlightCandidatesFn();
      const top3Fn = extractSpotlightTop3Fn();
      const registryPath = join(__dirname, '../src/data/standalone-projects.json');
      const ledgerPath = join(__dirname, '../.claude/skills/blog-from-git/blog-ledger.md');
      const result = execFileSync(
        'bash',
        [
          '-c',
          `set -euo pipefail\n${cooldownFn}\n${candidatesFn}\n${top3Fn}\nspotlight_top3 "${registryPath}" "${ledgerPath}" ""`,
        ],
        { encoding: 'utf-8' }
      ).trim();
      expect(result.length).toBeGreaterThan(0);
    });

    it('is called at the line 460 call site instead of a bare spotlight_candidates | head | paste pipeline', () => {
      expect(script).toMatch(/SPOTLIGHT_CANDIDATES_TOP3="\$\(spotlight_top3 "\$REGISTRY_FILE" "\$LEDGER_FILE" "\$RECENT_PROJECTS_CSV"\)"/);
      expect(script).not.toMatch(/spotlight_candidates "\$REGISTRY_FILE" "\$LEDGER_FILE" "\$RECENT_PROJECTS_CSV" \| head/);
    });
  });

  describe('ledger_recent_projects under pipefail with more rows than N (the same SIGPIPE class as spotlight_top3)', () => {
    function extractLedgerRecentProjectsFn(): string {
      const match = script.match(/ledger_recent_projects\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    it('does not pipe its awk/sed output into a head that can close early', () => {
      const fn = extractLedgerRecentProjectsFn();
      expect(fn).not.toMatch(/\|\s*head\b/);
    });

    it('with more ledger rows than N, under set -euo pipefail, exits 0 and returns exactly N projects', () => {
      const fn = extractLedgerRecentProjectsFn();
      const header = ['# fixture ledger', '', '| Date | Slug | Project | On /projects? | Tone |', '|---|---|---|---|---|'];
      const body = Array.from({ length: 30 }, (_, i) => `| 2026-01-${String((i % 28) + 1).padStart(2, '0')} | slug-${i} | project-${i} | ✅ | changelog |`);
      const content = [...header, ...body].join('\n') + '\n';
      const ledgerPath = join(tmpdir(), `fixture-ledger-many-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
      writeFileSync(ledgerPath, content, 'utf-8');
      const out = execFileSync('bash', ['-c', `set -euo pipefail\n${fn}\nledger_recent_projects "${ledgerPath}" 3`], {
        encoding: 'utf-8',
      }).trim();
      const projects = out.split('\n').filter(Boolean);
      expect(projects).toEqual(['project-0', 'project-1', 'project-2']);
    });
  });

  describe('build_mode_instructions (catch-up mode must describe the spotlight fallback too — PRD 1019)', () => {
    function extractBuildModeInstructionsFn(): string {
      const match = script.match(/build_mode_instructions\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function runBuildModeInstructions(
      mode: string,
      gapDays: number,
      catchupTrigger: number,
      newestPublishedAt: string,
      spotlightCsv: string
    ): string {
      const fn = extractBuildModeInstructionsFn();
      const out = execFileSync(
        'bash',
        [
          '-c',
          `${fn}\nbuild_mode_instructions "${mode}" "${gapDays}" "${catchupTrigger}" "${newestPublishedAt}" "${spotlightCsv}"`,
        ],
        { encoding: 'utf-8' }
      );
      return out.trim();
    }

    it('describes the spotlight fallback in catch-up mode when spotlight candidates exist, naming the first candidate', () => {
      const result = runBuildModeInstructions(
        'catchup',
        12,
        10,
        '2026-09-01T00:00:00-07:00',
        'outdoor-hours,local-score'
      );
      expect(result).toMatch(/Catch-up mode/);
      expect(result).toMatch(/spotlight/i);
      expect(result).toMatch(/outdoor-hours/);
      expect(result).toMatch(/AUTHORED_AT/);
      // honest backdating still governs real backfill posts — the spotlight
      // fallback post is the one exception, so it must not say "backdated"
      expect(result).toMatch(/not backdated/);
    });

    it('omits the spotlight fallback note in catch-up mode when no spotlight candidates exist', () => {
      const result = runBuildModeInstructions('catchup', 12, 10, '2026-09-01T00:00:00-07:00', '');
      expect(result).toMatch(/Catch-up mode/);
      expect(result).not.toMatch(/spotlight/i);
    });

    it('still produces the portfolio-mode spotlight fallback instructions unchanged', () => {
      const result = runBuildModeInstructions(
        'portfolio',
        3,
        10,
        '2026-09-01T00:00:00-07:00',
        'outdoor-hours,local-score'
      );
      expect(result).toMatch(/Portfolio mode/);
      expect(result).toMatch(/FEATURE SPOTLIGHT/);
      expect(result).toMatch(/SEED_RESULT: noop \/ cooldown_blocked are allowed ONLY when this candidate list is itself empty/);
    });

    it('is wired into the main script to produce MODE_INSTRUCTIONS for both modes', () => {
      expect(script).toMatch(/MODE_INSTRUCTIONS="\$\(build_mode_instructions/);
    });

    it("COOLDOWN_INSTRUCTIONS' spotlight branch is self-contained, not dependent on portfolio-only wording", () => {
      expect(script).not.toMatch(/described in the mode instructions above/);
      expect(script).toMatch(
        /SEED_RESULT: cooldown_blocked \/ SEED_RESULT: noop are allowed ONLY when no spotlight candidate exists either/
      );
    });
  });

  describe('keep_state_lock_for_seed_line (pure, behavioral — same-day lock after publish, PRD 1020)', () => {
    function extractKeepStateLockFn(): string {
      const match = script.match(/keep_state_lock_for_seed_line\(\) \{[\s\S]*?\n\}/);
      expect(match).not.toBeNull();
      return match![0];
    }

    function runKeepStateLock(seedLine: string): string {
      const fn = extractKeepStateLockFn();
      const out = execFileSync('bash', ['-c', `${fn}\nkeep_state_lock_for_seed_line "$1"`, 'keep_state_lock_for_seed_line', seedLine], {
        encoding: 'utf-8',
      });
      return out.trim();
    }

    it('published=1 => keep', () => {
      expect(runKeepStateLock('SEED_RESULT: published=1 deferred=0 slugs="foo" note="ok"')).toBe('keep');
    });

    it('published=0 => clear', () => {
      expect(runKeepStateLock('SEED_RESULT: published=0 deferred=0 slugs="" note="nothing seeded"')).toBe('clear');
    });

    it('noop => clear', () => {
      expect(runKeepStateLock('SEED_RESULT: noop note="no publishable material"')).toBe('clear');
    });

    it('cooldown_blocked => clear', () => {
      expect(runKeepStateLock('SEED_RESULT: cooldown_blocked note="every candidate on cooldown"')).toBe('clear');
    });

    it('error => clear', () => {
      expect(runKeepStateLock('SEED_RESULT: error note="readability"')).toBe('clear');
    });

    it('empty/unparseable => clear', () => {
      expect(runKeepStateLock('')).toBe('clear');
      expect(runKeepStateLock('some unrelated output with no SEED_RESULT line')).toBe('clear');
    });

    it('published=N with N>=2 still keeps (not just N==1)', () => {
      expect(runKeepStateLock('SEED_RESULT: published=3 deferred=1 slugs="a,b,c" note="ok"')).toBe('keep');
    });

    it('the non-zero claude -p exit path routes through the function rather than an unconditional rm', () => {
      const rcBlockIndex = script.indexOf('if [[ $CLAUDE_RC -ne 0 ]]; then');
      expect(rcBlockIndex).toBeGreaterThan(-1);
      const rcBlock = script.slice(rcBlockIndex, rcBlockIndex + 700);
      expect(rcBlock).toMatch(/keep_state_lock_for_seed_line ''/);
      expect(rcBlock).toMatch(/rm -f "\$STATE_FILE"/);
    });

    it('the lock decision is made once from SEED_LINE, before the error/cooldown_blocked/noop/published branches run', () => {
      const seedLineIndex = script.indexOf("SEED_LINE=\"$(echo \"$CLAUDE_OUTPUT\"");
      const decisionIndex = script.indexOf('keep_state_lock_for_seed_line "$SEED_LINE"', seedLineIndex);
      const errorBranchIndex = script.indexOf('SEED_LINE" == SEED_RESULT:\\ error*', seedLineIndex);
      expect(seedLineIndex).toBeGreaterThan(-1);
      expect(decisionIndex).toBeGreaterThan(seedLineIndex);
      expect(errorBranchIndex).toBeGreaterThan(decisionIndex);
    });

    it('the pre-invocation state write before claude -p is unchanged', () => {
      expect(script).toMatch(/echo "\$TODAY \$MODE \$GAP_DAYS" > "\$STATE_FILE"/);
    });
  });

  describe('readability gate and non-catchup published_at rail (autonomous prompt)', () => {
    it('requires the readability checker to exit 0 before committing, with a bounded rewrite-and-recheck loop', () => {
      expect(script).toMatch(/npx tsx scripts\/blog-readability\.ts <draft-file>/);
      expect(script).toMatch(/up to 2 rewrite-and-recheck cycles total/);
      expect(script).toMatch(/SEED_RESULT: error note=\\"readability\\"/);
    });

    it('requires non-catchup posts to use published_at = AUTHORED_AT exactly, leaving catch-up backdating untouched', () => {
      expect(script).toMatch(/for every post that is NOT a catch-up backfill post, set published_at to exactly \\\$AUTHORED_AT/);
      expect(script).toMatch(/Catch-up mode backfill posts are the only exception: keep honest backdating/);
    });
  });

  describe('rotation-gate-blocked pending draft triggers a re-draft, not a stall (2026-09-12 incident)', () => {
    function extractConsumeExistingDraftsPrompt(): string {
      const start = script.indexOf('if [[ "$CONSUME_EXISTING_DRAFTS" -eq 1 ]]; then');
      const end = script.indexOf('\n  else\n', start);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      return script.slice(start, end);
    }

    it('no longer tells the executor unconditionally not to re-draft pending drafts', () => {
      // the exact defect: this phrase let "I was told not to re-draft" be a
      // correct reading even when the pending draft is unusable
      expect(script).not.toMatch(/are DONE for these — do not re-draft them/);
    });

    it('instructs re-verifying the rotation gate against the current ledger before doing anything else', () => {
      const block = extractConsumeExistingDraftsPrompt();
      expect(block).toMatch(/RE-VERIFY each one against the CURRENT blog-ledger\.md/);
      expect(block).toMatch(/rotation\.md's rules/);
    });

    it('instructs moving a rotation-rejected draft out of the *.md glob by renaming, never deleting it', () => {
      const block = extractConsumeExistingDraftsPrompt();
      expect(block).toMatch(/FAILS the rotation gate/);
      expect(block).toMatch(/\.rejected-rotation-gate/);
      expect(block).toContain('mv');
      expect(block).toContain('draft}.rejected-rotation-gate');
      expect(block).toMatch(/NEVER delete it/);
    });

    it('instructs exactly one re-draft attempt on a rotation-compliant subject, with no retry loop', () => {
      const block = extractConsumeExistingDraftsPrompt();
      expect(block).toMatch(/draft exactly ONE replacement post on a rotation-compliant subject/);
      expect(block).toMatch(/ONE re-draft attempt for this entire run, not one per rejected draft/);
      expect(block).toMatch(/do not loop, retry, or draft a second replacement/);
    });

    it('bounds the re-draft by max_posts_per_run and forbids leaving a fresh unreviewed draft behind', () => {
      const block = extractConsumeExistingDraftsPrompt();
      expect(block).toMatch(/must never exceed max_posts_per_run=\$\{MAX_POSTS_PER_RUN\}/);
      expect(block).toMatch(/neither seeded nor rejected-and-renamed/);
    });

    it('falls through to the no-invented-post noop case when no rotation-compliant subject exists at all', () => {
      const block = extractConsumeExistingDraftsPrompt();
      expect(block).toMatch(/fall through to the 'no publishable material' case/);
      // that shared case (in $REQUIREMENTS) still forbids inventing a post
      expect(script).toMatch(/do NOT invent a post to satisfy cadence/);
    });
  });

  describe('wiring to the hard minimum gap (scripts/blog-cadence-gate.ts) — PRD 1042', () => {
    it('computes NEXT_SLOT via blog-cadence-gate.ts next-slot after the /api/blog gap computation, fails closed on error or a non-ISO value', () => {
      const invocationIndex = script.indexOf('pnpm tsx scripts/blog-cadence-gate.ts next-slot');
      const gapComputationIndex = script.indexOf('GAP_DAYS=$(( (NOW_EPOCH - PUB_EPOCH)');
      expect(invocationIndex).toBeGreaterThan(-1);
      expect(gapComputationIndex).toBeGreaterThan(-1);
      expect(invocationIndex).toBeGreaterThan(gapComputationIndex);

      // must not run within the CLAUDE.md/publish claude -p invocation before it
      const publishInvocationIndex = script.indexOf('claude -p "$PROMPT"');
      expect(publishInvocationIndex).toBeGreaterThan(-1);
      expect(invocationIndex).toBeLessThan(publishInvocationIndex);

      const block = script.slice(invocationIndex - 20, invocationIndex + 600);
      expect(block).toMatch(/timeout 180 pnpm tsx scripts\/blog-cadence-gate\.ts next-slot/);
      expect(block).toMatch(/NEXT_SLOT_RC -ne 0 \|\| ! "\$NEXT_SLOT" =~ \^\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{2\}T/);
      expect(block).toMatch(/write_heartbeat "error: cadence gate unavailable"/);
      expect(block).toMatch(/exit 1/);
      // fail-closed: the fatal branch itself must not invoke any publishing claude -p
      expect(block).not.toMatch(/claude -p/);
    });

    it('scans only (never publishes) when now is earlier than NEXT_SLOT, even if the live gap says a post is due', () => {
      const publishDueIndex = script.indexOf('PUBLISH_DUE="$(publish_due_status');
      const nextSlotCompareIndex = script.indexOf('NEXT_SLOT_EPOCH="$(date -d "$NEXT_SLOT" +%s)"');
      const sameDayLockIndex = script.indexOf('idempotent per day');
      const publishInvocationIndex = script.indexOf('claude -p "$PROMPT"');

      expect(publishDueIndex).toBeGreaterThan(-1);
      expect(nextSlotCompareIndex).toBeGreaterThan(-1);
      expect(sameDayLockIndex).toBeGreaterThan(-1);
      expect(publishInvocationIndex).toBeGreaterThan(-1);

      // placed immediately after PUBLISH_DUE, and before both the same-day
      // lock and the actual publish invocation — so it precedes every path
      // to a publishing claude -p call
      expect(nextSlotCompareIndex).toBeGreaterThan(publishDueIndex);
      expect(nextSlotCompareIndex).toBeLessThan(sameDayLockIndex);
      expect(nextSlotCompareIndex).toBeLessThan(publishInvocationIndex);

      const block = script.slice(nextSlotCompareIndex, nextSlotCompareIndex + 500);
      expect(block).toMatch(/if \(\( NOW_EPOCH < NEXT_SLOT_EPOCH \)\); then/);
      expect(block).toMatch(/run_scan_only/);
      expect(block).toMatch(/NEXT_SLOT/);
    });

    it('both publishing PROMPT strings require published_at >= NEXT_SLOT and a passing cadence-gate check before commit, else SEED_RESULT: noop', () => {
      const consumeTemplateIndex = script.indexOf('${#EXISTING_DRAFTS[@]} draft(s) are already pending');
      const fullPipelineTemplateIndex = script.indexOf('running PHASES 1-7');
      expect(consumeTemplateIndex).toBeGreaterThan(-1);
      expect(fullPipelineTemplateIndex).toBeGreaterThan(-1);

      // both templates interpolate $REQUIREMENTS, which is where this text lives
      const consumeTemplateBlock = script.slice(consumeTemplateIndex, consumeTemplateIndex + 3000);
      const fullPipelineTemplateBlock = script.slice(fullPipelineTemplateIndex, fullPipelineTemplateIndex + 3000);
      expect(consumeTemplateBlock).toMatch(/\$REQUIREMENTS/);
      expect(fullPipelineTemplateBlock).toMatch(/\$REQUIREMENTS/);

      expect(script).toMatch(/published_at for EVERY post you seed this run must be an explicit ISO timestamp >= \$\{NEXT_SLOT\}/);
      expect(script).toMatch(/timeout 180 pnpm tsx scripts\/blog-cadence-gate\.ts check/);
      expect(script).toMatch(/SEED_RESULT: noop note=\\"cadence gate check failed\\"/);
    });

    it('re-runs the cadence gate check after a SEED_RESULT: published run, writing a distinct error heartbeat and exiting 1 on violation', () => {
      const publishedBranchIndex = script.indexOf('SEED_RESULT:\\ published=*');
      const liveVerifyIndex = script.indexOf('verify live pickup at /api/blog');
      expect(publishedBranchIndex).toBeGreaterThan(-1);
      expect(liveVerifyIndex).toBeGreaterThan(-1);
      expect(publishedBranchIndex).toBeLessThan(liveVerifyIndex);

      const block = script.slice(publishedBranchIndex, liveVerifyIndex);
      expect(block).toMatch(/timeout 180 pnpm tsx scripts\/blog-cadence-gate\.ts check/);
      expect(block).toMatch(/POST_SEED_CHECK_RC -ne 0/);
      expect(block).toMatch(/write_heartbeat "error: cadence gate violation after seed"/);
      expect(block).toMatch(/exit 1/);
    });
  });
});
