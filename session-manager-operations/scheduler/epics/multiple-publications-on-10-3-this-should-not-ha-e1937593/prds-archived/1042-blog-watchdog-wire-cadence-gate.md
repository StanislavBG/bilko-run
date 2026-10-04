---
title: Watchdog: enforce the cadence gate (next-slot before publish, check after) and 3-4 day target
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-03T19:11:43.215Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
dependsOn: [blog-cadence-remediate-10-03]
planId: pl-musroq7k-b96201
---
# Goal

wire: make scripts/blog-cadence-watchdog.sh (daily systemd/cron, autonomous publisher) obey the hard minimum gap from scripts/blog-cadence-gate.ts, including posts that are seeded but scheduled for the future (invisible on /api/blog). Without this, on 2026-10-07 00:00 PDT the watchdog would see a 3-day live gap and publish a second post on the same day the rescheduled OutdoorHours post goes live. Also tighten the owner's target cadence to every 3-4 days.

# Acceptance criteria

- [ ] `.claude/skills/blog-from-git/blog.config.yaml` `cadence.target_gap_days` is `[3, 4]` (owner policy: publish every 3-4 days); its comment updated accordingly.
- [ ] `scripts/blog-cadence-watchdog.sh` computes NEXT_SLOT by running `timeout 180 pnpm tsx scripts/blog-cadence-gate.ts next-slot` after the /api/blog gap computation; if that command fails or prints a non-ISO value it writes heartbeat `error: cadence gate unavailable` and exits 1 WITHOUT invoking any publishing claude -p (fail closed).
- [ ] `scripts/blog-cadence-watchdog.sh`: when now is earlier than NEXT_SLOT, it calls run_scan_only with a reason naming NEXT_SLOT (the publish path is never reached), even if the live GAP_DAYS says a post is due.
- [ ] `scripts/blog-cadence-watchdog.sh` both publishing PROMPT strings tell claude: published_at must be an explicit ISO >= NEXT_SLOT (value interpolated), and `pnpm tsx scripts/blog-cadence-gate.ts check` must exit 0 before git commit, else abort with SEED_RESULT: noop.
- [ ] `scripts/blog-cadence-watchdog.sh`: after a SEED_RESULT published run, it re-runs the gate `check`; on non-zero it writes heartbeat `error: cadence gate violation after seed` and exits 1.
- [ ] `tests/blog-cadence-watchdog.test.ts` gains static-text tests for each of the four watchdog behaviours above (next-slot invocation + fail-closed exit, scan-only before NEXT_SLOT placed before the publish path, prompt text, post-seed check), and its existing target_gap_days parsing test passes with [3, 4].

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- tests/blog-cadence-watchdog.test.ts
- .claude/skills/blog-from-git/blog.config.yaml

# Implementation notes

Read first: scripts/blog-cadence-watchdog.sh lines 315-330 (bound parsing), 430-545 (fetch, GAP_DAYS, run_scan_only, PUBLISH_DUE, same-day state lock), 600-700 (PROMPT strings + claude -p invocation), 730-930 (SEED_RESULT handling + live verify); tests/blog-cadence-watchdog.test.ts lines 1-80 and 488-530 (existing static-check style); scripts/blog-cadence-gate.ts (landed by an earlier PRD: `next-slot` prints the ISO of max(now, latest seeded published_at + min_gap_days); `check` exits 1 on violations; it reads seeds from server/db.ts via a temp SQLite DB, never prod).

Steps:
1. blog.config.yaml: [3, 5] -> [3, 4]. Update the inline comment (upper bound 4 = stall threshold).
2. Watchdog: after the GAP_DAYS echo (~line 477) add NEXT_SLOT computation (validate with a regex like ^[0-9]{4}-[0-9]{2}-[0-9]{2}T), compare epochs via `date -d`, log `next_slot=$NEXT_SLOT`. Place the "before NEXT_SLOT -> run_scan_only" check immediately after the existing PUBLISH_DUE check so it also precedes the same-day state lock and every claude -p publish call.
3. Insert the prompt sentences into both PROMPT strings (~617 and ~666).
4. In the SEED_RESULT published branch, before the live-pickup verification, run the check (timeout 180); fail -> heartbeat error + exit 1.
5. Tests: static regex/indexOf checks in the existing file's style; never invoke curl or claude -p from tests. Keep every existing test green.
6. Update the header comment lines 1-15 of the watchdog to mention the hard min gap. Keep `set -e` semantics: wrap new commands in set +e / capture rc like existing code does.

Do not touch: server/, scripts/blog-cadence-gate.ts, skill .md docs (a sibling PRD owns them), docs/blog-watchdog.md.

# Out of scope

- Changing the cooldown (3 posts) or readability rules
- Changing the systemd/cron schedule
- Skill documentation

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts tests/blog-spotlight-mode.test.ts tests/blog-cadence-gate.test.ts
timeout 60 bash -n scripts/blog-cadence-watchdog.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
