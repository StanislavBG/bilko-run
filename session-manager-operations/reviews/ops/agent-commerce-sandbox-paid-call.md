# Agent commerce: sandbox paid-call loop (Stripe test mode)

Run: 2026-10-20 (PDT), `tests/sandbox-agent-paid-call.test.ts`, Stripe CLI test-mode key
(`sk_test_`, never printed or committed). Result: **6/6 passed**.

Command:

    STRIPE_SANDBOX_KEY=<test_mode_api_key from stripe config --list> \
      timeout 240 pnpm vitest run tests/sandbox-agent-paid-call.test.ts

Only `roastPage` (Gemini) is mocked. The stripe, agent-buy, page-roast and project-catalog
routes are the real ones on one in-process Fastify app, with a local `STRIPE_WEBHOOK_SECRET`.

| Step | Result |
| --- | --- |
| `GET /buy/pageroast-credits-7` | 302 to test Checkout, session `cs_test_a1S7jv6k...` |
| Headless Chromium pays with 4242 (email `sandbox+<timestamp>@example.com`) | `payment_status=paid`, no challenge, about 8s |
| Signed `checkout.session.completed` to `/api/stripe/webhook` | balance 0 -> 7 (free-grant baseline 0) |
| `GET /checkout/success?session_id=...` | reveals key `bkk_9pX7...` (prefix only) |
| Second `/checkout/success` visit | no key shown ("already shown") |
| `POST /api/demos/page-roast` with the key | 200, balance 7 -> 6 |
| `POST /mcp` `tools/call roast_page` with the key | success, balance 6 -> 5 |

Checkout notes: the hosted page uses an accordion layout. The Card row must be force-clicked
to reveal inline card fields, and the "save with Link" box is unticked so no phone is needed.

If Stripe ever serves a challenge, the test fails with `HEADLESS_CHECKOUT_BLOCKED` and the
test Checkout URL. A human then pays that URL with card 4242 (any future expiry, any CVC/ZIP)
and re-runs the test.
