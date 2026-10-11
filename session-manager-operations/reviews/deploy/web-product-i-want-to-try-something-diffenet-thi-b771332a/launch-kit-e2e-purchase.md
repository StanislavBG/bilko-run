# Launch Kit live E2E purchase

**E2E: BLOCKED**

Run: 2026-10-10, about 10:00-10:12 PM PDT. Script: `/home/bilko/Projects/Bilko-Launch-Kit/site/scripts/live-purchase.mjs` (headless Chromium via `@playwright/test`, outside the golden spec; uncommitted in that repo, untouched otherwise).

## Blocker (exact)

Stripe Checkout rejected the QA promotion code: after the code was typed into the "Add promotion code" field and Apply was pressed, the page showed **"This code is invalid."** and the total stayed **$9.00** (never $0.00). No payment was made, no redemption was consumed, and the run never reached the thanks page or the download.

Not a captcha/bot wall and not a card demand. The rejection is not a typo or stale file: via the Stripe CLI (live), promotion code `promo_1UPEV2R6w0VtQRLTqcsFAi1Z` is `active: true`, `times_redeemed: 0`, `max_redemptions: 5`, no restrictions, coupon `zqomwcOl` is `percent_off: 100`, `valid: true`, and its code string equals the value in `launch-kit-qa-promo.txt`. So the live Checkout Session does not accept a code that Stripe reports as valid. Suspects for the fix wave: the session or Stripe API version in use does not honor promotion codes created with the newer `promotion[type]=coupon` form, or the session's price/product does not match what the code accepts.

## Attempts (2 of 2 used)

| Attempt | Result |
| --- | --- |
| 1 | Landing -> Buy -> checkout.stripe.com loaded, email entered, code entered, "This code is invalid." |
| 2 | Same outcome |

An earlier script run stopped on a false captcha detection (Stripe's invisible hCaptcha iframe); it never got past checkout load, made no purchase, and the detector was fixed to count only visible challenge frames.

## Screenshots (local only, /tmp/launch-kit-e2e/)

`a1-01-landing.png`, `a1-02-checkout-loaded.png`, `a1-03-promo-typed.png`, `a1-04-failure.png`, `a2-05-landing.png`, `a2-06-checkout-loaded.png`, `a2-07-promo-typed.png`, `a2-08-failure.png`, `result.json`. The promo-typed/failure shots show the code in clear text, which is why they stay out of the repo.

## Not verified

Thanks-page URL, paid state, download sha256 against `f74e8e96...2efa4e` (v1.0.0), and `downloadsUsed >= 1`: all unreached. The human can complete the purchase by hand, or re-run the script after the checkout promo rejection is fixed.
