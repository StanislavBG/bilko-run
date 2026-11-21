# Ship 2: checkout labels reach the funnel (plan people-start-to-pay-on-bilko-run-and-none-finish-1e17ed13)

## Validation

Record: `session-manager-operations/reviews/validation/people-start-to-pay-on-bilko-run-and-none-finish-1e17ed13/validate-checkout-labels-reach-funnel.md`

- click-burst-flags-automation-visitor: VERIFIED
- checkout-split-unlabeled-before-labels: VERIFIED

No Critical or Important findings; three Minor (burst backfill runs in a separate batch after the click insert; range includes an unrelated threewinds publish commit that is already on origin; no single end-to-end burst → checkout → admin test).

## Commits to push (local main ahead of origin/main, nothing else)

- a0a955a8 fix(analytics): click burst flags the cookie visitor as automation
- ad16e810 feat(admin): count pre-label checkout starts as unlabeled, not human
- 64d802c7 docs(validation): checkout labels reach funnel record
- plus this record's commit

Local main matched origin/main + these 3 commits (ahead 3, behind 0; b4e0b3f6 threewinds publish was already on origin), so `scripts/sync-local-main.sh` was not needed.
Remote: `origin` = https://github.com/StanislavBG/bilko-run.git (never content-grade). No force push.

## Pre-push state

- Checked 6:55 PM PST 2026-11-20: /api/health uptime 245 s (restarted by an earlier push at about 6:51 PM PST, not this wave).

## Push

- 6:56 PM PST 2026-11-20: `git push origin HEAD:main` → `b4e0b3f6..280164d3`. Pushed SHA: 280164d3 (fast-forward). PASS

## Deploy check

- Poll of https://bilko.run/api/health (curl --max-time 15, 30 s apart, max 20 tries): try 6 at 6:58 PM PST showed uptime 42 s, 154 s after the push (tries 1-5 showed the earlier ~263-383 s process). PASS
- https://bilko.run/ 200. PASS
- One read-only GET of /api/admin/web-products?days=7 (admin bearer): `checkoutStartsAll` = human 0, automated 0, unlabeled 24 — `unlabeled` is a number, so the new field is live. All 24 starts in the window predate the label cutoff (2026-11-21 02:39 UTC = 6:39 PM PST 2026-11-20). PASS
- This record's final update is pushed as a follow-up commit (docs only, no redeploy needed).

SHIP: PASS
