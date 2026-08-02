---
title: Register session_manager as a Stripe product + fix checkout/success to be product-aware
cwd: ~/Projects/Bilko
estimateMinutes: 22
---

# Goal

Add a new one-time-purchase product ("Session Manager" — a Buy-Me-a-Coffee-style optional
support purchase, separate from the free `npx claude-code-session-manager@latest` distribution,
which stays free and unchanged) to this repo's existing Stripe/license machinery, and fix a real
bug found while tracing the flow: `server/routes/stripe.ts`'s `/checkout/success` handler
(~line 340) **hardcodes** `upsertLicenseKey(email, customerId, 'contentgrade_pro')` regardless of
what was actually purchased, instead of using the catalog's own `entryForPriceId` lookup. Today
that's silently masked because ContentGrade Pro is effectively the only `mode: 'payment'`-ish
product flowing through this exact success path; adding a second one-time product without fixing
this would mis-issue every Session Manager purchaser a ContentGrade Pro license instead.

# Acceptance criteria

- [ ] In `shared/product-catalog.ts`: add `SESSION_MANAGER: 'session_manager'` to `PRODUCT_KEYS`;
  add `'session_manager'` to the `PriceType` union; add a `PRICE_CATALOG` entry:
  `{ priceType: 'session_manager', envVar: 'STRIPE_PRICE_SESSION_MANAGER', productKey:
  PRODUCT_KEYS.SESSION_MANAGER, mode: 'payment' }` (one-time purchase — no `tokenAmount`, matches
  `audiencedecoder_report`'s shape, not the subscription-mode ContentGrade entries).
- [ ] Fix `/checkout/success` (`server/routes/stripe.ts`, the handler currently at ~line 310-358)
  to determine the actually-purchased product from the checkout session's line items via
  `entryForPriceId` (already imported in this file, already used correctly elsewhere — e.g. the
  webhook handler around line 166-197 does this correctly; port that same lookup pattern into
  `/checkout/success` instead of the hardcoded `'contentgrade_pro'` string) before calling
  `upsertLicenseKey(email, customerId, <actual productKey>)`. If no catalog entry can be resolved
  for the session's price, fall back to `'contentgrade_pro'` **only as a last resort** with a
  clear code comment explaining why (preserves today's behavior for any purchase path that
  doesn't cleanly resolve), rather than silently defaulting for every product.
- [ ] The success page's HTML (same handler) should reflect which product was purchased in its
  copy (e.g. "You're now Pro 🎉" only for ContentGrade; a generic "Thanks for your support 🎉"
  or product-specific line for Session Manager) — read the existing template
  (`successHtml(...)` calls in this file) and extend it minimally, don't rewrite the styling.
- [ ] **Security (mandatory):** confirm (read, don't just assume) that `/api/stripe/webhook`'s
  signature verification (`stripe.webhooks.constructEvent` or equivalent — find the exact call in
  this file) is unaffected by this change and still runs before any DB write for the new product
  path. This PRD must not weaken webhook verification while touching adjacent code.
- [ ] `STRIPE_PRICE_SESSION_MANAGER` will not be set in any environment yet (creating the actual
  Stripe Product/Price is a manual step outside this PRD's scope, done by the user in the Stripe
  dashboard) — confirm the existing graceful-degradation behavior (`isStripeConfigured`-style
  checks returning 503 "Stripe not configured" per entry, not a crash) already covers a
  catalog entry whose env var isn't set yet; if it doesn't cleanly 503, that's a bug to fix here
  too (a missing price env var must never 500 or crash the process).
- [ ] Add/extend a test (search `find server -iname '*stripe*spec*' -o -iname '*stripe*test*' -o
  -iname '*product-catalog*spec*'` first) covering: `entryForPriceType('session_manager')`
  resolves the new catalog entry; `/checkout/success` issues a `session_manager`-keyed license
  for a session whose line item resolves to the `STRIPE_PRICE_SESSION_MANAGER` price (mock
  Stripe), not a `contentgrade_pro` one; the fallback-to-contentgrade_pro path only fires when
  resolution genuinely fails. Run the project's real test command (check `package.json`'s
  `scripts.test`, likely `npm test` or similar — use it, don't guess `vitest` if this repo uses
  something else) bounded with `timeout 300`.
- [ ] The project's typecheck command passes (check `package.json` for the exact script name —
  likely `npm run typecheck` or `tsc --noEmit` directly; use whatever this repo actually defines,
  bounded with `timeout 300`).

# Implementation notes

- Read `shared/product-catalog.ts` in full first (72 lines) — it's the single source of truth;
  match its existing formatting/style exactly for the new entry.
- Read `server/routes/stripe.ts`'s webhook handler (~lines 118-235) to see the *correct*
  `entryForPriceId` usage pattern already in this file — port that same approach into
  `/checkout/success`, don't invent a different resolution method.
- This repo also has `server/routes/analytics.ts` importing `PRODUCT_KEYS` for purchase-count
  queries — no change needed there for this PRD (it's generic over whatever keys exist), but
  worth knowing it exists if analytics reporting later needs a Session Manager line.

# Out of scope

- Do not create the actual Stripe Product/Price in the Stripe dashboard — that's a manual human
  step; this PRD only wires the code to expect `STRIPE_PRICE_SESSION_MANAGER` once set.
- Do not touch the npm package / `npx` distribution — confirmed staying free and unchanged, this
  PRD is purely about the optional Bilko.run purchase flow.
- Do not change ContentGrade/AudienceDecoder/PageRoast's own catalog entries or behavior beyond
  the `/checkout/success` product-resolution fix (which benefits all of them equally by making
  the success page accurate for whichever product was actually bought).
- Do not build the actual Session Manager landing/checkout page — that's PRD 712, sequenced
  after this one (it depends on the catalog entry + fixed success handler existing).

## Engineering standards

Before writing any code, read `~/Projects/session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging, API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is mandatory, especially Execution discipline (bounded commands, verify before done, the finish-protocol sentinel).
