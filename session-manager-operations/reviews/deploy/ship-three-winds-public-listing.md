# Ship: Three Winds public listing (PRD 1827)

Pushed SHA: 2bfc3ac61896a11a4e02f74b136bbae1294252f8 (origin/main, StanislavBG/bilko-run). Previous origin/main: 45d1a6ba.
Push time: 2026-11-15 10:55:52 AM PST. Fast-forward (`git push origin HEAD:main`, 45d1a6ba..2bfc3ac6), no rebase, no force. Remote: https://github.com/StanislavBG/bilko-run.git.

## Commits pushed
| SHA | Slug | Subject |
| --- | --- | --- |
| ba7c3dfb | og-card-cjk-fallback-font | fix(og-image): bundle Droid Sans Fallback for CJK titles; add CARD_RENDER_REV to card version |
| 7a58cfc6 | cmdk-public-projects-only | fix(palette): ⌘K lists only public projects for visitors; live count is public-only |
| 2bfc3ac6 | list-threewinds-public | feat(projects): set threewinds launchedAt and refresh commit sidecars |

origin/main was already an ancestor of HEAD, so no rebase and no re-run of typecheck/tests was needed.
Main checkout synced afterwards: `bash scripts/sync-local-main.sh` → `[sync-local-main] in sync at 2bfc3ac6`.

## Live checks (curl --max-time 15)
- og:image on https://bilko.run/projects/threewinds/ (poll, 30 s apart): tries 1-5 (10:56:00-10:58:00 AM PST) `https://bilko.run/og/threewinds.png?v=fc3ca476`; try 6 (10:58:30 AM PST) `https://bilko.run/og/threewinds.png?v=ac6789d2`: PASS
- GET https://bilko.run/og/threewinds.png?v=ac6789d2 : `200 image/png 96923` bytes: PASS
- GET https://bilko.run/api/projects : `[{'slug': 'threewinds', 'url': 'https://bilko.run/projects/threewinds/', 'name': 'Three Winds 三風'}]` (first try): PASS
- Extra: GET https://bilko.run/projects/threewinds/ : 200

## CI
`gh run list --branch main --limit 1`:
```
completed	success	feat(projects): set threewinds launchedAt and refresh commit sidecars	CI	main	push	43749512872	3m10s	2026-11-15T18:55:54Z
```
(run started 10:55:54 AM PST): PASS

SHIP: PASS
