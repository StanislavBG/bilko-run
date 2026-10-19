---
title: Frontend: delete unused exports (fetchJSON/postJSON, LIVE_PROJECTS, COOKING_PROJECTS, Channel)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-09T23:09:58.761Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kvo89-1ff19a
---
# Goal

migration. A review found exports nothing imports: `fetchJSON` and `postJSON` in src/data/api.ts, `LIVE_PROJECTS` and `COOKING_PROJECTS` in src/data/projectsRegistry.ts (~103-104), and the exported `Channel` type in src/data/portfolio.ts (~34). Dead exports mislead future maintainers about what is used. Remove each one after confirming it has zero importers.

# Acceptance criteria

- [ ] Each listed symbol is removed only after `git grep -n -w <symbol> -- src tests scripts e2e` shows no use outside its own definition; the report pastes each check.
- [ ] If src/data/api.ts ends up empty or only re-exporting API, it is deleted, or kept with only what is used; importers are updated.
- [ ] `pnpm typecheck`, `pnpm build` and `pnpm test` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/api.ts
- src/data/projectsRegistry.ts
- src/data/portfolio.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/data/api.ts; src/data/projectsRegistry.ts lines 95-110; src/data/portfolio.ts lines 25-40. Do not touch: vite.config.ts, src/constants.ts, src/data/projectsView.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
timeout 400 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
