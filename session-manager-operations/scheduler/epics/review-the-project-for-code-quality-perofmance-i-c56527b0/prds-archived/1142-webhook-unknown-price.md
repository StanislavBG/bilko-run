---
title: Stripe webhook: an unrecognized price must not be booked as an AudienceDecoder report
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:12:36.447Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [server-error-handler]
planId: pl-mv1ksmd2-85365b
---
# Goal

bug. In server/routes/stripe.ts the webhook's one-time-payment branch (~lines 200-225) starts with `productKey = PRODUCT_KEYS.AUDIENCEDECODER_REPORT`. When the paid price matches no catalog entry, or the line-item lookup throws, the sale is saved as an AudienceDecoder report, giving the buyer an entitlement they didn't buy and corrupting revenue attribution. Record it as unattributed instead. Read the landed stripe.ts from server-error-handler first.

# Acceptance criteria

- [ ] When no catalog entry matches, or the lookup throws, the purchase is saved with `product_key = 'unattributed'` (or the existing table's equivalent nullable marker; say which), with the price id in the existing log line, and no product entitlement is granted.
- [ ] Known prices (AudienceDecoder, PageRoast tokens, coffee, Session Manager) are attributed exactly as before.
- [ ] Any code that reads one-time purchases to grant AudienceDecoder access (grep `AUDIENCEDECODER_REPORT`) ignores 'unattributed' rows.
- [ ] tests/stripe-webhook-signature.test.ts and tests/coffee-checkout.test.ts green; new tests/stripe-webhook-attribution.test.ts covers an unknown price, a lookup throw, and a known AudienceDecoder price.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/stripe.ts
- server/services/stripe.ts
- tests/stripe-webhook-attribution.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Money code. Read first: server/routes/stripe.ts lines 130-260; shared/product-catalog.ts; server/services/stripe.ts saveOneTimePurchase; tests/stripe-webhook-signature.test.ts (fixtures). Do not touch: server/db.ts (no schema change; if a NOT NULL/CHECK constraint blocks 'unattributed', report and use a valid marker).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/stripe-webhook-attribution.test.ts tests/stripe-webhook-signature.test.ts tests/coffee-checkout.test.ts tests/stripe-checkout-success.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
