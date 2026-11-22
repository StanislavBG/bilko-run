# Ship: generic app backend forwarding (plan generic-app-backend-forwarding-projects-slug-api-d1c38cc7)

## Validation

Record: `session-manager-operations/reviews/validation/generic-app-backend-forwarding-projects-slug-api-d1c38cc7/validate-app-backend-forwarding.md`

- app-backends-config: VERIFIED
- app-backends-http: VERIFIED
- app-backends-socket: VERIFIED
- app-backends-wire: VERIFIED
- app-backends-docs: VERIFIED

No REFUTED entry.

## Commits to push (local HEAD ahead of origin/main, nothing else)

- 6499a77d feat(app-backends): add shared APP_BACKENDS config, URL and header helpers
- 05add576 feat(app-backends): HTTP forwarder for /projects/<slug>/api/*
- 1001f35a feat(app-backends): WebSocket forwarder for /projects/<slug>/api/*
- c08f6e1b feat(app-backends): wire APP_BACKENDS forwarders into the server and meter them per app
- b2d87891 docs(app-backends): document /projects/<slug>/api forwarding and APP_BACKENDS; recount tests
- 76315240 docs(validation): app-backend forwarding plan review
- plus this record's commit

`git cherry -v origin/main HEAD` after `git fetch origin main` at 8:54 AM PST 2026-11-22: ahead 6, behind 0, only this plan's commits, so no cherry-pick worktree and no `scripts/sync-local-main.sh` were needed.
Remote: `origin` = https://github.com/StanislavBG/bilko-run.git (never content-grade). No force push.

## Pre-push state

- Checked 8:54 AM PST 2026-11-22: /api/health 200 JSON, uptime 51021 s (old process).
- Baseline 8:34 AM PST 2026-11-22: /projects/threewinds/api/health 404 text/html, /projects/threewinds/ 200 text/html, /api/health 200 JSON.

## Push

- 8:54 AM PST 2026-11-22: `git push origin HEAD:main` → `511c8368..aba71688`. Pushed SHA: aba71688 (fast-forward, includes this record's first commit). PASS

## Deploy check

- Poll of https://bilko.run/api/health (curl --max-time 15, 30 s apart, max 20 tries): try 6 at 8:56:48 AM PST showed uptime 35 s, 155 s after the push (tries 1-5 showed the old 51037-51158 s process). PASS
- Live check at 8:56 AM PST 2026-11-22 (curl --max-time 15):
  - https://bilko.run/projects/threewinds/ → 200 text/html; charset=utf-8
  - https://bilko.run/projects/threewinds/api/health → 404 text/html (the app's own 404 page)
  - https://bilko.run/api/health → 200 application/json; charset=utf-8
- Case held: APP_BACKENDS unset. Every answer matches the 8:34 AM PST baseline. PASS
- This record's final update is pushed as a follow-up commit (docs only, no redeploy needed).

SHIP: PASS
