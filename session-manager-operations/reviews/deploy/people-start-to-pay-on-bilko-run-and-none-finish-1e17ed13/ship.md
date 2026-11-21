# Ship: checkout starts labeled (plan people-start-to-pay-on-bilko-run-and-none-finish-1e17ed13)

## Validation

Record: `session-manager-operations/reviews/validation/people-start-to-pay-on-bilko-run-and-none-finish-1e17ed13/validate-checkout-starts-labeled.md`

- checkout-start-visitor-class: VERIFIED
- click-burst-marks-script: VERIFIED
- admin-checkout-starts-split: VERIFIED

No Critical or Important findings; two Minor (clicks without a session id skip the burst rule, as the PRD says; admin split query does one `page_views` lookup per row).

## Commits to push (local main ahead of origin/main, nothing else)

- 7adc431b feat(funnel): label checkout_start is_bot from the user agent
- 220314d3 feat(analytics): mark a session clicking two CTAs within 300 ms as a script
- 466b9572 feat(admin): split checkout starts and /coffee redirects into human and automated
- cdb5e052 docs(validation): checkout-starts-labeled record
- plus this record's commit

Local main matched origin/main + these 4 commits (ahead 4, behind 0), so `scripts/sync-local-main.sh` was not needed.
Remote: `origin` = https://github.com/StanislavBG/bilko-run.git (never content-grade). No force push.

## Pre-push state

- Checked 6:36 PM PST 2026-11-20: /api/health uptime 113883 s (about 31.6 h).

## Push

PENDING

## Deploy check

PENDING
