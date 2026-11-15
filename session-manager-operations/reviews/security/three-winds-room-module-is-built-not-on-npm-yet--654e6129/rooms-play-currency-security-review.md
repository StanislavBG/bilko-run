# Security review: Three Winds rooms, play-currency ledger and Apple IAP

- Date: 2026-11-15
- Reviewed at: `c9414606` (worktree HEAD before this record)
- Reviewer: dev-lead (PRD 1796). This is a read-only review. No application code or tests were changed, and nothing called production bilko.run, Stripe or Apple.
- Severity scale: **Critical** means an attacker can mint, steal or destroy taels or money at will, or break the ledger. **Important** means a real money or trust-boundary failure that needs a precondition (collusion, a refund, a common client behaviour). **Minor** means defence in depth, a design gap, or harm that is low-value or self-inflicted.

## Files reviewed

| File | Lines | Scope |
| --- | --- | --- |
| `server/services/play-currency.ts` | 284 | whole file |
| `server/routes/play-currency.ts` | 269 | whole file |
| `server/services/apple-iap.ts` | 142 | whole file |
| `server/routes/stripe.ts` | 678 | play-pack branch of `/api/stripe/webhook` (lines 184-251, and the outer catch at 415-421); the other event types were checked only to confirm that no other branch handles play packs |
| `server/routes/rooms.ts` | 419 | whole file |
| `server/rooms/runtime.ts` | 334 | whole file |
| `server/rooms/socket.ts` | 275 | whole file |
| `server/rooms/modules.ts` | 25 | whole file |

The following were read only for context and are not under review: `server/db-schema.ts:643-690` (the UNIQUE/PRIMARY KEY/CHECK constraints the ledger relies on), `server/clerk.ts:64-71` (`requireAuth`), `shared/play-currency-catalog.ts` (signup grant 5000; tiers tea 5, jade 25, peony 100, imperial 500; packs) and `node_modules/@threewinds/engine/dist/room.js` `toActOf` (to judge whether `toAct` leaks concealed data).

## Coverage by required area

### 1. Identity and entitlement come only from the verified Clerk token: holds, no finding

- Every user route takes the account from `requireAuth` (`server/clerk.ts:64`, which verifies the Bearer token): balance `play-currency.ts:105`, checkout `:122`, entitlements `:170`, item purchase `:180`, Apple transactions `:200`, room ticket `rooms.ts:350`. No route reads an email, account or amount from the body or the query. The body supplies only `app`, `tier`, `packId`, `currency`, `itemId` and `signedTransaction`, and each is checked against the catalog or verified by Apple.
- The Stripe play-pack credit (`stripe.ts:239`) uses `metadata.play_email`, which only the server sets, from the Clerk email (`play-currency.ts:144-159`). Stripe signs the event (`stripe.ts:198-199`). The fallback to `customer_details.email` applies only to a session that carries `play_pack` metadata but no `play_email`, and only the server or the Stripe Dashboard can create one. See M5 for the dev-mode unsigned path.
- Apple notifications have no session by design. The JWS signature, verified against the pinned Apple Root CA G3 (`apple-iap.ts:25`) with the bundle id, environment and production app id pinned (`apple-iap.ts:60-72, 89-97`), is the credential. Notifications can only take taels back. They never credit.
- The WebSocket identity is the ticket's email (`socket.ts:590`). The seat comes from the room's own `seatFor(email)` (`rooms.ts:291-294`), never from the client frame (`socket.ts:508` uses `c.seat`). See I1 for a gap in how a released seat is enforced.
- Accounts are keyed on the lower-cased Clerk email, not the Clerk user id. That is the host-wide wallet convention and is outside these files. It is noted, not counted.

### 2. Idempotency and double credit: Stripe and Apple credits hold; refunds have gaps (I3, I4, M1, M6, M7)

