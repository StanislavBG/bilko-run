# Validation: Three Winds binding fixes (PRD 1821)

Base: e97b2d91. HEAD commits in scope: 6fb86dbb (timeouts), 7d6033a4 (seq window), 1a87bf79 (ROOMS_OPEN), 8834070b (docs). Reviews: self-review of the combined diff (correctness, input handling, secrets, path traversal, helper reuse).

## rooms-threewinds-test-timeouts: VERIFIED
- `tests/rooms-threewinds.test.ts:236,270,323` each end with `120_000`; `git diff e97b2d91..HEAD -- vitest.config.ts` is empty.
- Redaction test builds `factsFor(state)` once per state (`:175-200`) and reuses it for every seat's message; 24 hands, seed check, winnersTiles exemption, robKong exemption and `expect(robKongSeen).toBeGreaterThan(0)` (`:234`) remain.
- Gate run twice: 5/5 pass both times (redaction 545ms, 120 all-AI hands ~890ms, route test 777ms / 2250ms; whole file 3.0s / 4.5s).
- Not checkable: the "before" durations in the run report (no before-run is reproducible at HEAD).

## rooms-open-switch: VERIFIED
- `server/env-list.ts:8-11` exports `envListIncludes`, reads `process.env[name]` per call, splits on commas, trims, drops empties.
- `server/routes/play-currency.ts:7,28` uses it for `PLAY_CURRENCY_SALES_OPEN`.
- `server/routes/rooms.ts:395,443`: 409 `rooms_closed` right after the `unknown_app` check, only when `gated` (default registry); ticket check follows auth, body validation and rate limit.
- `tests/rooms-routes.test.ts:85-120` covers unset (409 both), `' threewinds , other'`, unknown app, env restore. `tests/rooms-threewinds.test.ts:372-385` sets and restores ROOMS_OPEN.
- Gate (rooms-routes, rooms-threewinds, play-currency, play-currency-stripe, rooms-settlement): pass (run together with runtime and socket: 7 files, 99 tests).

## room-seat-seq-window: VERIFIED
- `server/rooms/runtime.ts:153-160`: AI-seat and `not_your_turn` checks precede the seq check; accepts `startSeq <= seq <= this.seq` (integers only); `startSeq` recorded at `:238`.
- `tests/rooms-runtime.test.ts:460-476` proves a resent, too-old and future seq give `stale_seq`; the fixture `tests/fixtures/rooms-claim-game.ts` adds the 3-seat claim module.
- Gate (rooms-runtime, rooms-socket, rooms-settlement, rooms-routes) pass; `tests/rooms-threewinds.test.ts` also passes.

## rooms-open-docs: VERIFIED
- `docs/deployment.md` bullet names `ROOMS_OPEN=threewinds`, both endpoints answer `409 rooms_closed`, and keeps `PLAY_CURRENCY_SALES_OPEN` unset.
- `docs/host-contract.md`: 409 row in the ticket table, 409 on the tiers errors line, and the seq-window bullet (any seq from the latest turn or claim prompt; a resend is `stale_seq`). Matches `runtime.ts:157-159` and `rooms.ts:395,443`.
- Gate grep: pass. No other sections changed (diff is those three hunks).

## fix-rooms-threewinds-engine-tests (1795): VERIFIED
- Gate `timeout 300 pnpm vitest run tests/rooms-threewinds.test.ts tests/rooms-routes.test.ts`: pass at HEAD. Redaction exemption is narrow: `:177-183` checks `phase==='claim' && kind==='robKong'`, tile in declarer's hand, matches an exposed pong; `id !== robTile` only for seats other than `from` (`:193-199`).

## fix-ship-three-winds-binding (1798): VERIFIED
- `timeout 590 pnpm test`: exit 0, 201 files passed (2 skipped), 2532 tests passed (15 skipped), 122s. `tests/spa-fallback-notfound-crash.test.ts` passed here, so no separate finding.
- `timeout 300 pnpm typecheck`: exit 0.
- Record `1798-fix-ship-three-winds-binding.md` has I1-I4 FIXED lines and ends `IMPORTANT FINDINGS OPEN: 0`.

## Findings
### Critical
- none
### Important
- none
### Minor
- `server/rooms/runtime.ts:157`: a seat with no `seatTimers` entry falls back to the current seq as `startSeq`, so it can only act on the latest seq. Safe, and `toActNow` implies a timer exists in practice.
- The 1817 run report's before/after durations could not be re-verified from the tree.
