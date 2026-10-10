# Validation: tool-gateway plan (1118, 1138, 1139, 1140)

Base: f6c830b41387627d97916c1af828bf4c1472dae1. HEAD checked: a49b74b.
Whole-plan gates (re-run in this worktree): `pnpm typecheck` exit 0; `pnpm test` 72 files / 872 tests passed; `pnpm build` built OK.
Commits: 3951a2f (1118), 242b032 + 8d9ab48 (1138/1139), 8299bea (1140), f8b2c50 (follow-up in _shared.ts).

## 1118-tool-gateway-helpers — VERIFIED
- `freeTierGate` server/routes/tools/_shared.ts:210, `calls ?? 1` passed to enforceCallLimits (:230).
- `creditGate` :243 — requireAuth, enforceCallLimits, token account grant, subscription, 402 balance check (:244-270). It takes an extra `endpoint` option, which the PRD signature does not list. Needed to name the app slug.
- `enforceCallLimits(ctx, calls = 1)` :156, increments by `calls` (:165-169). Ceiling lookup memoized, TTL hook at :133-140.
- `askGeminiJson` :274 (JSON.parse, then first-`{...}` fallback via parseResult). `toolErrorReply` :289 logs and replies a generic 500, never err.message.
- Dead `_what` param is gone: `freeGateMsg(_legacyContext?)` :24, still present but renamed. Not a blocker.
- tests/tool-gateway-helpers.test.ts exists. Full suite green.

## 1138-tool-gateway-wire-a — VERIFIED
- headline-grader.ts:99/209, ad-scorer.ts:118/197, thread-grader.ts:101/180 use freeTierGate, with `calls: 3` on the compare routes. The remaining `hashIp` at headline-grader.ts:71 is the /unlock route, which is not a gated route.
- All parsing goes through askGeminiJson. Every error path uses toolErrorReply. grep of server/routes/tools for `err.message` finds only the doc comment.
- Compare routes call `COMPARE_SCORING_SYSTEM_PROMPT` and `COMPARE_VERDICT_SYSTEM_PROMPT` as shared consts.
- tests/tool-gateway-wire.test.ts:62 asserts the compare ceiling +3, :73 asserts single +1, :83 asserts a generic 500.
- Line counts: after = 306 + 254 + 238 = 798. Before = 359 + 308 + 293 = 960.

## 1139-tool-gateway-wire-b — VERIFIED
- email-forge.ts:36/140 use freeTierGate (compare `calls: 3`).
- audience-decoder.ts keeps a local gate helper (:14-27). It is justified: it passes `PRODUCT_KEYS.AUDIENCEDECODER_REPORT` to checkRateLimit, and freeTierGate has no productKey option. The comment at :10 says so. The paid path is preserved and covered by tests/tool-gateway-wire-b.test.ts:81.
- JSON parsing goes through askGeminiJson. No err.message in replies.
- tests/tool-gateway-wire-b.test.ts:53 asserts the compare ceiling +3.

## 1140-tool-gateway-wire-credit — VERIFIED (money path)
- stack-audit.ts:14/74-80, launch-grader.ts:18/84-90, page-roast.ts:54/60-65 and :100/106-111 all use creditGate.
- `deductToken` runs before Gemini. On `!success` the route replies 402 and returns before any Gemini call.
- On a Gemini throw after deduction, `refundTokens(email, amount, reason)` runs (server/services/tokens.ts:56). It is an existing function. It credits token_balances and inserts a ledger row in one parameterized transaction. It runs only when `!isPro`, which is correct because Pro users are not charged. page-roast compare refunds 2 credits (:121).
- A refund failure is logged and does not mask the 500.
- `/api/roasts/stats` is memoized (page-roast.ts:12-18, STATS_TTL_MS).
- tests/tool-credit-deduct.test.ts:86 (402 means no Gemini call) and :120 (refund and no leaked error text) are green.

## Findings
### Critical
- none
### Important
- none
### Minor
- `toolErrorReply` interpolates the internal label into user-facing text (_shared.ts:293). Callers pass snake_case labels such as `stack_audit`, `email_forge_compare`, so visitors see "stack_audit failed. Please try again.". Use human labels, or add a separate display string.
- `freeGateMsg(_legacyContext?)` (_shared.ts:24) still carries an unused parameter.
- `creditGate` adds an `endpoint` option beyond the PRD signature (harmless, documented here).
- handleGenerateEndpoint's 429 path (follow-up f8b2c50) has no direct test, per that commit's own report.
- Self-review of the diff: no secrets, SQL is parameterized, no path handling. /code-review and /security-review were not run as separate tools; I reviewed the code by hand.