- Stripe: `creditPlay(..., 'stripe:' + session.id)` (`stripe.ts:250`). The `(app, account, ref)` check in the transaction (`play-currency.ts` service `:60`), backed by `UNIQUE (app, account, ref)`, makes a retried or replayed `checkout.session.completed` credit nothing. The outer catch returns 500 so Stripe retries, and retries are safe. The price is re-checked against the catalog (`amount_subtotal`, currency, `payment_status === 'paid'`) at `stripe.ts:240-243`, and play checkout does not enable promotion codes.
- Apple claim: `PRIMARY KEY (provider, external_id)` with `INSERT OR IGNORE` followed by an owner check (`play-currency.ts:228-235`) lets one account own a transaction id. The ledger ref `apple:<id>` (`:243`) means a crash between the insert and the credit still credits exactly once. A JWS that carries a `revocationDate` is refused (`:222`).
- Apple refund: the fixed ref `apple_refund:<id>` (`:79`) and the `status = 'credited'` guard make a replayed REFUND debit nothing. Gaps: I3 (a refund that arrives before the claim is dropped), M1 (the shortfall is never collected), M7 (REFUND_REVERSED is ignored).
- Stripe refunds and disputes: not handled at all (I4).

### 3. Escrow and settle atomicity, sum to zero, maxLossPoints, races with the orphan sweeper: holds, except a deploy-overlap race (M2)

- `escrowPlay` moves balance to held in one transaction with a conditional `UPDATE ... AND balance >= ?` and is idempotent on `(app, email, ref)` (`play-currency.ts` service `:113-132`). The `CHECK (balance >= 0)` and `CHECK (held >= 0)` constraints back it.
- `settlePlayHand` validates before it writes: integer deltas, `|delta| <= MAX_AMOUNT`, each account at most once, the house never escrowed, a user loss without an escrow refused, and `sum === 0` (`:139-166`). It then applies every entry in one transaction, re-checks `-delta <= held escrow` per user from the database (`:176-182`) and refuses a replayed ref (`:169`). Any throw rolls the whole hand back. `settleHand` then releases every escrow (`rooms.ts:188-194`), so a failed settle changes no balance.
- The runtime validates the module's points independently: integers, length equal to seats, each `>= -maxLossPoints`, sum 0 (`runtime.ts:306-311`). A bad `nextDealer` voids the hand (`:299`). The escrow amount is `stake * maxLossPoints` (`rooms.ts:125`) and a loss is `p * stake` with `p >= -maxLossPoints`, so a validated loss can never exceed its escrow.
- The sweeper releases only escrows that are at least 60 s old and whose room is not live in this process (`rooms.ts:231-241`). A settle that races a sweep release fails as a whole (`no held escrow`) and becomes a void, never a partial settle. Room ids are random (`rooms.ts:268`), so a new table cannot adopt an old ref. The cross-process case is M2.

### 4. No route moves taels between users: holds for routes; rooms move taels by design (M9)

There is no transfer, gift or cash-out route. The only sinks are item purchase (`play-currency.ts:178-196`) and play. The only sources are the signup grant, Stripe, Apple and winning hands. Hands between humans are zero-sum transfers between users by design, so colluding accounts can move taels through a table (M9). I1 also lets a released player steer a house-backed seat.

### 5. Room redaction (raw state and seed never sent): holds, no finding

- `#seed` is a private class field that is cleared at hand end (`runtime.ts:77, 322`). `state` is private. The only outbound payloads are `state` (`module.view(state, seat)`, `toAct`, `deadline`, `seq`, `hand`) at `:270`, `error` (`code`, `seq`) at `:327`, and `hand_over` (view and points) at `:302`. AI seats receive nothing (`:274-283`).
- `toAct` is broadcast. The engine lists every undeclared seat in a claim window, not only seats able to claim (`room.js` `toActOf`), so `toAct` does not reveal concealed tiles. The R4.6 claim deadline in `modules.ts:25-30` depends only on the public `phase`, which satisfies the `deadlineMs` contract (`runtime.ts:28`).
- `roomSnapshot` (`rooms.ts:320`), which holds emails, is not wired to any route. `/api/rooms/tiers` returns only tier ids, stakes and open-seat counts. The ticket response carries no other player's data.
- The host trusts `module.view` to hide other seats' concealed tiles. That is checked by the engine's own redaction test, not by these files.

### 6. Ticket single use, TTL and Origin rule: holds, defence-in-depth note (M3)

- Tickets are 24 random bytes (`socket.ts:401`), bound to `(email, roomId)` and valid for 30 s (`:351, 402`). They are deleted on first presentation whatever the outcome, and refused when expired or when the room does not match (`:412-418`).
- Origin: an exact allow-list of bilko.run and www (`:372-377`). A missing Origin is allowed for native clients. Localhost is allowed only outside production. Tickets come from a Bearer-token route, not a cookie, so a cross-site page cannot mint one, and Origin is defence in depth.
- Tickets travel in the URL query string (`rooms.ts:369`, `socket.ts:580`). See M3.

