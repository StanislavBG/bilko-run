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

- 6:36 PM PST 2026-11-20: `git push origin HEAD:main` → `4bd58cff..841f464b`. Pushed SHA: 841f464b32bb303803ebd56e82eb807e50879b42 (fast-forward). PASS

## Deploy check

- Poll of https://bilko.run/api/health (curl --max-time 15, 30 s apart, max 20 tries): try 6 at 6:39 PM PST showed uptime 37 s, 154 s after the push (tries 1-5 showed the old ~113,900 s process). PASS
- https://bilko.run/ 200, https://bilko.run/api/health 200. PASS
- This record's final update is pushed as a follow-up commit (docs only, no redeploy needed).

SHIP: PASS
