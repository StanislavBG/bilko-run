# Ship: Three Winds binding plan (Epic 654e6129)

- Run: 2026-11-15 9:05 AM PST. origin/main at `f1d04bad` (fetched at run time).
- Pushed SHA: none. Nothing was pushed.

## Checks

| Check | Result |
| --- | --- |
| Validation record: all five PRDs VERIFIED | PASS (1792, 1793, 1794, 1795, 1796 all VERIFIED) |
| Validation record: no open Critical or Important finding | FAIL (0 Critical, 4 Important open: I1-I4) |
| Push to origin main | FAIL (not attempted; blocked by the check above) |
| pnpm test / typecheck / build on the pushed tree | FAIL (not run; no tree was pushed) |
| Deploy uptime below seconds since push | FAIL (not run) |
| GET https://bilko.run/ returns 200 | FAIL (not run) |
| GET /api/rooms/tiers?app=threewinds lists tea, jade, peony, imperial | FAIL (not run) |
| POST /api/rooms/ticket without Authorization returns 401 | FAIL (not run) |

## Why nothing shipped

`session-manager-operations/reviews/validation/three-winds-room-module-is-built-not-on-npm-yet--654e6129/validate-three-winds-binding.md`
lists four open Important findings, carried from the security review and not fixed in the tree:

- I1: a player released at hand start (escrow failure) keeps a live socket that can steer the now AI/house seat (`server/routes/rooms.ts`, `server/rooms/socket.ts`, `server/rooms/runtime.ts` act()).
- I2: a seat whose socket closes with any code except 1000 stays seated, re-escrowed and autoplayed hand after hand (`server/routes/rooms.ts` onSeatClose).
- I3: an Apple REFUND that arrives before the transaction is claimed is dropped, and the stale JWS later credits (`server/routes/play-currency.ts`).
- I4: Stripe play-pack refunds and disputes never claw taels back (`server/routes/stripe.ts`).

The ship criteria require no open Critical or Important finding, so this run pushed nothing.

## Commits that would ship (git cherry -v origin/main HEAD, log order)

Plan PRD commits:
- `780aba9c` feat(rooms): nextDealer, timeoutAction and deadlineMs module hooks; per-seat timers (1792)
- `d182dc25` fix(rooms): deal from HandResult.nextDealer; voided hand keeps dealer (1793)
- `b0a5cd00` feat(rooms): bind Three Winds engine under app id threewinds (1794)
- `388c78aa` test(rooms): real Three Winds engine redaction, settlement, R14.1, timeout and ledger tests (1795)
- `c9414606` test(rooms): allow the public R4.10 added-kong tile in the Three Winds redaction test (1795-fix)
- `17ee947f` docs(security): Three Winds rooms, play-currency and Apple IAP security review (1796)

Not this plan's (excluded): `bfd26a21` (publisher plan 1799-1802), `caee8de4` (validation record; records are published by scripts/sync-local-main.sh).

## Next step

Fix I1-I4 (or have the owner accept them in writing), re-validate, then re-run this ship PRD.

SHIP: FAIL
