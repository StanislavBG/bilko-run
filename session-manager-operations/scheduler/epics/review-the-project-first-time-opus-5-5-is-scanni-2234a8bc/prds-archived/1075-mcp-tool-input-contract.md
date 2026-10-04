---
title: bilko-host MCP: strict tool inputs (slug contract, validated registry, bypass rules)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-04T08:58:22.201Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [registry-contract-schema]
planId: pl-mutl5nfc-6ec319
---
# Goal

behavior: the MCP tools accept any non-empty slug. A slug like 'OutdoorHours' registers fine and then every publish fails the manifest gate, and '../x' with rm -rf can delete outside public/projects. The registry JSON is read and written with a bare cast. `bypassReason` is described as required but is not enforced, a typo'd gate name is silently ignored, and the manifest gate itself can be bypassed. This PRD moves input rules into a small pure module with tests and makes server.ts use it plus the registry contract (landed by PRD registry-contract-schema).

# Acceptance criteria

- [ ] New file mcp-host-server/src/publish-request.ts exports `projectDir(publicProjectsRoot: string, slug: string): string`, which validates with SlugSchema and throws unless the resolved path is inside the root; `parseBypass(bypass: string | undefined, reason: string | undefined): { gates: Set<GateName> } | { error: string }`, which rejects unknown gate names, rejects 'manifest', and requires a reason of at least 15 chars when any gate is bypassed; and `parseRegistry(raw: string)`, which returns RegistrySchema-validated data or throws an error naming the bad slug and field
- [ ] mcp-host-server/src/server.ts: every `slug` tool input uses SlugSchema; register's `status` input uses ProjectStatusSchema (adds 'postponed'); the local Project/StaticHost/ExternalHost interfaces are deleted in favor of the contract types
- [ ] server.ts readRegistry uses parseRegistry, and writeRegistry validates with RegistrySchema before writing (an invalid result is never written)
- [ ] server.ts publish/unregister compute target dirs only via projectDir, and publish returns an isError result from parseBypass errors before running any gate
- [ ] New test tests/mcp-publish-request.test.ts covers projectDir traversal and bad-case slugs, every parseBypass rule, and parseRegistry on the real src/data/standalone-projects.json plus one malformed entry

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/publish-request.ts
- mcp-host-server/src/server.ts
- tests/mcp-publish-request.test.ts

# Implementation notes

Read the landed code first: mcp-host-server/src/contract/registry.ts (SlugSchema, ProjectStatusSchema, RegistrySchema, RegistryProject).
Read first: mcp-host-server/src/server.ts lines 83-115 (types, readRegistry, writeRegistry), 209-260 (register), 267-310 (unregister), 313-420 (publish: bypass parsing around line 349, rm/cp around 392); mcp-host-server/src/gates/index.ts (gate names: manifest, budget, golden, a11y, audit).

GateName = 'budget' | 'golden' | 'a11y' | 'audit' (export it from publish-request.ts). publish-request.ts must not import the MCP SDK, so the test can import it from root vitest. Keep the existing git and commit behavior in server.ts unchanged here; PRD mcp-wire-publish-checkout replaces it next. Use `.js` import suffixes (NodeNext).

Do not touch: mcp-host-server/src/publish-checkout.ts, mcp-host-server/src/gates/, mcp-host-server/dist/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-publish-request.test.ts tests/registry-contract.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