### 7. Per-socket rate and frame limits, and seat takeover: limits hold; the seat lifecycle has two gaps (I1, I2)

- Each socket has a token bucket of 20 frames/s with a burst of 20, and an empty bucket closes the socket with 4002 (`socket.ts:475-481, 501`). Binary frames and text frames over 2048 bytes close it with 4003, and `ws` itself refuses frames above 16 KiB (`:358, 502-503, 563`). A malformed message also closes with 4003 (`:505`).
- Takeover: only a ticket for the same email can claim the seat (`seatFor`). The newer socket supersedes the old one (4000), and frames from a superseded socket are ignored (`:507, 519-522`). The old socket's close does not fire `onClose` (`:530`).
- `act` checks `toActNow` and `seq` (`runtime.ts:148-152`). It does not check that the seat is still human (I1).

### 8. Parameterized SQL: holds, no finding

Every statement in `server/services/play-currency.ts` and `server/routes/play-currency.ts` uses `?` placeholders through `dbGet`, `dbAll`, `dbRun`, `txGet` and `txRun`. The one template literal (`play-currency.ts:229`) has no interpolation. The literal kinds (`'settle'`, `'held'`, `'item_purchase'`) are constants. The rooms, socket and Apple files run no SQL.

## Findings

### Critical

None. No path lets an unauthenticated or single-account attacker mint taels, take another user's taels, or leave the ledger unbalanced: signatures are verified, credits are idempotent, settles are atomic and zero-sum, and the balance cannot go below zero.

### Important

#### I1: A player released at hand start keeps steering the now house-backed seat
- **Where:** `server/routes/rooms.ts:135-139` (escrow failure releases the seat but leaves the socket open), `server/rooms/socket.ts:507-508` (frames go to `act(c.seat, ...)` while the socket is still registered for that seat) and `server/rooms/runtime.ts:148-152` (`act` checks `toActNow` but not `this.ai.has(seat)`).
- **Scenario:** A and B sit at an Imperial table (stake 500). Before the hand starts, A spends taels on an item (`/api/play-currency/items/:id/purchase`), so A's escrow of 200,000 fails. A's seat is released and filled with AI, and the house now takes that seat's points. A's socket stays open. Sending a junk action returns an `error` frame that carries the current `seq` (`runtime.ts:327`). A then sends `pass` or other always-legal actions for the AI seat within `aiDelayMs` (800 ms), so the seat never claims or wins. The losses go to the house and B collects up to 400 × 500 per hand. A can also take a new ticket and sit at another table while the old socket keeps steering this seat.
- **Test that catches it:** In a rooms route test with a stub module, seat two humans, make seat 0's `escrowPlay` fail (balance drained after ticketing), keep seat 0's socket open, send a legal `{type:'action'}` frame for seat 0 and assert that the room ignores it (no state change). The test should also assert that the socket is closed with `ROOM_CLOSE.NO_SEAT`. A `runtime.ts` unit test should assert that `act()` on a seat in the `ai` set is refused.

#### I2: A seat whose socket closes with any code other than 1000 is kept, escrowed and autoplayed with no end
- **Where:** `server/routes/rooms.ts:219-225` (`onSeatClose` unseats only on code 1000) and `:211-216` (`scheduleNextHand` deals again while `t.seats.size > 0`). The ticket route also seats the player before any socket connects (`:397`).
- **Scenario:** A player closes the tab, or the phone drops off the network. Browsers send 1001 or the heartbeat terminates with 1006, never 1000. The seat stays. Every 5 s after a hand settles, a new hand starts, escrows `stake × 400` again and autoplays the absent player with `timeoutAction` for hours, until an escrow fails. That drains the balance of a player who has gone away. The same happens when a ticket is issued and the socket never connects. The table also stays in `rooms` and counts against `MAX_ROOMS`.
- **Test that catches it:** Seat a human, start a hand, close the socket with 1001 and never reconnect. Run timers through N hands (with a fake clock) and assert that the human is unseated, and no further escrow is taken, after at most one full hand (or a set number of hands) without a live socket.

