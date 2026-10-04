---
title: CLAUDE.md: clear platform-separation, publishing and test-value rules; real test numbers
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-04T08:59:40.355Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [docs-host-contract-publish, delete-low-value-tests, ts-no-unused-flags, tool-entitlement-wire-a, tool-entitlement-wire-b]
planId: pl-mutl69dx-97c017
---
# Goal

doc: CLAUDE.md is what every agent working in this repo reads first. Its Testing section is wrong ('27 tests across 4 files'; the real count is about 48 files and 640 tests). It has no rule for when host code may know about one specific app, and no rule for what makes a test worth keeping. This PRD writes those rules down so future agents stop re-adding coupling and low-value tests.

# Acceptance criteria

- [ ] CLAUDE.md Testing section gives the real file and test counts (count them with `pnpm vitest run` at execution time) and the commands `pnpm test`, `pnpm typecheck` (client + server), `pnpm test:e2e`
- [ ] CLAUDE.md has a 'What a test must guard' rule: tests exercise host behavior (security, money, auth, the publish contract, routing). No tests that grep prose or skill files, snapshot registry/generated data, test a sibling app's UI (that belongs in the sibling's golden spec), or call production bilko.run from vitest
- [ ] CLAUDE.md has a 'Sanctioned app-specific host code' list naming each exception: AI-tool gateway routes (server/routes/tools/), Session Manager (server/sm-relay/, routes/sm-relay.ts, routes/manual.ts, routes/admin-session-manager-usage.ts, src/pages/session-manager-landing/), Academy gateway (routes/academy.ts, services/academy-quota.ts), social-signals-trader coffee checkout in routes/stripe.ts, game config in shared/game-config.ts. The rule: any new app-specific host code must be added to this list in the same commit, or live in the sibling
- [ ] CLAUDE.md publishing rules point to docs/host-contract.md and state: the registry is schema-validated (mcp-host-server/src/contract/registry.ts); mcp-host-server/dist/ must be rebuilt and committed with any src change (tests/mcp-dist-sync.test.ts enforces it); paid-tier entitlement only ever comes from the verified Clerk token, never the request body
- [ ] Stale lines are removed or corrected: the Shared Hooks list must not mention useOgMeta if that file was deleted; Blog says posts are seeded in server/db.ts without a fixed '4 posts' count

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- CLAUDE.md

# Implementation notes

Read first: CLAUDE.md (whole file); docs/host-contract.md (as updated by PRD docs-host-contract-publish); `ls tests/` and `ls src/hooks/` to confirm what exists now.

Keep CLAUDE.md's existing structure and voice. Edit sections in place rather than appending a new essay, and keep the total length roughly the same or shorter. Verify every path you name exists with ls before writing it.

Do not touch: docs/host-contract.md, ~/.claude/CLAUDE.md, anything outside CLAUDE.md.

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
