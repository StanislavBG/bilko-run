---
title: Wire the single budget table into server DB seeds and sanity-QA size runner
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-04T08:58:11.764Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [mcp-budget-contract]
planId: pl-mutl8g7n-73e51b
---
# Goal

wire: make server/db.ts budget seeding and scripts/sanity-qa-runners/size.ts read from mcp-host-server/src/contract/app-budgets.ts (landed by PRD mcp-budget-contract). Today sanity-QA and the publish gate disagree: for example academy is 400 KB in sanity-QA but 700 KB in the gate, so a publish that passes the gate later fails QA.

# Acceptance criteria

- [ ] server/db.ts app_budgets seeding (about lines 665-720) takes its slugs and limits from DEFAULT_BUDGET_GZ_BYTES and APP_BUDGETS_GZ_BYTES; the inline academy and OVERSIZE_BUDGETS literals are gone. The raise-if-lower upsert behavior for oversize apps is kept
- [ ] scripts/sanity-qa-runners/size.ts drops its BUDGETS_BYTES table and uses budgetFor(slug) from the contract
- [ ] MAX_FILE_COUNT in size.ts no longer fails apps that the gate accepts: bundles with an APP_BUDGETS_GZ_BYTES override are exempt from the file-count check
- [ ] Server typecheck plus tests/db.test.ts and tests/sanity-qa.test.ts pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- scripts/sanity-qa-runners/size.ts
- tests/sanity-qa.test.ts

# Implementation notes

Read the landed code first: mcp-host-server/src/contract/app-budgets.ts.
Read first: server/db.ts lines 660-725; scripts/sanity-qa-runners/size.ts lines 1-120; tests/sanity-qa.test.ts (size-runner expectations you may need to keep green).

Import path from server/db.ts: '../mcp-host-server/src/contract/app-budgets.js'. tsconfig.server.json has rootDir '.', so this compiles into dist-server/mcp-host-server/... and runs on Render. Confirm with `pnpm exec tsc -p tsconfig.server.json --noEmit`. The STATIC_SLUGS list in db.ts (which slugs get the default seed) may stay local.

Do not touch: mcp-host-server/src/contract/app-budgets.ts, mcp-host-server/src/gates/budget.ts, scripts/sanity-qa.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm exec tsc -p tsconfig.server.json --noEmit
timeout 300 pnpm vitest run tests/db.test.ts tests/sanity-qa.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
