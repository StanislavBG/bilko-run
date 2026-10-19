---
title: /projects listing driven by the registry: use `public` and `displayName` instead of hardcoded lists
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:15:03.062Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [registry-public-fields-schema, frontend-dead-exports]
planId: pl-mv1kvo89-1ff19a
---
# Goal

wire. src/data/projectsView.ts hardcodes PUBLIC_SLUGS (~98-108) and DISPLAY_NAME (~112-115), so making a project public means editing code as well as the registry. With the optional `public`/`displayName` registry fields (landed by registry-public-fields-schema), set those fields in src/data/standalone-projects.json for exactly today's public slugs and display-name overrides, and make projectsView.ts read them.

# Acceptance criteria

- [ ] standalone-projects.json: every slug currently in PUBLIC_SLUGS gets `"public": true`, and every DISPLAY_NAME override becomes `"displayName"`; no other field changes. The file still validates against the registry contract (tests/registry-contract.test.ts green).
- [ ] projectsView.ts derives the public set and display names from those fields; PUBLIC_SLUGS and DISPLAY_NAME constants are removed.
- [ ] The rendered /projects list is identical: a test (new tests/projects-view.test.ts, node environment, calling the projectsView builder) asserts the same slugs in the same order and the same names as a list captured from the pre-change code in the test file.
- [ ] The projectsRegistry.ts header 'where to edit what' note says public/displayName live in the registry; `pnpm build` passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectsView.ts
- src/data/standalone-projects.json
- src/data/projectsRegistry.ts
- tests/projects-view.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Before editing, compute and paste the current public slug order and names into the new test as the expected value. Read first: src/data/projectsView.ts (whole); src/data/projectsRegistry.ts header; mcp-host-server/src/contract/registry.ts. Do not touch: mcp-host-server/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/projects-view.test.ts tests/registry-contract.test.ts
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
