# Fix plan 1798: Important findings I1-I4 of the Three Winds security review

Each test was written first and confirmed red on the pre-fix code, then green after the fix.

I1: FIXED e5946c5c tests/rooms-runtime.test.ts::refuses a client action for a seat the room has made AI, and changes nothing
I1: FIXED e5946c5c tests/rooms-routes.test.ts::I1: a seat released because its escrow failed is cut off with 4001 and unseated
I2: FIXED e5946c5c tests/rooms-routes.test.ts::I2: a human whose socket closed with 1001 is unseated after the hand in progress, with no new escrow
I2: FIXED e5946c5c tests/rooms-routes.test.ts::I2: a ticket whose socket never connects is unseated before the next deal
I3: FIXED 40eb8415 tests/play-currency-apple.test.ts::a REFUND that arrives before the claim blocks the later pre-refund JWS (tombstone)
I4: FIXED 8474e2f7 tests/play-currency-stripe.test.ts::play-currency Stripe packs > webhook > refunds and disputes > charge.refunded takes the pack back once; a replay debits nothing
I4: FIXED 8474e2f7 tests/play-currency-stripe.test.ts::play-currency Stripe packs > webhook > refunds and disputes > debits only min(balance, taels) and records the shortfall when the balance is short
I4: FIXED 8474e2f7 tests/play-currency-stripe.test.ts::play-currency Stripe packs > webhook > refunds and disputes > charge.dispute.created takes the pack back once, and refund plus dispute together only once

## Notes

- I2 grace rules: a seat survives the next deal if it has a live socket, had one since the last hand ended, or holds an unexpired unused ticket (a fresh table's first deal runs before the client connects).
- I2 changed one existing test: `tests/rooms-settlement.test.ts` "a mid-hand disconnect..." asserted the old behavior (absent human re-escrowed for hand 2). It now asserts the human is unseated before hand 2.
- I4 adds the additive column `play_purchases.payment_ref` (server/db-schema.ts) to map a refund's `payment_intent` to the session whose credit it reverses. Stripe credits are recorded in `play_purchases` (provider 'stripe', external_id = session id) at `checkout.session.completed`. Partial refunds (`refunded: false`) are ignored until the full refund.
- Known limits, not in scope: a refund that arrives before its `checkout.session.completed` is not tombstoned (Stripe orders these events in practice); the `payment_ref` lookup has no index.
- Full `pnpm test` showed one timing flake (`rooms-threewinds` 24 seeded hands, 5 s limit under load) that passes alone in 4.5 s.

IMPORTANT FINDINGS OPEN: 0
