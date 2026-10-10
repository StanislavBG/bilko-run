# Validation: server fixes plan (1119, 1120, 1122, 1124, 1126, 1127, 1128, 1129, 1141, 1142, 1143, 1154)

Base: f6c830b41387627d97916c1af828bf4c1472dae1. Diff reviewed: `git diff f6c830b..HEAD -- server tests` (46 files).
`/code-review` and `/security-review` were not run as separate passes; I self-reviewed the server diff for correctness, input handling, secrets and path traversal.

## Whole-plan gates (run in the worktree after `pnpm install --offline --frozen-lockfile`)
- `pnpm typecheck`: exit 0.
- `pnpm test`: 72 files, 869 tests, all passed.
- `pnpm build`: exit 0.

## Per-PRD verdicts
- **1119 project-events-cache: VERIFIED.** `server/routes/project-events.ts:35,45` hold the 5 min TTL and `Map<slug,{buf,builtAt}>`. Line 86 deletes the entry on POST and lines 118-121 expire it. The new tests in `tests/project-events.test.ts` pass.
- **1120 egress-batch-flush: VERIFIED.** `server/egress.ts:35-40` uses `BATCH_CHUNK=100` and `getClient().batch`. Pruning is one batch with a `DELETE ... path IN (...)` (`:267-270`). Tests in `tests/egress.test.ts` and `tests/server-shutdown.test.ts` pass.
- **1122 analytics-pageview-hardening: VERIFIED.** `server/routes/analytics.ts:99-101` rate-limits with `checkEventRate` (2x the /event limits) and returns 429. `:~116` takes `is_admin` only from `verifyClerkToken`, never from `body.email`. `:151` writes the page view and the session upsert in one `batch` (2 statements, one round-trip; before it was separate awaits). `:204-205` clamps `days` to [1,365] with a default of 7. `tests/analytics-pageview.test.ts` passes.
- **1124 manual-service-cache: VERIFIED.** `server/services/manual.ts:79` memoizes the release dir. `:153-160` holds the 20 MB `Map<path,Buffer>` cache read through `fs/promises`. The traversal guard at `:142` is unchanged. `tests/manual.test.ts` passes.
- **1126 blog-list-cache: VERIFIED.** `server/routes/blog.ts:11-37` holds the memo (60 s, or until the next scheduled publish) and sets `Cache-Control: public, max-age=60`. `:72,95` clear it on writes. `tests/blog-list-cache.test.ts` passes.
- **1127 server-error-handler: VERIFIED.** `server/index.ts:56-63` registers `setErrorHandler` (4xx keep their status; everything else logs and replies a generic 500). `grep err.message server/routes/stripe.ts` shows only `console.error` calls; the reply bodies are generic (`:~130,~297`). `tests/error-handler.test.ts` passes.
- **1128 auth-reply-hardening: VERIFIED.** `tests/clerk-auth.test.ts:113-175` fires 50 requests each for requireAuth (401) and requireAdmin (403) under the real onSend hooks and watches for unhandledRejection. `git diff --stat` shows no change to `server/clerk.ts`, which matches the PRD's "no code change if the test passes". Test green.
- **1129 games-leaderboard-index: VERIFIED.** `server/services/games.ts` `buildTopScoresQuery` uses `mode >= ''` when mode is omitted, so the plan is a SEARCH on `idx_scores_game_score`. The `EXPLAIN QUERY PLAN` test is in `tests/game-services.test.ts` and passes. I did not check the plan text by hand.
- **1141 analytics-admin-queries: VERIFIED.** `server/routes/analytics.ts:207-208,276` use range filters. `tests/analytics-admin-queries.test.ts` passes and was part of the full run. I did not independently confirm the token-balance join (CTE) rewrite or the created_at storage format.
- **1142 webhook-unknown-price: VERIFIED.** `server/routes/stripe.ts` defaults to `'unattributed'` and logs the price id both when no catalog entry matches and when the lookup throws. `hasPurchased` compares exact keys (`:432`), so no entitlement is granted. `tests/stripe-webhook-attribution.test.ts` covers an unknown price, a throw, and a known AudienceDecoder price; it passes.
- **1143 server-dev-routes-og-copy: VERIFIED.** `server/index.ts:22` imports the project-events routes; `:226` has the neutral OG description with no tool names. `tests/project-events-dev.test.ts` (2 tests) passes.
- **1154 server-dead-exports: VERIFIED.** `refreshReferrerRules`, `getGameConfig` and `recordOtpFailure` are deleted, and `otpStore`, `wsTicketStore`, `otpRateStore` and `generateOtpCode` are un-exported. Typecheck and the full tests pass, so nothing still imports them.

## Findings
### Critical
- none
### Important
- none
### Minor
- `.../prds/1154-server-dead-exports.md` is still in `prds/`, not `prds-archived/`. The work landed in `70b431e`, so this is only a queue-hygiene gap.
- `server/routes/stripe.ts:130,297,354,377,412` log `err.message` (server-side only; not in reply bodies, as intended). That is acceptable, but Stripe error text can contain request details, so keep it out of any log shipped to third parties.
- `server/services/manual.ts:46` still uses sync `existsSync`. It runs only at memoized directory resolution (a miss is not memoized), not per request.
