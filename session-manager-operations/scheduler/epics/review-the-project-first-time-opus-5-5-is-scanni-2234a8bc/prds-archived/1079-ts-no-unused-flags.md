---
title: Enable noUnusedLocals/noUnusedParameters and remove the dead symbols
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-04T08:59:14.025Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [tool-entitlement-wire-a, tool-entitlement-wire-b, repo-hygiene-dead-config, registry-contract-wire-host, budget-contract-wire, clerk-auth-real-tests, stripe-webhook-signature-test]
planId: pl-mutl5nfc-6ec319
---
# Goal

migration: tighten the compiler so dead code fails the typecheck instead of piling up. Turn on noUnusedLocals and noUnusedParameters in tsconfig.json (client) and tsconfig.server.json (server), and delete each unused symbol they flag.

# Acceptance criteria

- [ ] tsconfig.json sets noUnusedLocals: true and noUnusedParameters: true
- [ ] tsconfig.server.json sets noUnusedLocals: true and noUnusedParameters: true
- [ ] Every resulting error is fixed by deleting the unused import, local or parameter (prefix a required-but-unused callback parameter with `_`); no `// @ts-ignore` or eslint-disable is added
- [ ] `pnpm typecheck` (which now covers client and server) passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- tsconfig.json
- tsconfig.server.json
- server/
- src/

# Implementation notes

Known hits at planning time (others may appear after sibling PRDs land): server/services/tokens.ts:1 (`dbRun` import), src/components/Layout.tsx:29 (`navigate`), src/pages/AdminCostPage.tsx:4 (`ADMIN_EMAILS`), src/pages/AdminPage.tsx:104 (`label`).

Steps: flip both flags, run `pnpm exec tsc --noEmit` and `pnpm exec tsc -p tsconfig.server.json --noEmit`, and fix every error by deletion. If an "unused" symbol looks like an intentional export or a side-effect import, keep it and use the narrowest fix.

Do not touch: mcp-host-server/ (its own tsconfig is out of scope).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
