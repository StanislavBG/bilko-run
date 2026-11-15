# Validation: host-three-winds-online-mahjong-authoritative-ga (PRDs 1776-1787)

Base: fe487c4732bce4245b120445f2c31ebda7740773 (given in the PRD). 12 feature/docs commits found in `fe487c4..HEAD`, one per PRD. Diff: 49 files, +5141/-62.

Gate re-run (every PRD's gates combined, foreground):
- `pnpm vitest run` over the 14 gate test files: 14 files, 144 tests, all pass.
- `pnpm typecheck`: exit 0.
- Reviews: `/code-review` and `/security-review` were not run as separate commands; I self-reviewed the diff for authz, input handling, SQL, secrets and webhook trust. See Findings.

## play-ledger-core — VERIFIED
- server/db-schema.ts:643,651,661 play_balances, play_ledger, idx_play_ledger_account (IF NOT EXISTS).
- server/services/play-currency.ts:46,55,73 getPlayBalance/creditPlay/debitPlay exported with the stated signatures.
- tests/play-currency.test.ts (6 tests) passes: replayed credit, overdraft, bad input, app independence.

## play-ledger-escrow-settle — VERIFIED
- db-schema.ts:663 play_escrows. play-currency.ts:113 escrowPlay, :139 settlePlayHand, :211 releasePlayEscrow, :93 HOUSE_ACCOUNT.
- tests/play-currency-escrow.test.ts passes (settle, non-zero-sum refusal, loss over escrow, replays).

## play-currency-catalog — VERIFIED
- shared/play-currency-catalog.ts exists; tests/play-currency-catalog.test.ts (7 tests) passes. docs/host-internals.md:231 has the Three Winds line naming the file. Pack prices in docs/commerce.md:72-77 match the PRD (5000/99/490 … 650000/9999/44990).

## room-runtime — VERIFIED
- server/rooms/runtime.ts:10 RoomGameModule, :28 RoomMessage, :58 GameRoom. tests/rooms-runtime.test.ts passes: 50 seeded hands, redaction, illegal action, timeout autoplay, zero-sum guard.

## room-socket — VERIFIED
- socket.ts:41 isAllowedRoomOrigin, :65 issueRoomTicket, :115 registerLiveRoom, :240 handleRoomUpgrade, :265 closeAllGameRooms. Close codes 4002/4003/1012 at :26-35, frame cap 2048 at :21.
- index.ts:412 routes upgrades; shutdown.ts:59 calls closeAllGameRooms. tests/rooms-socket.test.ts and realtime-relay.test.ts pass.

## room-matchmaking — VERIFIED
- routes/rooms.ts:26 ROOM_MODULES, :328 registerRoomRoutes; index.ts:239 registers it. 402/404/429/503 at :353-391. Tiers route is no-store (:396). fillWithAi at :120/:140, escrow at hand start with insufficient_taels replacement at :134. tests/rooms-routes.test.ts passes.

## room-settlement — VERIFIED (see Minor 1)
- rooms.ts:166-195 settleHand builds entries, calls settlePlayHand, releases on void or error with one error log. NEXT_HAND_MS 5000 (:32). Sweeper: listHeldEscrows (play-currency.ts:202), sweepOrphanedEscrows (rooms.ts:227), timer unref (:340), 60 s age (:35). tests/rooms-settlement.test.ts passes.

## play-stripe-packs — VERIFIED
- routes/play-currency.ts:104 balance with signup_grant (:113), :121 checkout, 409 sales_closed (:135), 429 (:124). stripe.ts:236-250 credits only when paid and amount_subtotal matches the pack price, ref `stripe:<session id>`, separate from the wallet branch. tests/play-currency-stripe.test.ts and stripe-webhook-wallet.test.ts pass.

## apple-iap-verifier — VERIFIED
- package.json:56 @apple/app-store-server-library ^2.0.0. services/apple-iap.ts:9-19 embedded Root CA G3 with the pinned SHA-256 fingerprint (63:34:3A:…:79) checked via X509Certificate; getAppleVerifier :131; setAppleVerifierForTests :140. tests/apple-iap.test.ts passes (forged chain rejected).

## apple-iap-routes — VERIFIED
- db-schema.ts:674 play_purchases. routes/play-currency.ts:199 transactions (503 :212, 409 already_claimed :234), :248 notifications (400 invalid_notification, REFUND/REVOKE :61,:264, ref `apple_refund:` :79). tests/play-currency-apple.test.ts passes.

## play-entitlements — VERIFIED
- db-schema.ts:688 play_entitlements. play-currency.ts:238 purchasePlayItem, :271 listPlayEntitlements. Routes at play-currency.ts:169,:179. tests/play-entitlements.test.ts and play-currency-no-transfer.test.ts (forbidden-word regex over routes and service exports) pass.

## rooms-contract-docs — VERIFIED
- docs/host-contract.md:683 "Authoritative game rooms" (after "Realtime relay" :623), :811 "Three Winds", :828 "Play currency". docs/commerce.md:66 tael packs, 409 sales_closed note. docs/deployment.md:60 paid-tier requirement and PLAY_CURRENCY_SALES_OPEN stays unset. Gate is `none`; read only, and I did not check the interface text character-for-character against runtime.ts.

## Findings

### Critical
- none

### Important
- none

### Minor
1. server/routes/rooms.ts:172-176: AI seats are folded into one `house` entry per hand, where the PRD says one entry per AI seat. The ledger's UNIQUE (app, account, ref) forces this, and the rows still sum to 0. The PRD wording is the thing to correct.
2. Reviews: the standalone `/code-review` and `/security-review` skills were not run for this record. The self-review found no SQL interpolation, no secret exposure, and webhook credit is gated on paid status plus amount match. The Apple notifications route is unauthenticated by design and bounded by `bodyLimit` plus signature verification.
3. docs/host-contract.md prose was not diffed against runtime.ts character-for-character.
