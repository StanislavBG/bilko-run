---
title: Blog skill docs: min gap is never overridable; owner "publish now" schedules at next slot
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-03T19:12:02.801Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
dependsOn: [blog-watchdog-wire-cadence-gate]
planId: pl-musroq7k-b96201
---
# Goal

doc: close the manual/interactive path that caused the 2026-10-03 double publication. An interactive session read `rotation.override: user-explicit-only` as permission to publish a second post the same day after the owner said "publish, lets start getting new blogs". Document that cadence.min_gap_days (3) is a hard rule no override bypasses, that every seed must pass `pnpm tsx scripts/blog-cadence-gate.ts check`, and that an owner request to publish inside the gap is honoured by seeding with published_at = the `next-slot` value (scheduled; goes live automatically), never same-day.

# Acceptance criteria

- [ ] `.claude/skills/blog-from-git/seed.md` Seeding mechanics: published_at for portfolio/focused/spotlight is max(now, output of `pnpm tsx scripts/blog-cadence-gate.ts next-slot`); the bash block runs `pnpm tsx scripts/blog-cadence-gate.ts check` before `git commit` and says to stop (no commit, no push) if it fails.
- [ ] `.claude/skills/blog-from-git/seed.md` states that a post seeded with a future published_at is hidden from /api/blog until that time, and that live-pickup verification must wait for (or skip until) that time rather than fail.
- [ ] `.claude/skills/blog-from-git/rotation.md` gains a rule near the top: `cadence.min_gap_days` (3 days between any two posts) is HARD — `rotation.override: user-explicit-only` covers rotation rules only, never the gap; an owner "publish now" inside the gap is scheduled at next-slot and the reply tells the owner the go-live time in Pacific Time.
- [ ] `docs/blog-watchdog.md` reflects target_gap_days [3, 4], the NEXT_SLOT gate (scan-only before it, fail closed if the gate cannot run), and the post-seed `check`.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/seed.md
- .claude/skills/blog-from-git/rotation.md
- docs/blog-watchdog.md

# Implementation notes

Read first: .claude/skills/blog-from-git/seed.md lines 1-40, .claude/skills/blog-from-git/rotation.md lines 1-40, docs/blog-watchdog.md (whole file, it is short), scripts/blog-cadence-gate.ts (CLI usage) and scripts/blog-cadence-watchdog.sh around the NEXT_SLOT logic (landed by earlier PRDs — describe what is actually there).

Background facts to state accurately: 2026-10-03 had two posts (git-viewer at 16:08Z via watchdog, OutdoorHours at 17:26Z via owner override); OutdoorHours was rescheduled to 2026-10-07T16:00:00Z (9:00 AM PDT). /api/blog filters `datetime(published_at) <= datetime('now')`.

Keep the docs' existing voice and structure; add, don't rewrite whole sections. Plain-language GED/early-college readability rules for post content are unchanged.

Do not touch: blog.config.yaml, scripts/, server/, tests/, SKILL.md, blog-ledger.md.

# Out of scope

- Code changes
- Changing rotation cooldown or readability policy

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 rg -n 'blog-cadence-gate.ts check' .claude/skills/blog-from-git/seed.md && timeout 30 rg -n 'min_gap_days' .claude/skills/blog-from-git/rotation.md && timeout 30 rg -n 'NEXT_SLOT' docs/blog-watchdog.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
