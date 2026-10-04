---
title: Validate: harden bilko.run publishing, tighten typing, prune dead code and low-value tests
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-04T08:59:59.860Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
tag: build
agentType: validator
dependsOn: [registry-contract-schema, registry-contract-wire-host, tool-entitlement-verified-email, repo-hygiene-dead-config, tool-entitlement-wire-a, tool-entitlement-wire-b, delete-low-value-tests, clerk-auth-real-tests, stripe-webhook-signature-test, mcp-publish-checkout, mcp-budget-contract, mcp-a11y-gate-serve-fix, budget-contract-wire, mcp-tool-input-contract, mcp-wire-publish-checkout, mcp-dist-rebuild-sync, ts-no-unused-flags, docs-host-contract-publish, claude-md-platform-rules]
planId: pl-mutl5nfc-6ec319
---
# Goal

validate the plan: 1062 registry-contract-schema; 1063 registry-contract-wire-host; 1064 tool-entitlement-verified-email; 1065 repo-hygiene-dead-config; 1066 tool-entitlement-wire-a; 1067 tool-entitlement-wire-b; 1068 delete-low-value-tests; 1069 clerk-auth-real-tests; 1070 stripe-webhook-signature-test; 1071 mcp-publish-checkout; 1072 mcp-budget-contract; 1073 mcp-a11y-gate-serve-fix; 1074 budget-contract-wire; 1075 mcp-tool-input-contract; 1076 mcp-wire-publish-checkout; 1077 mcp-dist-rebuild-sync; 1079 ts-no-unused-flags; 1080 docs-host-contract-publish; 1081 claude-md-platform-rules.

# Acceptance criteria

- [ ] registry-contract-schema verified (session-manager-operations/scheduler/epics/review-the-project-first-time-opus-5-5-is-scanni-2234a8bc/prds/1062-registry-contract-schema.md, or prds-archived/)
- [ ] registry-contract-wire-host verified (1063-registry-contract-wire-host.md)
- [ ] tool-entitlement-verified-email verified (1064-tool-entitlement-verified-email.md)
- [ ] repo-hygiene-dead-config verified (1065-repo-hygiene-dead-config.md)
- [ ] tool-entitlement-wire-a verified (1066-tool-entitlement-wire-a.md)
- [ ] tool-entitlement-wire-b verified (1067-tool-entitlement-wire-b.md)
- [ ] delete-low-value-tests verified (1068-delete-low-value-tests.md)
- [ ] clerk-auth-real-tests verified (1069-clerk-auth-real-tests.md)
- [ ] stripe-webhook-signature-test verified (1070-stripe-webhook-signature-test.md)
- [ ] mcp-publish-checkout verified (1071-mcp-publish-checkout.md)
- [ ] mcp-budget-contract verified (1072-mcp-budget-contract.md)
- [ ] mcp-a11y-gate-serve-fix verified (1073-mcp-a11y-gate-serve-fix.md)
- [ ] budget-contract-wire verified (1074-budget-contract-wire.md)
- [ ] mcp-tool-input-contract verified (1075-mcp-tool-input-contract.md)
- [ ] mcp-wire-publish-checkout verified (1076-mcp-wire-publish-checkout.md)
- [ ] mcp-dist-rebuild-sync verified (1077-mcp-dist-rebuild-sync.md)
- [ ] ts-no-unused-flags verified (1079-ts-no-unused-flags.md)
- [ ] docs-host-contract-publish verified (1080-docs-host-contract-publish.md)
- [ ] claude-md-platform-rules verified (1081-claude-md-platform-rules.md)
- [ ] Write and commit session-manager-operations/reviews/validation/review-the-project-first-time-opus-5-5-is-scanni-2234a8bc/validate-publish-hardening.md

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/review-the-project-first-time-opus-5-5-is-scanni-2234a8bc/validate-publish-hardening.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: a7248f41d713d243b1b98defccc60fcb7fc4ca62

Plan-level checks beyond each PRD's gate: (1) the full `pnpm vitest run` and `pnpm typecheck` are green on the final tree; (2) grep server/routes/tools/ for `body?.email` / `body.email` used in checkRateLimit or entitlement: there must be none; (3) mcp-host-server/src/server.ts has no `git commit`/`git push` against HOST_ROOT; (4) tests/mcp-dist-sync.test.ts passes, so dist matches src. 1078-ts-no-unused-strict was archived unrun on purpose (requeued as 1079 with corrected dependencies); do not report it.

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