#### I3: An Apple REFUND that arrives before the transaction is claimed is dropped, and the stale JWS then credits
- **Where:** `server/routes/play-currency.ts:75-77` (`refundApplePurchase` returns when there is no purchase row), `:263-266`, and the claim path at `:222-243`.
- **Scenario:** A user buys a pack on iOS and keeps the signed transaction JWS but does not let the app post it (offline, proxy, or a modified client). The user asks Apple for a refund. Apple sends a REFUND notification, there is no `play_purchases` row yet, and the server acknowledges it and does nothing. The user then posts the saved pre-refund JWS, which is still validly signed and has no `revocationDate`. The server credits the full pack and nothing ever takes it back. That is a free pack at Apple's refund rate.
- **Test that catches it:** With a stub verifier, post a REFUND notification for transaction `t1` with no prior claim. Then post `/apple/transactions` with a JWS for `t1` that has no `revocationDate`, and assert that it does not credit (status `refunded`, 409 or `credited:false`, balance unchanged). The fix this implies is to insert a tombstone `play_purchases` row with `status = 'refunded'` when the refund names an unknown transaction.

#### I4: Stripe play-pack refunds and chargebacks never take taels back
- **Where:** `server/routes/stripe.ts:216-414`. Only `checkout.session.completed` touches the play ledger (`:236-251`). No `charge.refunded`, `charge.dispute.created` or `charge.dispute.funds_withdrawn` branch exists for play packs. Apple has an equivalent path (`play-currency.ts:75-92`) and Stripe does not.
- **Scenario:** A user buys "The vault" (650,000 taels, $99.99), spends the taels on limited cosmetic serials or plays them, then files a card dispute or gets a refund through support. The taels and the limited serials stay with the user. Bilko loses the payment and the dispute fee, and the limited items are gone for other buyers.
- **Test that catches it:** In a webhook test, send a signed `checkout.session.completed` for a play pack, then a `charge.refunded` (and, separately, `charge.dispute.created`) whose `payment_intent` matches the session. Assert that `min(balance, taels)` is debited once with a fixed ref, that a replayed event debits nothing, and that a shortfall is recorded, mirroring the Apple refund.

### Minor

#### M1: An Apple refund shortfall is recorded but never collected; held or spent taels escape the clawback
- **Where:** `server/routes/play-currency.ts:82-92`.
- **Scenario:** A user buys taels, sits at a table (so most of the balance moves to `held`) or buys items, then refunds. The debit takes only `min(balance, taels)`. The remainder is written to `shortfall`, and later wins or releases are never charged against it. Taels have no cash-out, so the loss is free play value or items.
- **Test:** Credit an Apple pack, escrow most of it, deliver a REFUND notification, release the escrow, and assert that the released taels go toward the shortfall (or that the account is flagged).

