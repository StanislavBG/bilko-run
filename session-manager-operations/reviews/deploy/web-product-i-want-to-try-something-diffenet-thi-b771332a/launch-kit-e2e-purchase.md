# Launch Kit live E2E purchase

**E2E: PASS**

Run: 2026-10-10, 10:16-10:17 PM PDT. Script: `/home/bilko/Projects/Bilko-Launch-Kit/site/scripts/live-purchase.mjs` (Chromium headed under `xvfb-run`, Playwright, outside the golden spec; uncommitted in that repo). No product code changed in either repo.

## Path used: API-pre-applied fallback

The hosted Checkout UI still rejects the promotion code when it is typed in by the automation, so the run used the documented fallback. The promo was **pre-applied server-side**: `stripe checkout sessions create --live` with the production parameters (same price, `metadata[web_product]=launch-kit`, `discounts[0][promotion_code]`, production success/cancel URLs, no `allow_promotion_codes`). The browser then opened that session URL, entered the QA email and completed checkout at **$0.00**. Webhook, thanks page and download ran on the real production path.

## Why the UI promo path failed (step 1 network log)

Human-like entry (click, `pressSequentially` at 80 ms, wait for Apply enabled, headed browser, desktop Chrome UA, en-US, America/Los_Angeles) did not help. Stripe's own response to the promo submit:

- HTTP 400, code `payment_pages_promotion_code_invalid`, message "This promotion code is invalid."

So the rejection comes from Stripe's server, not from a stale React state in the page. The same promotion code works through the API (session total $0, discount $9.00), so Stripe's hosted Checkout appears to refuse promo codes submitted by automated browsers. Log: `/tmp/launch-kit-e2e/promo-net.json` (code redacted as `<PROMO>`).

## Results

| Check | Result |
| --- | --- |
| Landing -> Buy -> Stripe Checkout | reached |
| Total at checkout | $0.00, no card details demanded, no captcha |
| Thanks page | landed on `https://bilko.run/projects/launch-kit/thanks/?session_id=cs_live_...` (session ends `9IVucx`) |
| `#download` visible | yes, within 60 s |
| Downloaded sha256 | `f74e8e96d7f9eb138d1c60af5e01441a57a44741dbf047a23a572925092efa4e` |
| Release sha256 in `shared/web-products.ts` | `f74e8e96d7f9eb138d1c60af5e01441a57a44741dbf047a23a572925092efa4e` (match) |
| Order endpoint `downloadsUsed` | 1 (limit 20) |

## Budget

Attempt 1 (UI promo) was rejected and consumed no redemption. Attempt 2 (fallback) completed. Promo `times_redeemed` is now 1 of 5.

## Screenshots

Local only, `/tmp/launch-kit-e2e/` (`a1-*` UI attempt, `a2-*` fallback, `result.json`, `promo-net.json`).
