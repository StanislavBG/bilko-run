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

- Pending.

## Deploy check

- Pending.
