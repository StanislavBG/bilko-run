---
title: Add a real "buy me a coffee" tip product on bilko.run so publictrades' support CTA stops 404ing
cwd: ~/Projects/Bilko
estimateMinutes: 25
---

# Goal

The social-signals-trader dashboard (published at `bilko.run/projects/social-signals-trader`)
renders four "Buy me a coffee" CTAs — sticky header, floating button, per-trade `☕ tip` link,
and the footer CTA — all pointing at `https://buymeacoffee.com/publictrades`. That Buy Me a
Coffee account does not exist: `curl -sL https://buymeacoffee.com/publictrades` returns **404**
(also 404 on the `www.` host). The live published bundle carries the same dead URL
(`bilko.run/projects/social-signals-trader/data.js` → `"bmcUrl": "https://buymeacoffee.com/publictrades"`).

Rather than register a third-party Buy Me a Coffee account, serve the tip through the Stripe
integration this project already owns (`server/routes/stripe.ts`, `shared/product-catalog.ts`).
This PRD builds the bilko.run half: a real one-time "support" product plus a **stable, plain-`href`
destination** the static trader dashboard can link to without an email form or a CORS-crossing
`fetch` (it is same-origin, but the dashboard ships unbundled JSX with no auth/email UI).

Sibling PRD 993 in `~/Projects/social-signals-trader` repoints the dashboard at whatever URL this
PRD lands. Land this one first.

# Acceptance criteria

- [ ] `shared/product-catalog.ts` gains a `PUBLICTRADES_COFFEE: 'publictrades_coffee'` product key,
      a `'publictrades_coffee'` member of the `PriceType` union, and a `PRICE_CATALOG` entry
      `{ priceType: 'publictrades_coffee', envVar: 'STRIPE_PRICE_PUBLICTRADES_COFFEE',
      productKey: PRODUCT_KEYS.PUBLICTRADES_COFFEE, mode: 'payment' }` — no `tokenAmount`.
      Follow the existing `session_manager` row exactly; keep the file pure data.
- [ ] `server/routes/stripe.ts` gains a `GET /coffee` route modelled on the existing `GET /upgrade`
      redirect (line ~460): 302 to `process.env.STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE` when set.
      When it is NOT set, fall back to creating (or redirecting to) a checkout for
      `STRIPE_PRICE_PUBLICTRADES_COFFEE`; if neither env var is configured, return a **200 HTML
      page** explaining tipping is temporarily unavailable with a link back to bilko.run — it must
      never itself 404 or 5xx, because that is the exact failure mode this PRD exists to remove.
- [ ] `GET /checkout/success` treats `publictrades_coffee` like `session_manager`: a thank-you page,
      NOT license-key/"You're now Pro" copy. Extract the existing `isSessionManager` branch into a
      shared "no-license support purchase" branch rather than adding a second parallel `if`.
- [ ] The `checkout.session.completed` webhook records the purchase under product key
      `publictrades_coffee` (this already works via `entryForPriceId` once the catalog row exists —
      add a test that asserts it, do not special-case it).
- [ ] `.env.example` documents `STRIPE_PRICE_PUBLICTRADES_COFFEE` and
      `STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE` alongside the existing `STRIPE_PRICE_*` block.
- [ ] Tests: (1) `entryForPriceType('publictrades_coffee')` resolves; (2) `entryForPriceId` maps the
      configured price ID back to `publictrades_coffee`; (3) `GET /coffee` with the payment-link env
      set returns 302 to it; (4) `GET /coffee` with NO stripe env set returns 200 HTML, not 404/503;
      (5) `/checkout/success` for a `publictrades_coffee` line item renders the thank-you body and
      does not print a license key. Run the project's existing test command; all green.
- [ ] **Blocked-on-human, state it explicitly in the completion report:** the actual Stripe Price ID
      / Payment Link must be created in the Stripe dashboard and set in Render's env for
      `bilko.run`. Do not invent an ID. Ship the code so that setting the env var is the only
      remaining step, and say so.

# Implementation notes

- Read first: `server/routes/stripe.ts` (the `POST /api/stripe/create-checkout-session` handler,
  the `GET /upgrade` redirect at ~460 as the pattern for a stable static-linkable URL, and the
  `GET /checkout/success` `isSessionManager` branch), and `shared/product-catalog.ts` in full.
- Suggested price: $5 one-time, matching the "buy a coffee" convention. Confirm the amount in the
  Stripe dashboard; the code must read the price from the env-configured Price ID, never hardcode
  an amount.
- `GET /coffee` is deliberately a top-level path (not `/api/...`) so a static `<a href>` in another
  project's bundle can point at `https://bilko.run/coffee` and stay stable if the Stripe product is
  later swapped. Check `server/security-headers.ts` and `server/index.ts` for anything that would
  intercept an unknown top-level path before the route matches.
- Do NOT wire Clerk or any new auth into this — a tip is anonymous. `client_reference_id` is
  optional here; a Payment Link with no customer lookup is acceptable for the fallback path.
- Persona: dev-lead. Read the repo's engineering standards file before implementing.
