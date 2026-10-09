# Validation: ContentGrade retirement (1101–1104)

Base: `cb9feb41391c924d483d68e111febc9806a02683`. PRD files were found in the epic's `prds-archived/`.
Commits in range for these PRDs: be527e0 (1101), f5f1574 (1102), a172231 (1103), f3c217a (1104).
Whole-range diff also holds unrelated blog-video commits; not part of this plan.

## 1101-stripe-retire-contentgrade-pro — VERIFIED
- `my-license` / `license-key` / `validate-license` routes: none in `server/routes/stripe.ts` (grep empty); no `services/license` import.
- `server/routes/stripe.ts:375` `/upgrade` replies `reply.redirect('/', 302)`; no `PAYMENT_LINK_CONTENTGRADE_PRO` or buy.stripe.com link in code.
- `stripe.ts:71-75` no default priceType; missing or unknown → 400 "Valid priceType required." `shared/product-catalog.ts` diff removes all three contentgrade_* keys, union members and catalog rows.
- `stripe.ts:327-331` subscription sessions and unresolved prices show generic page and `console.error`; webhook `saveSubscription` path retained.
- `stripe.ts:424` `plan: active ? 'pro' : null`; `services/stripe.ts:14-16` `isStripeConfigured()` returns `!!stripeKey`.
- Tests at `tests/stripe-checkout-success.test.ts:151,180,206,214,222,230` cover the PRD cases. Full suite green.

## 1102-blog-scrub-contentgrade-mentions — VERIFIED
- Seed text for both posts changed (diff of `server/db.ts` at ~1668 and ~1810), new wording as specified.
- `server/db.ts:3077-3099` `applyDataMigrationOnce('2026-10-09-blog-drop-content-grade', …)` uses parameterized `UPDATE … replace(content, ?, ?) … WHERE slug = ?`, placed after existing fixups and before `applyBlogRewrites`.
- `tests/blog-contentgrade-scrub.test.ts` exists and passes in the full run.

## 1103-delete-contentgrade-license-code — VERIFIED
- `ls server/routes/license.ts server/services/license.ts` → both missing; `git grep license -- server/index.ts` → empty.
- `git grep -n -e services/license -e routes/license -e upsertLicenseKey -e validateLicenseKey -e getLicenseKeysForEmail -- server shared src tests` → no output (rc=1).
- `license_keys` table intact at `server/db.ts:128-140`.
- `pnpm typecheck` and `pnpm test` green (below).

## 1104-contentgrade-docs-license-env — VERIFIED
- `LICENSE:3` = `Copyright (c) 2026 Bilko`.
- `.env.example:40-42` legacy heading with only `STRIPE_PRICE_CONTENTGRADE_BUSINESS` / `_TEAM` (read by `server/services/stripe.ts:77-78`); the PAYMENT_LINK var is gone.
- `CLAUDE.md:138` has the retirement line; `content-grade` remote guardrails at lines 5, 100, 156 untouched.

## Whole-plan checks
- `pnpm typecheck` exit 0; `pnpm test` 59 files / 794 tests pass; `pnpm build` exit 0. (Ran `pnpm install --frozen-lockfile --offline` first: the worktree had no node_modules.)
- `git grep -n -i -E 'content.?grade|CG-' -- server shared src LICENSE .env.example` leftovers:
  - Allowed: `services/stripe.ts:77-78` legacy env names, `.env.example:25,41,42`, `db.ts:19` `contentgrade.db`, `db.ts:133` column default.
  - Not on the allowed list but intended: `server/db.ts:3077-3092` (the migration's old-text strings and name must contain the text they remove) and `server/routes/stripe.ts:327` (a comment).

## Findings
### Critical
- none
### Important
- none
### Minor
- `server/db.ts:3077-3092`: the retirement migration necessarily contains the old `content-grade` / `Content-Grade` sentences, so the whole-plan grep is not strictly clean. Accepted; the allowed list should include it.
- `server/routes/stripe.ts:327`: comment names "legacy ContentGrade"; fine as legacy-subscriber documentation.
- Untracked stray file literally named `<path>` in the worktree root (not from this plan); not touched.
- Self-review only (no separate /code-review run): no secrets, all SQL parameterized, no new input handling beyond the 400 on priceType.
