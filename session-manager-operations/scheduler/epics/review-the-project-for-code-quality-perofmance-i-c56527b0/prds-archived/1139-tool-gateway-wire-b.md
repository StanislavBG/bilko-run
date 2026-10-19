---
title: AI-tool gateways: adopt the shared helpers in email-forge and audience-decoder
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:11:59.997Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [tool-gateway-helpers]
planId: pl-mv1kq7fd-a90b4e
---
# Goal

wire. Same as the headline-grader wiring, but for server/routes/tools/email-forge.ts and audience-decoder.ts: adopt freeTierGate, askGeminiJson and toolErrorReply from _shared.ts (landed by tool-gateway-helpers; read it first). email-forge's own `parseSeq` (~line 227) should fold into the shared parse when the output shape allows. Compare routes count 3 calls.

# Acceptance criteria

- [ ] Both files use freeTierGate on every gated route (compare routes `calls: 3`), with no inline gate block left.
- [ ] No local JSON regex fallback remains unless the report explains why parseSeq's shape needs it.
- [ ] No reply body contains err.message.
- [ ] audience-decoder's one-time-purchase tier behavior is unchanged (its paid path is still honored).
- [ ] tests/tool-entitlement.test.ts and tests/cost-controls.test.ts green; new tests/tool-gateway-wire-b.test.ts asserts audience-decoder compare increments the ceiling by 3.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/email-forge.ts
- server/routes/tools/audience-decoder.ts
- tests/tool-gateway-wire-b.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/routes/tools/_shared.ts; server/routes/tools/email-forge.ts (whole); server/routes/tools/audience-decoder.ts (whole). Do not touch: _shared.ts, other tool files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/tool-gateway-wire-b.test.ts tests/tool-entitlement.test.ts tests/cost-controls.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
