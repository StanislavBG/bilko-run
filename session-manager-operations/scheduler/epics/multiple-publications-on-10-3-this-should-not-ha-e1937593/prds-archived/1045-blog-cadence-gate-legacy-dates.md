---
title: Cadence gate: give 13 legacy seeds fixed historical dates so `check` is a real signal
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T20:39:45.217Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
disposition: new-head
planId: pl-musuvdc1-ca8285
---
# Goal

behavior: make `pnpm tsx scripts/blog-cadence-gate.ts check` exit 0 on the real tree. Thirteen legacy blog seeds in server/db.ts use `new Date().toISOString()` for published_at, so on every fresh DB init they are stamped "now", land inside the gate's 2026-10-01 enforcement window and always trip the 3-day min-gap check. That makes the watchdog's post-seed check and the skill's pre-commit check fail on every future publish (first possible publish: 2026-10-10T16:00Z), blocking all posting.

# Acceptance criteria

- [ ] Every `new Date().toISOString()` used as a blog_posts published_at in `server/db.ts` (the 13 legacy seeds: how-pageroast-went-from-frustration-to-product, we-built-stackaudit-because-reddit-told-us-to, localscore-browser-ai-that-never-sees-your-data, 10-tools-solo-what-i-learned-shipping-bilko-run, building-outdoorhours-121-months-of-weather, burrow-from-background-task-to-cron-orchestrated, npr-ad-skipper-gemini-only-and-97-percent-agreement, bilko-flow-v0-3-1-first-npm-release, outdoorhours-week-2-from-fixed-rules-to-rule-engine, from-saas-to-host-decomposing-bilko-in-one-week, week-of-six-games, all-green-three-bugs-the-regression-pass-caught, the-week-the-platform-got-dumber) is replaced by a fixed ISO literal.
- [ ] Each fixed literal equals that slug's real production published_at, read from `curl -s --max-time 15 https://bilko.run/api/blog` (prod rows already exist, so INSERT OR IGNORE never changes prod; this only fixes fresh DBs). If a slug is absent from the live API, use the date of the git commit that added its seed (`git log --diff-filter=A -S '<slug>' --format=%cI -- server/db.ts`, last line) and say so in the commit message.
- [ ] No production data migration is added and no other post's date changes.
- [ ] `tests/blog-cadence-gate.test.ts` repo-wide test (findSpacingViolations over loadSeededPosts returns []) passes, and a new test asserts no blog seed in server/db.ts uses `new Date()` for published_at (static text check on the INSERT blocks).
- [ ] `pnpm tsx scripts/blog-cadence-gate.ts check` prints ok and exits 0; `next-slot` prints 2026-10-10T16:00:00.000Z or later.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- tests/blog-cadence-gate.test.ts

# Implementation notes

Read first: scripts/blog-cadence-gate.ts (loadSeededPosts, findSpacingViolations, CLI), tests/blog-cadence-gate.test.ts, server/db.ts — locate the 13 seeds with `rg -n 'new Date\(\)\.toISOString\(\)' server/db.ts` and check each is a blog_posts published_at arg (leave non-blog uses alone).

Steps:
1. Fetch the live list once (bounded curl, max-time 15) and map slug -> published_at.
2. Replace each legacy `new Date().toISOString()` published_at arg with the fixed literal.
3. Add the static test. Run the gate commands last.

Do not touch: scripts/blog-cadence-watchdog.sh, server/routes/, .claude/skills/, the OutdoorHours reschedule migration.

# Out of scope

- Changing min_gap_enforced_since
- Any prod data migration

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-cadence-gate.test.ts tests/db.test.ts tests/blog-rewrites.test.ts
timeout 120 pnpm tsx scripts/blog-cadence-gate.ts check
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
