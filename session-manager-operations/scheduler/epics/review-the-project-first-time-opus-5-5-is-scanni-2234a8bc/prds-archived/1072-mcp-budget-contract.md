---
title: Publish budget gate: one budget table, measure the real gzipped bundle
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-04T08:57:45.491Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
disposition: new-head
planId: pl-mutl8g7n-73e51b
---
# Goal

primitive: the budget gate (mcp-host-server/src/gates/budget.ts) trusts the size the app reports in its own manifest. It also reads limits from the MCP's DB, which with no TURSO env is the local data/contentgrade.db rather than production, so it falls back to 200 KB and wrongly blocks apps whose production budget is larger. Budgets are also defined three times with different numbers (server/db.ts seeds, scripts/sanity-qa-runners/size.ts, the gate default). This PRD makes a single typed budget table in the contract folder and makes the gate measure the actual bundle.

# Acceptance criteria

- [ ] New file mcp-host-server/src/contract/app-budgets.ts exports `DEFAULT_BUDGET_GZ_BYTES = 200_000` and `APP_BUDGETS_GZ_BYTES: Readonly<Record<string, number>>`, holding every per-slug override currently seeded in server/db.ts (academy 700000, the OVERSIZE_BUDGETS entries such as session-manager and escape-velocity), and `budgetFor(slug): number`
- [ ] gates/budget.ts computes the bundle's real gzipped size by gzipping every file under ctx.bundleDir (node:zlib gzipSync, recursive walk) and compares that to budgetFor(ctx.slug); it no longer queries the DB
- [ ] When the measured size differs from manifest.bundle.sizeBytesGz by more than 10%, the gate still passes or fails on the measured size, and details mention both numbers
- [ ] tests/publish-gate.test.ts budget cases are updated to use real fixture bytes and cover: under budget passes, over budget fails, an app-specific override applies, and a manifest that under-reports size still fails on the measured size

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/contract/app-budgets.ts
- mcp-host-server/src/gates/budget.ts
- tests/publish-gate.test.ts

# Implementation notes

Read first: mcp-host-server/src/gates/budget.ts (21 lines); server/db.ts lines 665-720 (STATIC_SLUGS default seeds, academy, OVERSIZE_BUDGETS; copy the numbers exactly); tests/publish-gate.test.ts (budget section and fixtures under tests/fixtures/bundles/); scripts/sanity-qa-runners/size.ts lines 1-20 (its own different table; it is wired to the contract in PRD budget-contract-wire, not here).

Keep the gate's name/status/details result shape unchanged. The fixture bundles are tiny, so set the over-budget case with a small slug-specific override or write a temp dir with incompressible random bytes.

Do not touch: server/db.ts, scripts/sanity-qa-runners/size.ts, mcp-host-server/src/server.ts, mcp-host-server/src/gates/a11y.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/publish-gate.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
