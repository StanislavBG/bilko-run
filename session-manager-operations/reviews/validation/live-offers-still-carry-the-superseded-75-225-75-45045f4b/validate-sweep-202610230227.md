# Validation sweep — live-offers-still-carry-the-superseded-75-225-75-45045f4b

Base: dd114df47a1d12ffff73b588a8bbcb099ae30365 (HEAD 2b31cd9f). Diff: 29 files, +1504/-189.
Gates re-run in the foreground: `CI=1 pnpm test` → 153 files passed, 2 skipped; 1686 tests passed, 11 skipped. `pnpm typecheck` → exit 0. These cover every PRD's gate (each PRD's gate is a subset of the full suite plus typecheck).
Review tooling: /code-review and /security-review were not run as separate steps; I self-reviewed the diff.

## wallet-ledger — VERIFIED
- Commit 9e09ddac. server/db-schema.ts +34 lines (wallet_balances, wallet_transactions, menu_orders).
- server/services/wallet.ts: exports getWalletCents, creditWallet, debitWallet, refundWallet. `normEmail` trims and lowercases; `checkCents` throws RangeError unless cents is a positive safe integer <= 100000.
- The ref-exists check inside the transaction returns `credited:false`. debitWallet uses one `UPDATE ... AND balance_cents >= ?` and writes a negative-amount transaction only on success.
- tests/wallet.test.ts passes (full suite).

## ppp-bonus-table — VERIFIED
- shared/ppp-bonus.ts exports the table, pppBonusPercent and pppBonusCents. tests/ppp-bonus.test.ts passes, 14 tests.
- I did not check the module's imports for purity beyond reading the header.

## bilko-menu-catalog — VERIFIED
- shared/bilko-menu.ts:4-6 has the constants WALLET_TOPUP_CENTS, MENU_PRICE_CEILING_CENTS and MENU_DAILY_ASYNC_CAP. Item prices at lines 38-99 are 50/100/100/200/300/300/900.
- CLAUDE.md gains the "Bilko services menu" bullet in the sanctioned-code list. tests/bilko-menu.test.ts passes.

## web-product-inline-price — VERIFIED
- shared/web-products.ts:36-38 and 205-208: amountCents, plus the displayPrice mismatch check in validateWebProducts.
- server/routes/web-products.ts: price_data is built from amountCents for one-time products, and monthly products keep `price: priceId`. The 503 now fires only for monthly products with no price id. resolvePaidOrder matches on amount_subtotal.
- server/routes/stripe.ts: the one-time web-product branch compares amount_subtotal, and the monthly branch keeps the price-id check.
- The three named test files pass.
- The ladder values in the PRD (hfh-*, kit 1900) were intentionally superseded by retire-ladder-kit-3.

## retire-ladder-kit-3 — VERIFIED
- A grep of shared/ and server/ for hfh finds only `HFH_MEETING_LINK` env reads in server/routes/service-bookings.ts. There are no hfh product or offer entries.
- agent-factory-kit has amountCents 300 and displayPrice '$3' (shared/web-products.ts:89-90). validateWebProducts is covered by the catalog test.
- Full suite passes. tests/service-booking-routes.test.ts exists in the tree.

## wallet-topup-routes — VERIFIED
- server/routes/wallet.ts: GET /api/wallet uses walletAuthEmail (a bkk_ key or Clerk), sets Cache-Control private, no-store, and returns balanceCents and balance.
- POST /api/wallet/topup: Clerk only, a 10-per-minute per-IP limiter, 400 for cents outside WALLET_TOPUP_CENTS, 503 when Stripe is unconfigured, and a Checkout built exactly per the criteria.
- server/index.ts:190 calls registerWalletRoutes(app). tests/wallet-routes.test.ts passes.

## wallet-topup-webhook — VERIFIED
- server/routes/stripe.ts:213-240: the wallet_topup branch runs first as an if/else-if chain, so it never falls through. It requires paid, cents in WALLET_TOPUP_CENTS, a matching subtotal and an email.
- It retrieves the PaymentIntent with expand latest_charge, falls back to customer_details.address.country, and credits `topup:<id>` and `ppp:<id>`. A Stripe API failure throws to the outer catch (500).
- The success page (lines 437-520) mints a key once ("already shown" text) with label 'Bilko Credits'.
- tests/stripe-webhook-wallet.test.ts passes.

## menu-order-service — VERIFIED
- server/services/menu-orders.ts placeMenuOrder: live items return live_needs_slot, intake goes through parseMenuIntake, the async daily cap is checked before the debit, and a failed insert triggers refundWallet.
- Download items call recordOrder with `wallet_<ref>` and get status delivered. The transition helpers enforce legal state changes. refundOrder uses ref `refund:<ref>`, which is idempotent.
- tests/menu-orders.test.ts passes.

## wallet-funds-tool-calls — VERIFIED
- server/services/tokens.ts: tokens are tried first. When they are short, it falls back to debitWallet(cost*100, 'tool:'+uuid) and returns `source`. refundTokens is unchanged and a comment says so.
- server/routes/tools/_shared.ts: creditGate returns 402 only when the token balance < cost and the wallet balance < cost*100.
- tests/tokens-wallet-fallback.test.ts and tests/tokens.test.ts pass.

## Findings
- Critical: none.
- Important: none.
- Minor:
  - server/services/menu-orders.ts `refundOrder`: the status moves to refunded before refundWallet runs. If refundWallet throws, the order is marked refunded with no credit, and a retry returns null. It is not idempotent-safe against that crash window. Refund first (the ref makes it idempotent), or retry the refund.
  - server/services/menu-orders.ts: the daily-cap check is a soft cap and can be exceeded by concurrent orders. The code comment documents this as intentional.
  - server/services/menu-orders.ts `placeMenuOrder`: for download items, a recordOrder failure after the debit is refunded. A recordOrder success followed by an insertOrder failure leaves an entitlement row alongside the refund. It is a narrow window.
  - Process notes: no raw `git log` per-path listing was done. The PRD files exist in prds-archived, so no missing-file finding applies.
