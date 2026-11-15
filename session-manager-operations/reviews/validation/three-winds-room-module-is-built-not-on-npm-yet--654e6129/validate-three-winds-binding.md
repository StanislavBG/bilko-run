# Validation: Three Winds binding plan (Epic 654e6129)

- Date: 2026-11-15. Base: `5bf8370d6d2054d5e201df65d6215093510c00f5`. Validated at HEAD `17ee947f`.
- Base was known, so commits came from `git log base..HEAD`: `780aba9c` (hooks), `d182dc25` (dealer), `b0a5cd00` (bind), `388c78aa` + `c9414606` (engine tests), `17ee947f` (security review).
- PRD files found in `prds-archived/` (1792, 1793, 1794, 1795, 1795-fix, 1796).
- Gates re-run in this worktree: 6 files, 72 tests pass (`rooms-runtime`, `rooms-routes`, `rooms-settlement`, `rooms-socket`, `play-currency-catalog`, `rooms-threewinds`; 9.9 s). `pnpm install --frozen-lockfile` exit 0. `pnpm typecheck` exit 0. Security-review gate grep exit 0.
- `/code-review` and `/security-review` were not run as separate commands. I self-reviewed the combined diff (see Findings).

## room-module-hooks (1792): VERIFIED
- Hook members and doc comments: `server/rooms/runtime.ts:24-29`; `HandResult.nextDealer` at `:52`.
- finishHand passes nextDealer, falls back to `(dealer+1)%seats`, and voids on a throw or a non-integer or out-of-range value (`runtime.ts` finishHand, `nextDealer` calc and range check); a voided result carries no nextDealer.
- autoplay uses `timeoutAction` for non-AI seats, else `aiAction`; a throw voids (`runtime.ts` autoplay).
- Per-seat `seatTimers` with tokens; a seat still due keeps its timer, the actor and new seats get fresh ones; `deadlineMs` is validated as a positive integer, with null or undefined meaning turnMs; a throw or bad value voids (`runtime.ts` advance).
- `deadlineFor` implements own deadline for a due human, else the latest human deadline, else null.
- Tests present in `tests/rooms-runtime.test.ts:281-390`: nextDealer hook, fallback, throw or out-of-range, timeoutAction versus aiAction, deadlineMs and the turnMs default, and "seat A acting does not restart seat B's timer". All pass.
- Gate (4 room test files): exit 0.

## rooms-deal-next-dealer (1793): VERIFIED
- `TableRoom.dealer` is added, initialized to 0, and `startTableHand` calls `t.room.startHand(t.dealer)`. The onHandOver callback sets `t.dealer` only for a non-voided integer in range, before `settleHand` (`server/routes/rooms.ts`).
- The tests are in `tests/rooms-settlement.test.ts:193-213`: hook dealer, rotation 0,1,2,0, and the same dealer after a void.
- `docs/host-contract.md` diff: the module block shows the three hooks; the module rules say an invalid value voids the hand; the timing bullets and the `deadline` state row match the criteria.
- Gate: exit 0.

## rooms-bind-threewinds (1794): VERIFIED
- `package.json` has exactly `"@threewinds/engine": "npm:@bilkobibitkov/threewinds-engine@0.1.0"`.
- `pnpm-lock.yaml` has `integrity: sha512-O9EoKync/I3R7ov9zaylg55luWMIpm817l6PNbKVJLQMT9ovuJstXTan4lpFpuimtjr+KkZJpiChfPd67hk5+g==`, which matches the required value character for character.
- `server/rooms/modules.ts` exports `THREE_WINDS_CLAIM_MS = 4000` and `ROOM_MODULES = { threewinds }`. The binding spreads the engine module and uses the engine's `deadlineMs` when present, else claim-phase 4000. The R4.6 comment says to delete the fallback.
- `server/routes/rooms.ts` imports and re-exports `ROOM_MODULES`; the header no longer says it is empty.
- `docs/host-internals.md` Three Winds bullet lists `server/rooms/modules.ts` and the `@threewinds/engine` dependency.
- `tests/rooms-routes.test.ts`: the empty-modules test was replaced by key/id/seats/maxLossPoints, deadlineMs (claim = 4000, otherwise undefined) and tiers tests.
- Install and typecheck: exit 0. Gate: exit 0.

