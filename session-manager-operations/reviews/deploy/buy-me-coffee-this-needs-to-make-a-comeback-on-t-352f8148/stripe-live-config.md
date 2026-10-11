# Stripe live config — Buy me a coffee

Applied 2026-10-10 ~7:17 PM PDT, account acct_1SbkmmR6w0VtQRLT, live mode (`--live`). No secret keys recorded.

## Before / after

| Object | Field | Before | After |
|---|---|---|---|
| prod_V2Q4ego2oijqo4 | name | Buy me a coffee | Buy me a coffee (unchanged) |
| prod_V2Q4ego2oijqo4 | description | Support PublicTrades — an autonomous social-signals trading fund run in public. | Buy Bilko a coffee — keeps the free tools on bilko.run (including Session Manager) running. |
| plink_1U2LEcR6w0VtQRLTVdfPa3Kp | after_completion.type | hosted_confirmation | redirect |
| plink_1U2LEcR6w0VtQRLTVdfPa3Kp | after_completion.redirect.url | (none) | https://bilko.run/checkout/success?session_id={CHECKOUT_SESSION_ID} |

## Commands run

```
timeout 30 stripe products retrieve prod_V2Q4ego2oijqo4 --live
timeout 30 stripe payment_links retrieve plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live
timeout 30 stripe products update prod_V2Q4ego2oijqo4 --live -d "description=Buy Bilko a coffee — keeps the free tools on bilko.run (including Session Manager) running."
timeout 30 stripe payment_links update plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live -d "after_completion[type]=redirect" -d "after_completion[redirect][url]=https://bilko.run/checkout/success?session_id={CHECKOUT_SESSION_ID}"
timeout 30 stripe products retrieve prod_V2Q4ego2oijqo4 --live
timeout 30 stripe payment_links retrieve plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live
timeout 30 stripe payment_links list_line_items plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live
```

## Retrieve output proving the after state

Product: `id: prod_V2Q4ego2oijqo4`, `active: true`, `name: "Buy me a coffee"`,
`description: "Buy Bilko a coffee — keeps the free tools on bilko.run (including Session Manager) running."`

Payment link `plink_1U2LEcR6w0VtQRLTVdfPa3Kp`: `active: true`, `livemode: true`,
`after_completion: { type: "redirect", redirect: { url: "https://bilko.run/checkout/success?session_id={CHECKOUT_SESSION_ID}" } }`

Line items: one item, `quantity: 1`, `price.id: price_1U2LEcR6w0VtQRLThguPtRCI`, `unit_amount: 500`, `currency: usd`, `amount_total: 500`.

No other Stripe object was created, archived or modified.
