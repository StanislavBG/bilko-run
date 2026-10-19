---
title: AI-tool generate mode: stop returning raw error text from the shared generate helper
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-09T23:22:09.786Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [tool-gateway-helpers]
planId: pl-mv1kq7fd-a90b4e
---
# Goal

bug. `handleGenerateEndpoint` in server/routes/tools/_shared.ts (~lines 296-354) is used by the Headline, Ad and Thread 'generate' modes. On failure it still replies `{ error: \`Generation failed: ${err.message}\` }`, which leaks internal Gemini/parse error text to visitors. The tool-gateway-helpers PRD added `toolErrorReply` and `freeTierGate` for exactly this, but did not apply them inside handleGenerateEndpoint. Use them there.

# Acceptance criteria

- [ ] handleGenerateEndpoint's catch uses `toolErrorReply(reply, err, 'Generation')`, so the body is `{ error: 'Generation failed. Please try again.' }` and err.message is never returned.
- [ ] Its inline rate-limit + enforceCallLimits block is replaced by `freeTierGate(req, reply, { endpoint: opts.endpoint })` (keep the existing sign-in-required 401 check before it), with the same 429 body.
- [ ] tests/tool-gateway-helpers.test.ts adds a case: handleGenerateEndpoint with Gemini stubbed to throw `new Error('secret detail')` returns 500 and a body without 'secret detail'.
- [ ] tests/tool-entitlement.test.ts (handleGenerateEndpoint entitlement case) and tests/cost-controls.test.ts stay green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/_shared.ts
- tests/tool-gateway-helpers.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/routes/tools/_shared.ts (whole; freeTierGate ~210, toolErrorReply ~289, handleGenerateEndpoint ~296); tests/tool-gateway-helpers.test.ts (how Gemini is stubbed); tests/tool-entitlement.test.ts handleGenerateEndpoint case. Do not touch: any tool route file (wire PRDs own them).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/tool-gateway-helpers.test.ts tests/tool-entitlement.test.ts tests/cost-controls.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
