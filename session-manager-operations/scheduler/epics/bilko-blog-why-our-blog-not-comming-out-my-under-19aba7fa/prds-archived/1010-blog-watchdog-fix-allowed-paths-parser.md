---
title: Blog watchdog P0: allowed_commit_paths parser returns empty, blocking every autonomous publish
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 16
createdVia: scheduler-api
issuedAt: 2026-09-12T18:45:25.491Z
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: bug
agentType: dev-lead
---
# Goal

The first real autonomous run of scripts/blog-cadence-watchdog.sh (2026-09-12 00:00:21 PT, systemd timer) aborted before drafting anything, with heartbeat `error: allowed_commit_paths does not match hard-coded seed pathspec` and log line `FATAL: autonomy.allowed_commit_paths in .claude/skills/blog-from-git/blog.config.yaml (got: '')`. The awk one-liner that reads `autonomy.allowed_commit_paths` returns an EMPTY list, so the cross-check against the hard-coded seed pathspec always fails and the run exits 1. The guard is failing closed (correct — it published nothing wrong), but it blocks 100% of autonomous publishing: the blog has now not published since 2026-08-27, a 16-day gap against a 3-5 day target. Fix the parser so it reads the two configured paths, and add a test that actually EXERCISES it against the real config file rather than only matching script text.

# Acceptance criteria

- [ ] Core: the `allowed_commit_paths` parser in scripts/blog-cadence-watchdog.sh returns exactly `server/db.ts` and `.claude/skills/blog-from-git/blog-ledger.md` when run against the real .claude/skills/blog-from-git/blog.config.yaml, so the cross-check passes and the run proceeds
- [ ] Core: while inside the `allowed_commit_paths:` block the parser SKIPS blank lines and comment-only lines (lines whose first non-whitespace character is `#`) instead of treating them as the end of the block — this is the exact defect: blog.config.yaml wraps the key's trailing comment onto its own line, and the current `flag{exit}` rule fires on it
- [ ] Core: the parser still terminates the block correctly at the next real YAML key (a non-blank, non-comment line that is not a `- ` list item), so it cannot run on and swallow later config keys
- [ ] Core: inline trailing comments on a list item (e.g. `- server/db.ts   # the seed file`) are still stripped, as the existing sed already does
- [ ] Edge cases: an `allowed_commit_paths:` key that is genuinely empty or missing still produces an empty list and still trips the existing FATAL + `error:` heartbeat + exit 1 — the fail-closed behavior must NOT be loosened, only made correct
- [ ] Edge cases: a config whose list no longer matches the hard-coded seed pathspec still FATALs with the existing message — the cross-check itself is the point of the guard and stays
- [ ] Edge cases: list items written with extra indentation or with a tab instead of spaces are still parsed
- [ ] Interaction / integration: no other rail from PRDs 1007/1009 changes — the StanislavBG/bilko-run remote assertion, explicit-pathspec staging, the ban on blanket `git add -A`/`git add .`/`git commit -a`, max_posts_per_run, and the push-race rebase recovery all stay exactly as they are
- [ ] Interaction / integration: write_heartbeat is still called exactly once per run on every path and the heartbeat format stays `<ISO-8601 timestamp> <status text>`
- [ ] Tests: a NEW BEHAVIORAL test actually runs the parser against the real `.claude/skills/blog-from-git/blog.config.yaml` (extract the parse into a tiny function or a `--print-allowed-paths` style debug flag the test can invoke, or execute the awk expression itself via node:child_process) and asserts it yields exactly the two expected paths — a static text-match test is NOT sufficient here and would not have caught this defect
- [ ] Tests: additional behavioral cases cover a comment-only line between the key and the first item, a blank line inside the block, an inline trailing comment on an item, and a following YAML key that must terminate the block
- [ ] Tests: the existing static assertions in tests/blog-cadence-watchdog.test.ts continue to pass unchanged
- [ ] Tests: `bash -n scripts/blog-cadence-watchdog.sh` passes
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

ROOT CAUSE, already reproduced — do not re-diagnose from scratch, just confirm and fix.

The parser at scripts/blog-cadence-watchdog.sh (in the `AUTONOMOUS_PUBLISH == "true"` block, around line 140) is:

    ALLOWED_PATHS_RAW="$(awk '/allowed_commit_paths:/{flag=1; next} flag && /^[[:space:]]*-[[:space:]]*/{print; next} flag{exit}' "$CONFIG_FILE")"

The config it must read (.claude/skills/blog-from-git/blog.config.yaml, lines 99-102, verified with `cat -A`):

    99:  allowed_commit_paths:                 # the ONLY paths an autonomous seed commit may stage —
    100:                                        # explicit pathspecs only, never `git add -A`/`.`/`-a`
    101:    - server/db.ts
    102:    - .claude/skills/blog-from-git/blog-ledger.md

Line 100 is a COMMENT-ONLY CONTINUATION of line 99's wrapped comment. It does not match `^[[:space:]]*-[[:space:]]*`, so awk falls through to `flag{exit}` and exits before ever reaching lines 101-102. Result: empty output, empty ALLOWED_COMMIT_PATHS array, FATAL.

Reproduce it directly:

    awk '/allowed_commit_paths:/{flag=1; next} flag && /^[[:space:]]*-[[:space:]]*/{print; next} flag{exit}' .claude/skills/blog-from-git/blog.config.yaml
    # prints nothing

The fix is in the awk (or a replacement parse): while `flag` is set, `next` past blank lines and lines matching `^[[:space:]]*#`, only `exit` on a non-blank, non-comment, non-list line.

WHY THE TEST SUITE MISSED IT — this is the important part, and why the AC demands a behavioral test. tests/blog-cadence-watchdog.test.ts is static-text-only by deliberate design (PRD 1002's postmortem: it must never invoke curl or `claude -p`). 368 tests passed while this shipped, because every assertion matched script TEXT and none ever ran the parser against the real config. Executing awk or a tiny extracted function is pure-local and fast — it does not violate the no-network/no-claude-p rule, so add it.

Live impact to state in the completion report: heartbeat at .claude/skills/blog-from-git/drafts/.watchdog-heartbeat currently reads `2026-09-12T00:00:21-07:00 error: allowed_commit_paths does not match hard-coded seed pathspec`. Newest live post is 2026-08-27 (16-day gap, past the 10-day catchup_trigger). Next automatic attempts: systemd timer ~00:00 PT and the crontab entry at 12:00 PT.

Follow the script's existing conventions: `set -euo pipefail`, exactly one write_heartbeat per exit path, `[blog-cadence-watchdog]`-prefixed stdout, failures to stderr, thresholds read from blog.config.yaml rather than hard-coded.

Sibling PRD 1008-blog-watchdog-verify-live-pickup is still pending; do not duplicate its /api/blog verification poll.

# Out of scope

- Do NOT loosen or remove the fail-closed cross-check between config and the hard-coded seed pathspec — it behaved correctly, it was just fed an empty list
- Do NOT 'fix' this by editing blog.config.yaml to unwrap the comment — the parser must handle a normal YAML comment; a config-side workaround leaves the same trap for the next edit
- Do NOT hard-code the allowed paths and skip reading the config — the config is the owner's control surface
- Do NOT weaken any rail from PRDs 1007/1009 (remote assertion, explicit pathspecs, blanket-add ban, max_posts_per_run, push-race recovery)
- Do NOT add the /api/blog live-pickup poll — PRD 1008 owns that
- Do NOT make any test call the network or invoke claude -p

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
