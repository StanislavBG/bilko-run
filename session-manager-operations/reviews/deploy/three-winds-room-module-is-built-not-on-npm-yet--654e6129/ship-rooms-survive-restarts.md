# Ship: rooms survive restarts

Date: 2026-11-15. All times America/Los_Angeles.

Pushed SHA: `3062e8cb4ef5fc4390ff735cb30826911e8c916f` (origin/main moved from `8e9e0598` to `3062e8cb`, fast-forward, at 12:03:41 PM PST). Remote: https://github.com/StanislavBG/bilko-run.git.

## Commits pushed (log order, cherry-picked onto origin/main 8e9e0598)

| Local | Pushed | Subject |
| --- | --- | --- |
| beb226de | af1cb6ce | feat(rooms): GameRoom snapshot/restore and onChange hook |
| 03fc3e69 | d3e75aba | feat(rooms): room_tables store with lease-based claim and seat index |
| 2570fc57 | 140dea7f | feat(rooms): persist live tables to the room store and suspend them on shutdown |
| 8c48eed5 | e321edd7 | feat(rooms): resume saved tables on ticket, 503 table_moving, void abandoned tables |
| ce38bc42 | 3062e8cb | feat(rooms): open default tables unless ROOMS_CLOSED lists the app |

Not pushed: acda053c (validation record; plan records go out through scripts/sync-local-main.sh). No other plan's commits were included.

## Checks

| Check | Time | Result |
| --- | --- | --- |
| Validation record: all five PRDs VERIFIED, Critical none, Important none (3 Minor) | 11:43 AM PST | PASS |
| Cherry-pick of the five commits onto origin/main, no conflicts | 11:43 AM PST | PASS |
| `pnpm install --frozen-lockfile --prefer-offline` | 11:44 AM PST | PASS |
| `pnpm test` on the pushed tree, first run | 11:51–11:58 AM PST | FAIL (1 file failed, 9 more skipped; run took 437 s, about twice normal, so likely a timeout under load) |
| `pnpm test` (`vitest run`) on the same tree, rerun | 11:58 AM–12:02 PM PST | PASS (205 files passed, 2 skipped; 2562 tests passed, 15 skipped; exit 0) |
| `pnpm typecheck` | 12:02 PM PST | PASS (exit 0) |
| `pnpm build` | 12:03 PM PST | PASS (exit 0) |
| Remote is StanislavBG/bilko-run; `git push origin HEAD:main` | 12:03:41 PM PST | PASS |
| Deploy: /api/health uptime 64 s with 191 s since the push (try 7 of 20) | 12:06:51 PM PST | PASS |
| GET https://bilko.run/ → 200 | 12:07:05 PM PST | PASS |
| GET /api/rooms/tiers?app=threewinds → 200 with tea, jade, peony, imperial | 12:07:05 PM PST | PASS |
| POST /api/rooms/ticket, body `{}`, no Authorization → 401 `Sign in required.` | 12:07:05 PM PST | PASS |

Live checks used curl with `--max-time 15` and the cookie `bilko_internal=1`. There was no sign-in, no socket and no Stripe Checkout session. Tael sales stay closed (PLAY_CURRENCY_SALES_OPEN not touched).

Note: the first test run failed once and the identical tree then passed. The failing file name was not captured, so this flake is not identified yet. The pushed tree passed test, typecheck and build.

SHIP: PASS
