# Ship: traffic-cookie-same-ua (PRD 1740)

- Commit: `7b462979` "fix(traffic): a cookie seen under several user agents confirms nobody" (the only candidate in `origin/main..HEAD` for the 3 files; matches the validation record).
- Pushed SHA on origin/main: `93ddc01a2e786e2ca1701ddbab8e830cc36a7a00` (the cherry-pick, rebased once onto `f54a1491 publish: git-viewer build`, which landed on origin during the first push attempt).
- Remote: `origin` = github.com/StanislavBG/bilko-run, branch `main`. No force push. `origin/main` after the push: `45750220..93ddc01a` = `f54a1491` (another writer's) + `93ddc01a` (this commit only).

## Checks

| Check | Result |
| --- | --- |
| Validation record: traffic-cookie-same-ua VERIFIED, Critical none, Important none | PASS |
| One candidate commit, not already on origin (`git cherry` showed `+`) | PASS |
| Cherry-pick onto origin/main `45750220` in `/tmp/ship-cookie-same-ua` | PASS |
| `pnpm test` (183 files passed, 2 skipped; 2279 tests passed, 15 skipped), `pnpm typecheck`, `pnpm build` before push | PASS |
| First push rejected (origin moved to `f54a1491`); rebased, `pnpm typecheck` exit 0, second push accepted | PASS |
| Exact pushed tree `93ddc01a`: `pnpm test` (same counts) and `pnpm build` re-run after push, exit 0 | PASS |
| Deploy: `/api/health` uptime 106 s at 144 s after the push (11:07:46 PM PST), then a second restart at about 11:09 PM PST (uptime 55.6 s at about 11:09:56 PM PST); the second restart is taken as this commit's deploy, the first as `f54a1491`'s | PASS |
| `GET /api/admin/traffic?days=1&mine=exclude&bots=exclude` (admin Bearer, `bilko_internal=1`): numeric `totals.confirmedVisitors` <= `totals.visitors`, boolean `confirmed` on all 55 `visitors[]` rows | PASS |
| `https://bilko.run/` returns 200 | PASS |

## Counts (counts only)

| When | confirmedVisitors | visitors |
| --- | --- | --- |
| Before push, 11:01 PM PST 2026-11-12 | 4 | 55 |
| After deploy, 11:12:03 PM PST 2026-11-12 | 0 | 55 |

The drop from 4 to 0 shows the new rule is live: the 4 cookies confirmed before had been seen under more than one user agent, and a shared cookie no longer confirms anybody.

## Times (America/Los_Angeles)

- First push attempt (rejected): 11:05:03 PM PST 2026-11-12
- Push accepted: 11:05:22 PM PST 2026-11-12
- Live checks: 11:12:03 PM PST 2026-11-12

Throwaway tree `/tmp/ship-cookie-same-ua` and its node_modules symlinks removed.

SHIP: PASS
