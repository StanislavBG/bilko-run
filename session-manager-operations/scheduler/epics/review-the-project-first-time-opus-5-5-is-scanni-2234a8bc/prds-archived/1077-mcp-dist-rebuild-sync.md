---
title: bilko-host MCP: rebuild committed dist/ and add a dist-in-sync test
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-04T08:58:50.113Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [mcp-wire-publish-checkout, mcp-budget-contract, mcp-a11y-gate-serve-fix]
planId: pl-mutl8g7n-73e51b
---
# Goal

build: sibling repos run the MCP from the committed mcp-host-server/dist/server.js (their .mcp.json points there), so src changes do nothing until dist/ is rebuilt and committed, and nothing checks that. This PRD rebuilds dist from the new src (contract, publish-checkout, publish-request, budget and a11y gates) and adds a test that fails whenever dist/ drifts from src/.

# Acceptance criteria

- [ ] mcp-host-server/dist/ is regenerated from mcp-host-server/src/ and committed, including dist/contract/registry.js, dist/contract/app-budgets.js, dist/publish-checkout.js and dist/publish-request.js; no stale dist file remains whose src counterpart was deleted
- [ ] New test tests/mcp-dist-sync.test.ts compiles mcp-host-server/src with the root `typescript` package API (program.emit to an in-memory or tmp outDir using mcp-host-server/tsconfig.json options, ignoring type diagnostics because the MCP SDK types may be absent) and asserts the emitted file set and every file's bytes equal mcp-host-server/dist
- [ ] `node mcp-host-server/dist/server.js` started with stdin closed exits or stays up without throwing an import or module-resolution error in its first 5 seconds (checked in the test via child_process.spawn with a 5 s kill; stderr must not contain ERR_MODULE_NOT_FOUND or SyntaxError). Skip only this case, with a logged reason, when mcp-host-server/node_modules/@modelcontextprotocol is absent

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/dist/
- tests/mcp-dist-sync.test.ts
- mcp-host-server/src/

# Implementation notes

Read first: mcp-host-server/tsconfig.json (rootDir src, outDir dist, NodeNext); mcp-host-server/package.json (build: tsc); .gitignore (dist/ of mcp-host-server is intentionally tracked).

Build with `pnpm --dir mcp-host-server exec tsc -p tsconfig.json`, or the root binary `pnpm exec tsc -p mcp-host-server/tsconfig.json` if the package has no node_modules. TS still emits when type errors come only from missing SDK types (noEmitOnError is off). Before building, delete mcp-host-server/dist/ so removed files disappear. If the build reports real type errors in our own code (not missing-module errors), fix them in the src file and name each fix in the report.

Do not touch: mcp-host-server/src/ beyond such minimal type fixes.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-dist-sync.test.ts tests/publish-gate.test.ts tests/mcp-publish-checkout.test.ts tests/mcp-publish-request.test.ts tests/mcp-a11y-server.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
