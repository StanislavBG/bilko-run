# Ship: bilko-hour-views

Pushed SHA: 4c4d68c4ee671521641b5aca5e6a341afe3e1eb7 (cherry-pick of 99891bcd) `fix(admin): count Bilko hour views on the /bilko page`
Push: origin (StanislavBG/bilko-run) main, ef8e1c93..4c4d68c4, 5:35 PM PST on 2026-11-02. Only this commit, from a throwaway tree on origin/main. No force.
Before numbers read 5:33 PM PST; after numbers read 5:39 PM PST (deploy seen live on the 7th poll, 30 s apart).

## Checks
- Validation record VERIFIED, no Critical/Important finding: PASS
- Commit on origin/main, nothing else pushed, origin only: PASS
- pnpm test (166 files passed, 1852 tests passed, 15 skipped), pnpm typecheck, pnpm build all exit 0 on the pushed tree: PASS
- Live bilko-hour views at exclude_self=0 >= 4 (4), daily rows sum to 4: PASS
- launch-kit and agent-factory-kit not below before (8 and 0, unchanged): PASS
- No pageview/click sent, no site page opened (GETs to /api/admin/web-products only): PASS

## Numbers (views / uniqueVisitors / daily sum), days=30

| product | exclude_self=0 before | exclude_self=0 after | default before | default after |
|---|---|---|---|---|
| launch-kit | 8 / 4 / 8 | 8 / 4 / 8 | 8 / 4 / 8 | 8 / 4 / 8 |
| agent-factory-kit | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| bilko-hour | 0 / 0 / 0 | 4 / 1 / 4 | 0 / 0 / 0 | 0 / 0 / 0 |

The default bilko-hour 0 is expected: the 4 rows are the owner's own visits, excluded at exclude_self=1.

SHIP: PASS
