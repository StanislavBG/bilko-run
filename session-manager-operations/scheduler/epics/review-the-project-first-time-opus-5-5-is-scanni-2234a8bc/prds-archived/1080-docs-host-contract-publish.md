---
title: Host contract + MCP README: match the hardened publish pipeline, split host internals out
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-04T08:59:25.915Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [mcp-dist-rebuild-sync, budget-contract-wire]
planId: pl-mutl8g7n-73e51b
---
# Goal

doc: publishing agents read docs/host-contract.md (served by the MCP's get_host_contract tool) and mcp-host-server/README.md, and both currently contradict the code. docs/host-contract.md is 662 lines mixing what an app must do with host internals. This PRD makes the contract short, correct and app-facing, and moves host internals to a separate file.

# Acceptance criteria

- [ ] New docs/host-internals.md holds the sections moved verbatim from docs/host-contract.md: Synthetic monitoring, Sanity QA gate, Cost controls, Static-asset caching, Observability dashboard, Security headers; host-contract.md links to it in one line
- [ ] docs/host-contract.md states the publish rules as they are now implemented: slug format (2-40 chars [a-z0-9-], no leading/trailing hyphen); registry validated by mcp-host-server/src/contract/registry.ts; statuses live|cooking|postponed|archived; publishing commits from a dedicated clean checkout synced to origin/main and returns an error when the push fails; budget measured from real gzipped bytes using mcp-host-server/src/contract/app-budgets.ts; bypass needs a known gate name and a reason of at least 15 characters, and manifest cannot be bypassed; sourceRepoPath is required on every publish
- [ ] Stale statements are fixed: entries are added via standalone-projects.json / the MCP, not projectsRegistry.ts; the manual 'sync step'; 'no bulk bypass'; the audit gate 'exits 0' wording. The manifest schema reference names both shared/manifest-schema.ts and the MCP copy
- [ ] mcp-host-server/README.md shows the publish call with sourceRepoPath, documents BILKO_PUBLISH_CHECKOUT and the optional TURSO_DATABASE_URL/TURSO_AUTH_TOKEN env (without them the MCP's DB writes go to the local data/contentgrade.db), and warns about the one-publisher-per-slug rule
- [ ] After moving sections, docs/host-contract.md is under 400 lines

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/host-contract.md
- docs/host-internals.md
- mcp-host-server/README.md

# Implementation notes

Read the landed code first: mcp-host-server/src/server.ts (tool input schemas), mcp-host-server/src/publish-request.ts, mcp-host-server/src/publish-checkout.ts, mcp-host-server/src/contract/registry.ts, mcp-host-server/src/contract/app-budgets.ts. Every rule you write must match the code; if code and this PRD differ, document the code and note the difference in your report.
Read first: docs/host-contract.md (headings at lines 1, 7, 45, 129, 142, 153, 181, 221, 312, 337, 404, 472, 486, 509, 525, 579); mcp-host-server/README.md (71 lines).

Keep 'Game services', 'Telemetry contract' and 'Manifest contract' in host-contract.md: apps use them.

Do not touch: CLAUDE.md (PRD claude-md-platform-rules owns it).

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
