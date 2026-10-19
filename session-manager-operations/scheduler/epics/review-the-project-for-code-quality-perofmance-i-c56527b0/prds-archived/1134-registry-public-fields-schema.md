---
title: Registry contract: optional `public` and `displayName` fields so one entry controls a project's listing
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:10:04.482Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kvsn6-8a8beb
---
# Goal

primitive. Making a project public on /projects today means editing hardcoded lists in src/data/projectsView.ts (PUBLIC_SLUGS ~98-108, DISPLAY_NAME ~112-115) as well as the registry. A non-developer can't tell where to change things. Add optional `public: boolean` and `displayName: string` fields to the registry contract schema so a later PRD can drive the listing from the registry alone.

# Acceptance criteria

- [ ] mcp-host-server/src/contract/registry.ts: the entry schema accepts optional `public` (boolean) and `displayName` (non-empty string, at most 60 chars); existing entries without them still validate.
- [ ] mcp-host-server/dist/ is rebuilt with the package build script so tests/mcp-dist-sync.test.ts passes.
- [ ] tests/registry-contract.test.ts adds cases: entry with public:true and displayName validates; displayName '' fails; entry without both validates.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/contract/registry.ts
- mcp-host-server/dist/
- tests/registry-contract.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: mcp-host-server/src/contract/registry.ts; tests/registry-contract.test.ts; mcp-host-server/package.json (build = tsc). Do not touch: src/data/standalone-projects.json, src/data/projectsView.ts, mcp-host-server/src/server.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/registry-contract.test.ts tests/mcp-dist-sync.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