#### M2: On a deploy overlap the new instance's first sweep releases the old instance's live escrows
- **Where:** `server/routes/rooms.ts:344` (a sweep at route registration) and `:231-241` (the room is considered live only if it is in this process's `rooms` map).
- **Scenario:** During a Render deploy, old and new instances overlap. The new process has no rooms, so its first sweep releases every held escrow older than 60 s, including hands still running on the old instance. The player can spend the released balance on the new instance. When the old hand ends, `settlePlayHand` finds no held escrow and the hand voids, so a losing player escapes the loss. The ledger stays consistent.
- **Test:** Hold an escrow for a ref whose room lives in a second registry instance, run `sweepOrphanedEscrows()` from the first, and assert that the escrow is not released (for example, the sweep honours a per-instance id in the ref or a heartbeat column).

#### M3: Room tickets travel in the URL query string
- **Where:** `server/routes/rooms.ts:369` and `server/rooms/socket.ts:576-580`.
- **Scenario:** Request URLs are often written to proxy or edge access logs. Anyone who can read those logs could replay a ticket within its 30 s life, but only if the owner has not used it yet. Single use and the short TTL limit this to a narrow window.
- **Test:** Assert that `handleRoomUpgrade` accepts the ticket from `Sec-WebSocket-Protocol` (or a first-frame auth message) and that no ticket appears in the returned `path`.

#### M4: The Apple notifications endpoint has no rate limit, and production verification makes outbound OCSP calls
- **Where:** `server/routes/play-currency.ts:248-268` and `server/services/apple-iap.ts:93`.
- **Scenario:** An unauthenticated client posts many 64 KiB payloads that look like JWS with a valid-looking chain. Each one costs signature work and, in production, can trigger OCSP requests to Apple. That is CPU and egress amplification on a free endpoint (CLAUDE.md asks for rate limits on free endpoints).
- **Test:** Post more than N notifications per minute from one IP and assert 429 before the verifier is called (spy on `verifyNotification`).

#### M5: With NODE_ENV not set to production and no webhook secret, an unsigned webhook credits any taels to anyone
- **Where:** `server/routes/stripe.ts:198-207` (shared with every branch) feeding `:236-251`.
- **Scenario:** On a staging or preview deploy that forgets `NODE_ENV=production`, anyone can post a forged `checkout.session.completed` with `play_pack` metadata and any `play_email`, and the taels are credited.
- **Test:** With `STRIPE_WEBHOOK_SECRET` unset and `NODE_ENV=test`, assert that unsigned events are refused unless an explicit `STRIPE_WEBHOOK_INSECURE_DEV=1` flag is set.

#### M6: A play pack paid by a delayed payment method is never credited
- **Where:** `server/routes/stripe.ts:242-243`. `payment_status` must be `'paid'` at `completed`, and `checkout.session.async_payment_succeeded` is not handled.
- **Scenario:** If the Checkout Session offers a delayed method (dynamic payment methods for MYR), the buyer pays and receives no taels. This harms the buyer, not the house.
- **Test:** Send `completed` with `payment_status: 'unpaid'` and then `checkout.session.async_payment_succeeded` with `paid`, and assert exactly one credit.

#### M7: Apple REFUND_REVERSED is ignored
- **Where:** `server/routes/play-currency.ts:61`.
- **Scenario:** Apple reverses a refund. The user paid but keeps the debit, and the purchase stays `refunded`.
- **Test:** REFUND then REFUND_REVERSED for the same transaction, and assert that the taels are re-credited once with a fixed ref.

#### M8: An Apple transaction is not bound to the Bilko account that bought it
- **Where:** `server/services/apple-iap.ts:101-113` (no `appAccountToken`) and `server/routes/play-currency.ts:228-235` (first poster wins).
- **Scenario:** Whoever first posts a signed transaction owns it. A purchaser can hand their JWS to another account, which is a paid gift path between users, and a leaked JWS (from logs or a device backup) can be claimed by a stranger before the purchaser's app posts it.
- **Test:** Issue a JWS whose `appAccountToken` is the user's id, post it as a different Clerk user, and assert 409.

#### M9: Sybil signup grants plus collusion at human tables move taels between users
- **Where:** `server/routes/play-currency.ts:110-115` (5000 taels per new Clerk account) and `server/routes/rooms.ts:389-397` (the newest waiting table of a tier is joined, so coordinated accounts land together).
- **Scenario:** A ring of free accounts, each holding 5000 grant taels, which covers a Tea-tier escrow of 2000, joins one table with a main account and deliberately loses to it. Grant taels pile up in one account and buy limited items. The value is low (5000 taels is about $0.99), but it is the only taels-between-users channel.
- **Test:** A policy test: grant-only taels can be marked non-transferable (for example, wins against an account younger than X days or with no purchase are capped), and assert the cap on settle.

#### M10: Sybil accounts can fill MAX_ROOMS
- **Where:** `server/routes/rooms.ts:29, 394`.
- **Scenario:** 200 grant-funded accounts each request a ticket at a different moment (or at a different tier once the waiting table is full) and never connect. With I2 these tables live indefinitely, so every other player gets 503 `server_full`.
- **Test:** Create `MAX_ROOMS` tables from distinct accounts with no socket, and assert that unconnected tables close after the ticket TTL plus the fill delay.

#### M11: The house is an unbounded, ledger-only counterparty
- **Where:** `server/routes/rooms.ts:185-187` and `server/services/play-currency.ts:93, 155-157`.
- **Scenario:** A player who beats the AI consistently, for example with a solver bot over the socket, mints taels from the house with no ceiling and no alert. This is by design, but nothing monitors it.
- **Test:** A house-exposure check: the sum of `play_ledger` rows for `account = 'house'` over a window, with an alert when it passes a threshold. Assert that the alert fires in a seeded test.

## Summary

- Critical: none.
- Important (for the fix wave): I1 (a released seat is still steerable), I2 (a non-1000 close keeps the seat forever), I3 (an Apple refund before the claim is lost), I4 (no Stripe refund or dispute clawback).
- Minor: M1 to M11.

SECURITY REVIEW: 0 Critical, 4 Important, 11 Minor
