# Launch Kit — live Stripe objects

Created 2026-10-10 ~9:36 PM PDT on live account `acct_1SbkmmR6w0VtQRLT` via the Stripe CLI (`--live`, each call wrapped in `timeout 30`).

| Object | Id |
|---|---|
| Product "Bilko Launch Kit" | `prod_VQ4ePQ5HTW5znY` |
| Price ($9.00 USD one-time, default_price) | `price_1UPEUuR6w0VtQRLTqFklclrS` |
| Coupon "Launch Kit QA" | `zqomwcOl` |
| Promotion code id | `promo_1UPEV2R6w0VtQRLTqcsFAi1Z` |

The promotion code value (`LAUNCHKITQA` + 6 random A-Z0-9) is stored only in `/home/bilko/.config/bilko/launch-kit-qa-promo.txt` (mode 600). It is not in this repo.

## Commands run (promo code value redacted)

```
stripe products search --live --query "metadata['web_product']:'launch-kit'"   # empty -> nothing to reuse
stripe products create --live -d name="Bilko Launch Kit" -d "description=8 Claude skills that take a solo founder from \"it works\" to launched: page roast, headline lab, pricing and offer, launch emails, launch-week plan, build-in-public threads and first-100 outreach." -d "metadata[web_product]=launch-kit"
stripe prices create --live -d product=prod_VQ4ePQ5HTW5znY -d unit_amount=900 -d currency=usd -d "metadata[web_product]=launch-kit"
stripe products update prod_VQ4ePQ5HTW5znY --live -d default_price=price_1UPEUuR6w0VtQRLTqFklclrS
stripe coupons create --live -d percent_off=100 -d duration=once -d name="Launch Kit QA" -d "applies_to[products][0]=prod_VQ4ePQ5HTW5znY" -d max_redemptions=5
stripe promotion_codes create --live -d coupon=zqomwcOl -d code=<REDACTED> -d max_redemptions=5
   # Stripe error: parameter_unknown "Received unknown parameter: coupon" (this API version nests it). Nothing was created. Re-ran with the same coupon:
stripe promotion_codes create --live -d "promotion[type]=coupon" -d "promotion[coupon]=zqomwcOl" -d code=<REDACTED> -d max_redemptions=5
```

## Retrieve output proving each criterion

- Product (`products retrieve`): `livemode: true`, `active: true`, `name: "Bilko Launch Kit"`, `metadata.web_product: "launch-kit"`, `default_price: "price_1UPEUuR6w0VtQRLTqFklclrS"`, description exactly the requested text.
- Price (`prices retrieve`): `livemode: true`, `unit_amount: 900`, `currency: "usd"`, `type: "one_time"`, `product: "prod_VQ4ePQ5HTW5znY"`, `metadata.web_product: "launch-kit"`.
- Coupon (`coupons retrieve -d "expand[]=applies_to"`): `livemode: true`, `percent_off: 100.0`, `duration: "once"`, `max_redemptions: 5`, `applies_to.products: ["prod_VQ4ePQ5HTW5znY"]`, `valid: true`.
- Promotion code (`promotion_codes retrieve`): `livemode: true`, `active: true`, `max_redemptions: 5`, `times_redeemed: 0`, `promotion: {type: coupon, coupon: zqomwcOl}`, `code: <REDACTED>`.

## Notes

- Idempotency: the pre-create metadata search returned no hits. A later search returned 0 right after creation (search index lag). A re-run must look up by id or retry the search before creating anything.
- No other live object was created, archived or modified.
