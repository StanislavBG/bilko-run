---
title: Blog watchdog: same-day lock only after a real publish, so the noon run can retry a skipped/failed midnight run
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T08:28:13.692Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-watchdog-catchup-spotlight]
planId: pl-mus4qaiv-8b53ae
---
# Goal

behavior. The watchdog runs twice a day (systemd timer at 00:00 PT, crontab at 12:00 PT), but scripts/blog-cadence-watchdog.sh writes the `.watchdog-state` "ran today" lock BEFORE invoking claude -p (~line 613) and only clears it when claude -p exits non-zero. So when the midnight run ends `SEED_RESULT: noop` or `cooldown_blocked` (as on 2026-10-02 and 2026-10-03, while the blog was 6+ days stale), the noon run only scans and cannot publish. The lock exists to stop a double publish on one day — make it mean exactly that.

# Acceptance criteria

- [ ] After claude -p returns, the state lock is kept ONLY when the run seeded at least one post (SEED_RESULT: published=N with N>=1, including the 'seed commit already present on origin/main' recovery path); on SEED_RESULT noop, cooldown_blocked, error, an unparseable/missing SEED_RESULT line, or non-zero claude -p exit, the lock file is removed so a same-day retry can publish
- [ ] The pre-invocation write of the state file stays (it marks an in-flight run for orphan-draft detection per the existing comment), and the EXISTING_DRAFTS orphan guard and max_posts_per_run behavior are unchanged
- [ ] A second run on a day that already seeded a post still short-circuits to scan-only (no double publish)
- [ ] The decision is a pure function (e.g. `keep_state_lock_for_seed_line <seed_line>` printing keep/clear) called at every exit path after claude -p; tests/blog-cadence-watchdog.test.ts covers published=1 => keep, published=0 => clear, noop => clear, cooldown_blocked => clear, error => clear, empty => clear
- [ ] Existing tests in tests/blog-cadence-watchdog.test.ts and tests/blog-watchdog-heartbeat.test.ts pass; write_heartbeat still called exactly once per run; bash -n passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- tests/blog-cadence-watchdog.test.ts

# Implementation notes

Read first: scripts/blog-cadence-watchdog.sh lines 450-470 (same-day lock check -> run_scan_only), lines 600-700 (state write before claude -p, rm -f on non-zero exit, SEED_LINE parsing branches for published / cooldown_blocked / noop / error and the 'already present on origin/main' recovery), docs/blog-watchdog.md (mentions the timers; update its lock description in one or two sentences only if it states the old semantics — it is NOT in this PRD's files, so if it needs a change, say so in your report instead of editing), tests/blog-cadence-watchdog.test.ts harness.

Steps: red tests for the pure function; add it near the other pure helpers; call it on each post-claude exit path (remove the lock when it prints clear). Keep the existing `rm -f "$STATE_FILE"` on non-zero exit (or route it through the function).

Do not touch: scripts/check-blog-watchdog-heartbeat.sh (next PRD), the crontab or systemd units, blog.config.yaml. Never run the watchdog for real.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 bash -n scripts/blog-cadence-watchdog.sh
timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
