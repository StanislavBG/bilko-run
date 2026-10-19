---
title: AI-tool gateways: adopt the shared helpers in headline-grader, ad-scorer and thread-grader
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:11:48.128Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [tool-gateway-helpers]
planId: pl-mv1kq7fd-a90b4e
---
# Goal

wire. Replace the copy-pasted free-tier gate, JSON-parse fallback and raw-error replies in server/routes/tools/headline-grader.ts, ad-scorer.ts and thread-grader.ts with freeTierGate, askGeminiJson and toolErrorReply from _shared.ts (landed by tool-gateway-helpers; read it first). Compare routes count their 3 Gemini calls (calls: 3). Each compare route repeats its scoring system prompt word for word; hoist it into one constant per file.

# Acceptance criteria

- [ ] Each of the three files uses freeTierGate for every gated route, with `calls: 3` on compare routes, and has no inline hashIp/checkRateLimit/enforceCallLimits gate block left.
- [ ] JSON parsing goes through askGeminiJson (or the shared parse), and no file keeps its own `raw.match(/\{[\s\S]*\}/)` fallback.
- [ ] No reply body contains err.message; failures use toolErrorReply.
- [ ] Each file's duplicated scoring prompt is a single const used by both the score and compare routes; the prompt text is unchanged.
- [ ] Response shapes for success, 429 and ceiling errors are unchanged: tests/tool-entitlement.test.ts and tests/cost-controls.test.ts are green, and a new test in tests/tool-gateway-wire.test.ts asserts headline-grader compare increments the ceiling count by 3.
- [ ] Report the line count of the three files before and after.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/headline-grader.ts
- server/routes/tools/ad-scorer.ts
- server/routes/tools/thread-grader.ts
- tests/tool-gateway-wire.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/routes/tools/_shared.ts (new helpers); server/routes/tools/headline-grader.ts (whole); tests/tool-entitlement.test.ts. Do not touch: _shared.ts, other tool files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/tool-gateway-wire.test.ts tests/tool-entitlement.test.ts tests/cost-controls.test.ts tests/tool-gateway-helpers.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
