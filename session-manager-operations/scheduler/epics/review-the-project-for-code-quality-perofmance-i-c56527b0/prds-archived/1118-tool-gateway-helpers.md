---
title: AI-tool gateways: one shared helper for the free-tier gate, credit gate, Gemini JSON call and error reply
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:05:43.705Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kq7fd-a90b4e
---
# Goal

primitive. server/routes/tools/*.ts (~2,200 lines) repeats the same blocks. A ~16-line free-tier gate (hashIp → entitlementEmail → checkRateLimit → 429 → enforceCallLimits) appears 10 times. A ~15-line credit gate appears 4 times. A JSON.parse-with-regex fallback appears 9 times. A `500 ${err.message}` reply appears 15 times. Compare routes make 3 Gemini calls but count 1 against the spend ceiling. Add the shared helpers to server/routes/tools/_shared.ts with tests; later PRDs adopt them.

# Acceptance criteria

- [ ] _shared.ts exports `freeTierGate(req, reply, opts: { endpoint: string; calls?: number }): Promise<{ ipHash: string; email?: string } | null>`. It reproduces the existing gate exactly: the same 429 body and the same enforceCallLimits error reply. It returns null after replying, and passes `calls` (default 1) to enforceCallLimits.
- [ ] _shared.ts exports `creditGate(req, reply, opts: { cost: number; calls?: number })`, reproducing the existing requireAuth → enforceCallLimits → token-account → subscription → balance 402 sequence from stack-audit.ts.
- [ ] `enforceCallLimits` accepts a `calls` count (default 1) and counts that many calls against the daily ceiling. The ceiling row lookup is memoized for 60 s.
- [ ] _shared.ts exports `askGeminiJson<T>(prompt, opts)` and `toolErrorReply(reply, err, label)`. The first wraps the existing Gemini client and parseResult/regex fallback. The second logs the error server-side and replies 500 `{ error: '<label> failed. Please try again.' }`, never err.message.
- [ ] Dead bits are removed: the ignored `_what` parameter of freeGateMsg (callers updated only in _shared.ts) and the unused `bodyEmail` option. checkRateLimitForRequest is kept only if tests use it.
- [ ] New tests/tool-gateway-helpers.test.ts covers each helper: 429 path, ceiling path with calls:3, 402 path, Gemini JSON fallback parsing, and a generic 500 body. tests/tool-entitlement.test.ts and tests/cost-controls.test.ts stay green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/_shared.ts
- tests/tool-gateway-helpers.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko.

Read first: server/routes/tools/_shared.ts (whole, 236 lines); server/routes/tools/headline-grader.ts lines 40-70 and 150-200 (free gate + parse fallback); server/routes/tools/stack-audit.ts lines 15-40 (credit gate); server/gemini.ts.

Do not touch: any tool route file (wire PRDs adopt the helpers).

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
