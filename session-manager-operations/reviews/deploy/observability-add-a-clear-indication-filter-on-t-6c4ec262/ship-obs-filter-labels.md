# Ship: obs-filter-labels (PRD 1711)

- Commit: `fix(admin): observability filter labels follow the applied server filters` (local main e658f386)
- Pushed SHA on origin/main: `061d0e95654b1c8673ff74db1eb7e277afef239f` (36c063dc..061d0e95, one commit, push to origin = StanislavBG/bilko-run only)
- Pushed from a throwaway tree (`/tmp/ship-obs-labels`, detached on origin/main, removed afterwards); no other local-main commit was pushed.

## Timeline (America/Los_Angeles)

- 2026-11-08 08:25 AM PST: validation record read; tree created on origin/main f13cbd9b; cherry-pick clean (e7d63a85).
- 08:26–08:29 AM PST: pnpm test, pnpm typecheck, pnpm build on f13cbd9b + fix: all exit 0.
- 08:29:16 AM PST: first push rejected (origin moved to 36c063dc, a docs-only ship record of another plan).
- 08:29:40 AM PST: rebased onto 36c063dc, pnpm typecheck exit 0, pushed 061d0e95.
- 08:30–08:33 AM PST: pnpm test (181 files passed, 2 skipped; 2110 tests passed, 15 skipped) and pnpm build re-run on the exact pushed tree 061d0e95: exit 0.
- 08:33:26 AM PST: /api/health uptime 52 s < 226 s since push: deploy landed.
- 08:33:38 AM PST: live checks run.

## Checks

- Validation record validate-obs-filter-labels.md VERIFIED, no Critical/Important finding: PASS
- Exactly one matching commit in 39228786..HEAD; not already on origin (git cherry `+`): PASS
- Cherry-pick without conflict: PASS
- pnpm test / pnpm typecheck / pnpm build exit 0 on the exact pushed tree 061d0e95: PASS
- Push to origin main only, only the fix commit: PASS
- Deploy live (uptime below seconds since push, 4th poll): PASS
- Live JS asset `/assets/ObservabilityPage-DL944DFk.js` (12 fetches from /admin/observability) contains `owner hits in this window` and `EXCLUDE`: PASS
- GET /api/admin/traffic?days=1&mine=exclude&bots=exclude (admin key, read-only): 200, filters.mine `exclude`, filters.bots `exclude`, filters.mineHits numeric (33): PASS

SHIP: PASS
