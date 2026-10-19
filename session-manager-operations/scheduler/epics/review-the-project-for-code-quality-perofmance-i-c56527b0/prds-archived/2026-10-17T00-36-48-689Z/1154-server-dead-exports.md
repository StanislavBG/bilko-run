---
title: Server: delete exports nothing uses (refreshReferrerRules, getGameConfig, recordOtpFailure)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-09T23:16:15.386Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [games-leaderboard-index]
planId: pl-mv1kt89n-a2bdeb
---
# Goal

migration. Unreferenced exports mislead maintainers about what is live: refreshReferrerRules (server/services/analytics.ts ~24), getGameConfig (server/services/games.ts ~35) and recordOtpFailure (server/sm-relay/tokens.ts ~98). Delete each after confirming zero references. Also drop the `export` keyword from helpers only used inside their own file (getUsageCount and todayUTC are in _shared.ts and owned elsewhere, so skip them).

# Acceptance criteria

- [ ] Each of the three functions is deleted only after `git grep -n -w <name>` shows no use outside its definition; the report pastes each check. If one is used (e.g. by a test), keep it and say so.
- [ ] In those same three files, `export` is removed from functions/constants referenced only within the file (verified by git grep), e.g. getRivalPair if present, generateOtpCode, otpStore, wsTicketStore, otpRateStore when unused elsewhere.
- [ ] Full `pnpm test` and `pnpm typecheck` green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/services/analytics.ts
- server/services/games.ts
- server/sm-relay/tokens.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: the three files. Do not touch: any other file except tests that import a removed symbol (then keep the symbol).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 400 pnpm vitest run
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
