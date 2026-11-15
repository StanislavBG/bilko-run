# Ship: Three Winds binding, tables closed (PRD 1822)

Pushed SHA: b1932fd477c0f133e487ddcc5f172be7f8b0cbf4 (origin/main, StanislavBG/bilko-run). Previous origin/main: 120dab0a.
Push time: 2026-11-15 09:59:18 AM PST. Fast-forward, no rebase needed, no force.

## Pre-flight
- Validation record `validate-three-winds-binding-fixes.md`: all six PRDs VERIFIED (rooms-threewinds-test-timeouts, rooms-open-switch, room-seat-seq-window, rooms-open-docs, fix-rooms-threewinds-engine-tests, fix-ship-three-winds-binding); Critical none, Important none: PASS

## Commits pushed (log order; cherry-picked onto origin/main 120dab0a in /tmp/ship-three-winds-binding-closed)
| Source | Pushed | Subject |
| --- | --- | --- |
| f7f4b8f8 | 6189eac0 | feat(rooms): nextDealer, timeoutAction and deadlineMs module hooks; per-seat timers |
| cf8cfcb1 | 7d9ae0a3 | fix(rooms): deal from HandResult.nextDealer; voided hand keeps dealer |
| c1f125df | d7586288 | feat(rooms): bind Three Winds engine under app id threewinds |
| d66148a9 | 4ad3a5f1 | test(rooms): real Three Winds engine redaction, settlement, R14.1, timeout and ledger tests |
| daf95080 | fab7e5fa | test(rooms): allow the public R4.10 added-kong tile in the Three Winds redaction test |
| 2ffe139f | cfc18392 | fix(rooms): cut off released seats and unseat absent humans (I1, I2) |
| a655ac30 | 141535bf | fix(play-currency): tombstone an Apple REFUND that precedes the claim (I3) |
| bf638607 | 4603f3ea | fix(stripe): claw back play packs on refund or dispute (I4) |
| d08237cc | 1827d1ec | fix(rooms): clear a stale leaving entry when a seat is unseated |
| 6fb86dbb | d5087e12 | test(rooms): explicit 120s timeouts on Three Winds engine tests; compute redaction facts once per state |
| 7d6033a4 | 976377dd | fix(rooms): accept a seat's action on any seq since its own clock started |
| 1a87bf79 | 7de5a4c9 | feat(rooms): ROOMS_OPEN owner switch gates default-registry room endpoints |
| 8834070b | b1932fd4 | docs(rooms): document ROOMS_OPEN switch, 409 rooms_closed and the seq window |

Skipped (plan records, published by scripts/sync-local-main.sh): 7582ab77, 62c5a319. No other plan's commits were in `git cherry origin/main HEAD`.

## Gate on the pushed tree
- `pnpm install --frozen-lockfile --prefer-offline`: exit 0 (host-kit and mcp-host-server node_modules present; no symlinks needed): PASS
- `timeout 590 pnpm test`: exit 0, 201 files passed (2 skipped), 2532 tests passed (15 skipped), 119.7s; tests/spa-fallback-notfound-crash.test.ts passed: PASS
- `timeout 300 pnpm typecheck`: exit 0: PASS
- `timeout 590 pnpm build`: exit 0: PASS
- Push to origin only (remote URL https://github.com/StanislavBG/bilko-run.git): PASS

## Deploy
- /api/health uptime 765s at try 5, then 60.6s at try 6 (189s after the push), observed 10:02:27 AM PST: deploy landed: PASS

## Live checks (curl --max-time 15, cookie bilko_internal=1), 10:02:34 AM PST
- GET https://bilko.run/ : 200: PASS
- GET https://bilko.run/api/rooms/tiers?app=threewinds : 409 {"error":"rooms_closed"} (Three Winds is registered; an unknown app answers 404 unknown_app): PASS
- POST https://bilko.run/api/rooms/ticket, body {}, no Authorization : 401 {"error":"Sign in required."}: PASS
- Extra: GET https://bilko.run/projects/threewinds/ : 200

Tables stay closed (ROOMS_OPEN unset on Render); tael sales stay closed. Opening tables is the owner's step on a paid Render tier.

SHIP: PASS
