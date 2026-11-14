# Ship: missing-pages (traffic-missing-paths, traffic-missing-paths-panel)

Pushed SHA: ba6a4e6ca4be61eff9e6840668d393bfbcb56e34 (origin/main of StanislavBG/bilko-run, from d9e64973)
Pushed: 2026-11-13 8:50:12 PM PST. Deploy observed: 2026-11-13 8:53:20 PM PST.

## Commits (cherry-picked from a throwaway tree on origin/main, in order)
- 455d43c87cfbffb0f781baa1e2c026469365b121 feat(admin-traffic): report top 404 paths as notFoundPaths (from 6dae1d67; server/routes/admin-observability.ts, tests/traffic-missing-paths.test.ts)
- ba6a4e6ca4be61eff9e6840668d393bfbcb56e34 feat(admin-traffic): MISSING PAGES list from notFoundPaths (from 3bcc7e76; src/pages/admin/command/TrafficModule.tsx, src/pages/admin/command/types.ts, tests/obs-command-missing-pages.test.ts)

No other commit pushed.

## Checks
- PASS validation record: both PRDs VERIFIED; Critical none, Important none.
- PASS cherry-pick onto origin/main: no conflicts.
- PASS pnpm test on the pushed tree: 185 files passed, 2 skipped; 2310 tests passed, 15 skipped.
- PASS pnpm typecheck on the pushed tree: exit 0.
- PASS pnpm build on the pushed tree: exit 0.
- PASS push: origin only (StanislavBG/bilko-run), fast-forward d9e64973..ba6a4e6c, no force.
- PASS deploy: /api/health uptime 60 s at 188 s after the push (try 7 of 20).
- PASS GET /api/admin/traffic?days=1&mine=exclude (admin Bearer, bilko_internal=1): 200; notFoundPaths is an array of 25 rows, each with numeric hits, botHits, visitors.
- PASS https://bilko.run/: 200.

## Live notFoundPaths (25 rows; top 5)
| path | hits | botHits | visitors |
| --- | --- | --- | --- |
| /favicon.ico | 31 | 3 | 25 |
| /.env | 11 | 11 | 9 |
| /wp-admin/install.php | 11 | 11 | 1 |
| /.well-known/security.txt | 10 | 8 | 7 |
| /.git/HEAD | 6 | 6 | 5 |

SHIP: PASS
