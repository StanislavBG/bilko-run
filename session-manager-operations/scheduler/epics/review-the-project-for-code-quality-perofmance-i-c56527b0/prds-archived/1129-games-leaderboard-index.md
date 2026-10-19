---
title: Games leaderboard: queries without a mode must still use the score index
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-09T23:08:04.763Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kt89n-a2bdeb
---
# Goal

behavior. server/services/games.ts (~line 103) builds the leaderboard query without `mode` when the caller gives none. The only index is idx_scores_game_score (game, mode, score), so that query scans every score for the game. When mode is absent, use the game's default mode from shared/game-config.ts, or else query in a form the existing index serves. Prove it with EXPLAIN QUERY PLAN.

# Acceptance criteria

- [ ] When mode is omitted, the leaderboard query either uses the game's configured default mode (from shared/game-config.ts) or otherwise produces a plan that uses idx_scores_game_score; results for games with a single mode are unchanged.
- [ ] tests/game-services.test.ts adds a test running `EXPLAIN QUERY PLAN` on the generated SQL and asserting it mentions idx_scores_game_score and not a full `SCAN scores`.
- [ ] tests/game-services.test.ts and tests/cross-game.test.ts are green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/services/games.ts
- tests/game-services.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Do not add indexes (schema lives in server/db.ts, owned by another plan). Read first: server/services/games.ts (whole); shared/game-config.ts; the scores CREATE TABLE/INDEX in server/db.ts (read only). Do not touch: server/db.ts, server/routes/games.ts.

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
