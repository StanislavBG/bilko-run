> Recovered from the job log: Ship PRD 1662 wrote this record, then its budget ran out during review before it committed it. Ship PRD 1709 committed it unchanged.

# Ship: obs-traffic-filters

SHIP: FAIL

The push, the deploy and all four API checks passed. The bundle check failed as written. It looks for the literal text 'EXCLUDING MINE' in a JavaScript file, but the code builds that text while the page runs, so it can never be in a served file. Details are under Checks. The seven commits are live on bilko.run.

Pushed SHA: 3f98b143ed1e2bad174d6f806fce000eeff1ca93 (origin/main, e875c83e..3f98b143, fast-forward, no force, origin only: StanislavBG/bilko-run)
Push time: 9:06:08 PM PST, 2026-11-07. Deploy seen live at 9:09:02 PM PST, 2026-11-07 (/api/health uptime 57s, below the 174s since the push; 6th of 20 tries). API checks at 9:09:21 PM PST, bundle crawl at 9:10 PM PST.

## Commits (cherry-picked from local main onto origin/main e875c83e in log order, no conflicts)
- 135a22dd feat(admin): owner and bot traffic filter helpers (was 8e3d8e74)
- 88fbd4d4 feat(admin): EXCLUDE MINE and BOT toggles in the observability header (was 8cf2cc98)
- d4412b24 feat(admin): mine and bots filters on /api/admin/traffic (was c2c44aad)
- 8922f754 feat(admin): mine and bots filters on /api/admin/sessions (was 977837e3)
- 141722fb feat(admin): mine and bots filters on /api/admin/flows (was fabcfb9c)
- d4794520 feat(admin): MINE badge on owner hits in the RECENT HITS ticker (was 1f33b09b)
- 3f98b143 feat(admin): observability console honors the MINE and BOT toggles (was f027fdba)

Each subject matched exactly once in `git log --no-merges 399f7c42..HEAD`, and none was on origin before the push. In the log, the header-toggles commit comes second, so the push followed log order rather than plan order. The cherry-picked patch is identical to c83bd05e..f027fdba (apart from index lines). origin had moved by two commits (d2e59329, e875c83e: blog withdraw and docs/repo-writers.md); they touch none of the plan's files. The other six commits in the range (blog, session-manager publish, Field Manual, ops) were on origin before this push. The validation-record commit (261abb85) was not pushed. e875c83e..origin/main is exactly these seven commits.

## Checks
- Validation record: all seven PRDs VERIFIED, Critical none, Important none: PASS
- pnpm test (176 files passed, 2 skipped; 1997 tests passed, 15 skipped), pnpm typecheck and pnpm build all exit 0 on 3f98b143, the pushed tree; git status was clean after each: PASS
- Push went only to origin (https://github.com/StanislavBG/bilko-run.git), with only these seven commits and no force: PASS
- Deploy live: /api/health uptime 57s, below the 174s since the push: PASS
- GET /api/admin/traffic?days=1&mine=exclude&bots=exclude: 200, filters {mine 'exclude', bots 'exclude', mineHits 28}; 106 recent rows, all with an isBot field, 0 with isBot true (0 with isMine true): PASS
- GET /api/admin/sessions?days=1&mine=exclude&bots=exclude: 200, filters {mine 'exclude', bots 'exclude'}: PASS
- GET /api/admin/flows?days=1&mine=exclude&bots=exclude: 200, filters {mine 'exclude', bots 'exclude'}: PASS
- GET /api/admin/traffic?days=1&self=exclude: 200, filters.mine 'exclude' (bots 'include', mineHits 28): PASS
- A JavaScript file served by bilko.run that holds both 'EXCLUDE' and 'EXCLUDING MINE': FAIL. The crawl used 26 fetches: the /admin/observability HTML and every JS file it imports, directly or through other files (25). Only https://bilko.run/assets/ObservabilityPage-CfE7pkix.js (200) holds 'EXCLUDE'. It has the same content-hash file name as the local build of 3f98b143, and it carries the EXCLUDE control (`V("EXCLUDE", …)`), its options `["MINE","BOT"]` and the amber indicator template `` `EXCLUDING ${u}` ``. No served file holds the literal 'EXCLUDING MINE', and neither does the local build of the pushed tree. src/pages/admin/command/CommandShell.tsx:284 renders `EXCLUDING ${excluded}`, where `excludedList` (:63) returns 'MINE', 'BOT' or 'MINE + BOT'. So 'EXCLUDING MINE' exists only on the rendered page. The check is wrong, not the code: the deployed bundle carries the control. A check that can pass would look for 'EXCLUDE' and `` `EXCLUDING ${ `` in the bundle, or read the rendered header in a signed-in admin session.

The responses and downloaded files are in /tmp/ship-obs-filters-live/, outside the repo and readable only by the owner's account. The admin key was sent only as a Bearer header through curl's standard-input config. It is not printed or saved in any file.
