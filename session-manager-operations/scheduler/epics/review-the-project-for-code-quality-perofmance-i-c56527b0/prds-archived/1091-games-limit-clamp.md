---
title: Games API: clamp the leaderboard `limit` (negative = unbounded, text = 500 error)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-09T19:45:04.624Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1dk60g-49a2f3
---
# Goal

bug. server/routes/games.ts ~line 42 computes `Math.min(Number(q.limit), 500)`: `limit=-1` passes through and SQLite treats LIMIT -1 as unlimited (a full-table read on a public endpoint), and `limit=abc` gives NaN and a 500. Clamp to an integer in [1, 500] with the existing default when absent or invalid.

# Acceptance criteria

- [ ] server/routes/games.ts: limit parsing yields an integer in [1, 500]; missing, NaN, zero, negative or fractional input falls back to the route's current default (or 1 for zero/negative if no default exists — say which).
- [ ] tests/game-services.test.ts (or the existing games route test) gains cases for limit=-1, limit=abc, limit=100000 and limit=10 asserting status 200 and row counts within the bound.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/games.ts
- tests/game-services.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/routes/games.ts (whole); tests/game-services.test.ts (setup pattern; if it only tests services, add route cases via app.inject in the same file).

Do not touch: server/services/games.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/game-services.test.ts tests/cross-game.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
