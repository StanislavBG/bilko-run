---
title: Test the production Stripe webhook signature path
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-04T08:57:14.593Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
disposition: new-head
planId: pl-mutl7sdd-80da9b
---
# Goal

behavior (test, money): only the dev no-signature path of the Stripe webhook is tested. The production path (server/routes/stripe.ts, about lines 148-163) must reject a missing or invalid stripe-signature and accept a correctly signed event. That path is what keeps credits from being forged.

# Acceptance criteria

- [ ] New tests/stripe-webhook-signature.test.ts drives the real webhook route via app.inject with NODE_ENV=production and STRIPE_WEBHOOK_SECRET set
- [ ] A request with no stripe-signature header gets a 4xx and grants no tokens
- [ ] A request with a wrong signature gets a 4xx and grants no tokens
- [ ] A request signed with stripe.webhooks.generateTestHeaderString using the configured secret is accepted (2xx)
- [ ] If the test exposes a real bug in server/routes/stripe.ts, fix it minimally and name it in the report

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- tests/stripe-webhook-signature.test.ts
- server/routes/stripe.ts

# Implementation notes

Read first: server/routes/stripe.ts lines 120-200 (webhook handler and raw-body handling); tests/coffee-checkout.test.ts (how it builds the app and posts a webhook in dev mode, about line 126); tests/tokens.test.ts (how token balance is read back).

Stripe SDK v14: `stripe.webhooks.generateTestHeaderString({ payload, secret })`. The payload must be the exact raw string sent as the body. Restore NODE_ENV and env vars after each test.

Do not touch: tests/coffee-checkout.test.ts, tests/stripe-checkout-success.test.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/stripe-webhook-signature.test.ts tests/coffee-checkout.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
