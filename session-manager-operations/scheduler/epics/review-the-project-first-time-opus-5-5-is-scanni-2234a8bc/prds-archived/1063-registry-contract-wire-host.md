---
title: Wire registry contract types into the host app and sanity-QA
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-04T08:55:51.399Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [registry-contract-schema]
planId: pl-mutl5nfc-6ec319
---
# Goal

wire: make the host app and the sanity-QA script use the registry contract types from mcp-host-server/src/contract/registry.ts (landed by PRD registry-contract-schema) instead of their own hand-copied types. tests/games-page.test.ts only snapshots registry contents and is replaced by tests/registry-contract.test.ts, so delete it.

# Acceptance criteria

- [ ] src/data/projectsRegistry.ts derives ProjectStatus and the static-path/external-url members of ProjectHost from the contract via `import type` only (no runtime zod import in the client bundle); the react-route member stays local
- [ ] The STANDALONE_PROJECTS cast in src/data/projectsRegistry.ts is typed as readonly RegistryProject[] from the contract
- [ ] scripts/sanity-qa.ts no longer declares its own inline registry entry type; it imports the type from the contract
- [ ] tests/games-page.test.ts is deleted
- [ ] pnpm typecheck and the sanity-qa and registry-contract tests pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectsRegistry.ts
- scripts/sanity-qa.ts
- tests/games-page.test.ts

# Implementation notes

Read the landed code first: mcp-host-server/src/contract/registry.ts (from PRD registry-contract-schema).
Read first: src/data/projectsRegistry.ts lines 25-80; scripts/sanity-qa.ts lines 25-45; tests/games-page.test.ts (to confirm it only checks registry contents).

Steps:
1. src/data/projectsRegistry.ts: `import type { ProjectStatus, RegistryProject } from '../../mcp-host-server/src/contract/registry.js';` Keep the exported Project interface and ProjectHost union so existing callers compile; build ProjectHost as `RegistryProject['host'] | { kind: 'react-route'; path: string }`. Use `.js` or `.ts` extension, whichever the current tsconfig (moduleResolution bundler, allowImportingTsExtensions) compiles cleanly.
2. scripts/sanity-qa.ts: replace the inline type at about lines 33-39 with the imported type.
3. git rm tests/games-page.test.ts.

Type-only imports are erased by Vite, so no zod ships to the browser. Verify with the typecheck in the gate.

Do not touch: mcp-host-server/src/server.ts, mcp-host-server/src/contract/registry.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm vitest run tests/registry-contract.test.ts tests/sanity-qa.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
