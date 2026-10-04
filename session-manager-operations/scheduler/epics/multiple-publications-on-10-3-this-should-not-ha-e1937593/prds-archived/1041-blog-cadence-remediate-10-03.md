---
title: Remediate 2026-10-03 double publication: reschedule OutdoorHours post to 2026-10-07
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T19:11:16.600Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
dependsOn: [blog-cadence-gate-primitive, blog-api-scheduled-publishing]
planId: pl-musroq7k-b96201
---
# Goal

migration: fix the live data so bilko.run no longer shows two posts dated 2026-10-03. The OutdoorHours post (slug twelve-places-one-weather-rule-you-set-yourself, published_at 2026-10-03T17:26:18.000Z) was the second post that day, seeded by an owner-override session; reschedule it to 2026-10-07T16:00:00.000Z (9:00 AM PDT, ~4 days after the git-viewer post at 2026-10-03T16:08:44Z) so it disappears now and goes live automatically via the scheduled-publishing filter. Then lock the rule in with a repo-wide test that the seeded posts obey the minimum gap.

# Acceptance criteria

- [ ] `server/db.ts` OutdoorHours seed (the dbRun inserting slug twelve-places-one-weather-rule-you-set-yourself) now uses published_at '2026-10-07T16:00:00.000Z', and its comment notes it was rescheduled to honour the 3-day minimum gap.
- [ ] `server/db.ts` initDb() runs `applyDataMigrationOnce('2026-10-03-reschedule-outdoor-hours-post', ...)` with `UPDATE blog_posts SET published_at = ?, updated_at = ? WHERE slug = ? AND published_at = ?` (new '2026-10-07T16:00:00.000Z', old '2026-10-03T17:26:18.000Z'), placed after the seed so existing prod rows are moved exactly once and an owner edit to another date is never clobbered.
- [ ] `tests/blog-cadence-gate.test.ts` gains a repo-wide test: `findSpacingViolations(await loadSeededPosts(), 3, '2026-10-01T00:00:00.000Z')` returns an empty array.
- [ ] `tests/blog-cadence-gate.test.ts` asserts the OutdoorHours row's published_at in the seeded DB is '2026-10-07T16:00:00.000Z'.
- [ ] `.claude/skills/blog-from-git/blog-ledger.md` OutdoorHours row date changes to 2026-10-07 with tone note `(spotlight, scheduled)`, and the Current rotation state block records: rescheduled 2026-10-03 because two posts on one day violated the 3-day minimum gap; owner overrides never bypass min_gap_days.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- tests/blog-cadence-gate.test.ts
- .claude/skills/blog-from-git/blog-ledger.md

# Implementation notes

Read first: server/db.ts lines 3010-3050 (OutdoorHours seed + applyBlogRewrites call), server/db.ts lines 565-600 (applyDataMigrationOnce signature: `applyDataMigrationOnce(id: string, statements: InStatement[]): Promise<boolean>`), scripts/blog-cadence-gate.ts (landed by PRD blog-cadence-gate-primitive — read it first; use its exported loadSeededPosts/findSpacingViolations), .claude/skills/blog-from-git/blog-ledger.md lines 1-90.

Steps:
1. server/db.ts: change the seed literal; add the one-shot migration right after the OutdoorHours dbRun (before applyBlogRewrites). The WHERE on the old published_at keeps it idempotent and safe.
2. tests/blog-cadence-gate.test.ts: add the two repo-wide tests (they import loadSeededPosts, which uses a temp DB — never the prod Turso). Allow a 60s test timeout for initDb.
3. Ledger: edit the row + rotation-state prose. Keep the ledger newest-first by date (OutdoorHours 2026-10-07 stays the top row).
4. Push to origin main after commit is handled by the normal finish flow; Render auto-deploys and the migration runs at boot. Do not poll the live site in this PRD (the validator checks live).

Do not touch: server/routes/, scripts/blog-cadence-watchdog.sh, blog.config.yaml, any other post's content or date.

# Out of scope

- Rewriting the OutdoorHours post text
- Moving the git-viewer post (its date is honest: authored and published 2026-10-03)
- Watchdog changes

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