## rooms-threewinds-engine-tests (1795): VERIFIED
- `tests/rooms-threewinds.test.ts`:
  - redaction over 24 seeded 3-human hands (`:149-211`);
  - 120 all-AI hands for settlement and R14.1 (`:217`);
  - timeout and deadline behaviour (`:251`);
  - 5000-tael grant gets tea but 402 for jade with required 10000, and escrow 2000 (`:363-378`);
  - full socket hand with settled deltas equal to points x 5 (`:381-417`).
- No `.skip`, `.todo`, `xit` or `.only` in the four rooms test files (grep clean).
- The whole file runs in seconds, well under 60 s.
- The follow-up commit `c9414606` ("allow the public R4.10 added-kong tile") widens the redaction allowance. R4.10 makes that tile public, so it is a rule-correct allowance, not a weakened check. Noted as Minor.
- Gate: exit 0.

## rooms-play-currency-security-review (1796): VERIFIED
- The record exists and is committed (`17ee947f`) at `session-manager-operations/reviews/security/three-winds-room-module-is-built-not-on-npm-yet--654e6129/rooms-play-currency-security-review.md`.
- It lists all 8 required files and covers all required areas (identity, idempotency and refunds, escrow and settle atomicity and the sweeper, no taels transfer route, redaction, ticket single use/TTL/origin, socket limits and takeover, parameterized SQL). Each finding has severity, file:line, scenario and test.
- The last line is `SECURITY REVIEW: 0 Critical, 4 Important, 11 Minor`. I counted I1-I4 and M1-M11, which matches.
- I spot-checked I1 (`runtime.ts act()` does not check the AI set) and I2 (`rooms.ts onSeatClose` unseats only on code 1000). Both are real in the tree.

## Findings

### Critical
None.

### Important (open; carried from the security review, none is fixed in the tree)
- **I1** A player released at hand start (escrow failure) keeps a live socket that can steer the now AI/house seat. `server/routes/rooms.ts:135-139`, `server/rooms/socket.ts:507-508`, `server/rooms/runtime.ts:148-152`.
- **I2** A seat whose socket closes with any code except 1000 stays seated, re-escrowed and autoplayed hand after hand. `server/routes/rooms.ts:219-225`, `:211-216`.
- **I3** An Apple REFUND that arrives before the transaction is claimed is dropped, and the stale JWS later credits. `server/routes/play-currency.ts:75-77`, `:222-243`.
- **I4** Stripe play-pack refunds and disputes never claw taels back. `server/routes/stripe.ts:216-414`.

### Minor
- The security review's M1-M11 are open: Apple refund shortfall never collected (M1), deploy-overlap sweep (M2), ticket in the URL query (M3), no rate limit on the Apple notifications endpoint (M4), unsigned webhook outside production (M5), async payments not credited (M6), REFUND_REVERSED ignored (M7), Apple transaction not bound to the account (M8), Sybil grant collusion (M9), MAX_ROOMS fill (M10), unbounded house exposure (M11).
- `tests/rooms-routes.test.ts` logs "escrow sweep failed: No listHeldEscrows export on the play-currency mock" to stderr. The mock lacks the export that `registerRoomRoutes` now sweeps with. The tests pass, but the noise hides real sweep errors.
- Out-of-PRD commits in the range: `f1d04bad` (threewinds budget), `bfd26a21` (publish fails on gitignored files, with its own test, mcp dist rebuilt), and `.gitignore`. They belong to the publisher plan 1799-1802 and are not judged here.
- `c9414606` widens the redaction test for the public R4.10 tile (see 1795).

VALIDATION SUMMARY: all five PRDs verified; four Important findings open (I1-I4).
