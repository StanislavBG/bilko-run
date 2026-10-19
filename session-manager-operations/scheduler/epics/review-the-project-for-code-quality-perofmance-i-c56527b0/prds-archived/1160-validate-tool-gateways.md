---
title: Validate: AI-tool gateways share one metered helper (correct spend counts, pay-before-work, no leaked errors)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: validator
createdVia: scheduler-api
issuedAt: 2026-10-09T23:17:43.723Z
dependsOn: [tool-gateway-helpers, tool-gateway-wire-a, tool-gateway-wire-b, tool-gateway-wire-credit, tool-generate-error-reply]
planId: pl-mv1kq7fd-a90b4e
---
# Goal

validate. Plan: 1118 tool-gateway-helpers; 1138 tool-gateway-wire-a; 1139 tool-gateway-wire-b; 1140 tool-gateway-wire-credit.

# Acceptance criteria

- [ ] 1118-tool-gateway-helpers verified against its PRD in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/review-the-project-for-code-quality-perofmance-i-c56527b0/prds/ or prds-archived/ (find by slug).
- [ ] 1138-tool-gateway-wire-a verified.
- [ ] 1139-tool-gateway-wire-b verified.
- [ ] 1140-tool-gateway-wire-credit verified (money path: deduct before Gemini, refund on failure).
- [ ] Whole plan: `pnpm typecheck`, `pnpm test`, `pnpm build` green; write and commit session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-tool-gateways.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-tool-gateways.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: f6c830b41387627d97916c1af828bf4c1472dae1

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
