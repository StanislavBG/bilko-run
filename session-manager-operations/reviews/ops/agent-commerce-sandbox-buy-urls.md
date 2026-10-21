# Agent commerce: sandbox check of /buy/<offerId> URLs

Run date: 2026-10-20. Stripe **test mode** only (`sk_test_` key enforced by the test; live keys are refused).

Command: `STRIPE_SANDBOX_KEY=<test_mode_api_key from stripe config --list> pnpm vitest run tests/sandbox-agent-buy.test.ts`
Result: 4/4 passed. Each offer's `GET /buy/<id>` (Chrome UA) returned 302 to `https://checkout.stripe.com/...`; the session retrieved from Stripe had `livemode=false`, the expected single line-item price and amount, the expected mode, and the expected metadata.

| offer id | session id (prefix) | price id | mode | metadata |
|---|---|---|---|---|
| launch-kit | cs_test_b1mFPQjd... | price_1USqGGR6w0VtQRLT6vx0ld2I | payment | web_product=launch-kit, agent_buy=launch-kit |
| git-viewer | cs_test_a1uXgl06... | price_1USqGGR6w0VtQRLTpTVCHLJI | subscription | agent_buy=git-viewer, agent_key=0 |
| pageroast-credits-7 | cs_test_a1UaJuqU... | price_1USqGHR6w0VtQRLTvxPU855W | payment | agent_buy=pageroast-credits-7, agent_key=1 |
| pageroast-credit-1 | cs_test_a19X1Q74... | price_1USqGHR6w0VtQRLT8e6ZqGDc | payment | agent_buy=pageroast-credit-1, agent_key=1 |

Test prices are reusable via lookup_key `bilko-sandbox-<offerId>`. Without `STRIPE_SANDBOX_KEY` the file is skipped and makes no network call.
