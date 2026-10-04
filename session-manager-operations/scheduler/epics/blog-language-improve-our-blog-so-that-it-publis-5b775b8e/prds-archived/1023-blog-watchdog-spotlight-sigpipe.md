---
title: URGENT: blog watchdog crashes on SIGPIPE computing spotlight top-3 under pipefail
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T16:00:29.714Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: bug
agentType: dev-lead
disposition: new-head
planId: pl-muskw8pe-8b9b24
---
# Goal

behavior. Production failure 2026-10-03 06:32 PDT: every real run of scripts/blog-cadence-watchdog.sh now exits 1 before publishing. Log: `scripts/blog-cadence-watchdog.sh: line 228: echo: write error: Broken pipe` / `cut: write error: Broken pipe`, heartbeat `error: unexpected exit (rc=1)`. Cause: line 460 `SPOTLIGHT_CANDIDATES_TOP3="$(spotlight_candidates ... | head -n 3 | paste -sd, -)"` runs under `set -euo pipefail` (line 69); with more than 3 tiled candidates (the real registry has ~25) `head` closes the pipe, spotlight_candidates dies with SIGPIPE, pipefail makes the pipeline fail, errexit kills the script. Unit tests passed because they never ran the assignment under pipefail with more than 3 candidates.

# Acceptance criteria

- [ ] The top-3 computation is a pure function `spotlight_top3 <registry> <ledger> <cooldown_csv>` in scripts/blog-cadence-watchdog.sh that captures spotlight_candidates' full output first and takes the first 3 without a pipe that can close early (e.g. mapfile into an array, or bash string ops); line 460's assignment calls it
- [ ] tests/blog-cadence-watchdog.test.ts gains a regression test that runs `set -euo pipefail` then sources the script functions and calls spotlight_top3 with a fixture registry of 30 tiled slugs and an empty ledger, asserting exit 0 and exactly 3 comma-separated slugs
- [ ] Every other `| head` pipeline in scripts/blog-cadence-watchdog.sh is reviewed: any one whose upstream can still be writing when head exits is fixed the same way (list what you checked in your report)
- [ ] A test runs the REAL repo files (src/data/standalone-projects.json and .claude/skills/blog-from-git/blog-ledger.md) through spotlight_top3 under `set -euo pipefail` and asserts exit 0 and a non-empty result
- [ ] Existing tests in tests/blog-cadence-watchdog.test.ts and tests/blog-watchdog-heartbeat.test.ts pass; bash -n passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- tests/blog-cadence-watchdog.test.ts

# Implementation notes

Read first: scripts/blog-cadence-watchdog.sh lines 60-75 (set -euo pipefail, source guard), 180-240 (spotlight_candidates), 450-470 (call site), tests/blog-cadence-watchdog.test.ts (how spotlight_candidates tests source the script — reuse; note they must enable pipefail for the new tests to reproduce the bug).

Steps: 1) write the 30-slug pipefail test first and confirm it fails (run it early, capture output, per the standards' red-step guidance); 2) add spotlight_top3 and use it at line 460; 3) audit other `| head` uses; 4) gate last.

Urgency: the noon PT crontab run and the heartbeat auto-retry will both crash until this lands.

Do not touch: scripts/check-blog-watchdog-heartbeat.sh, blog.config.yaml, server/db.ts, the drafts/ state files. Never run the watchdog for real (it calls claude -p and pushes).

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
