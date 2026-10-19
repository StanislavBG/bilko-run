---
title: Ship the web-products API to production, upload the v1.0.0 zip (hash-pinned) and verify every endpoint live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-11T04:41:15.086Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-buy-routes, wp-release-account-routes, wp-webhook-orders, wp-admin-stats, wp-admin-tab, wp-docs, launch-kit-catalog-entry]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

deploy: once every web-products code PRD and the catalog entry are on local main, push to origin main (StanislavBG/bilko-run; Render auto-deploys), wait for the deploy, upload the private Launch Kit zip to the production DB through the content-addressed PUT, and prove each endpoint behaves in production. Local main currently also carries other Epics' unpushed commits, so the merged tree must be fully tested before anything ships.

# Acceptance criteria

- [ ] Before pushing: `git fetch origin`, merge origin/main into the job branch (conflict-free only, otherwise FAIL), run `pnpm test` and `pnpm typecheck` on the merged tree (both green, else FAIL without pushing), and list in the record every commit in origin/main..HEAD that is not from this Epic's PRDs.
- [ ] `git push origin HEAD:main` succeeds (origin only, never the content-grade remote, no force); the pushed SHA and push time (America/Los_Angeles with PDT/PST) are recorded; GitHub Actions CI for it is polled at most 20 x 15s with `gh run list --commit <sha>` and its conclusion recorded.
- [ ] Bounded deploy poll (max 20 x 30s): GET https://bilko.run/api/web-products/launch-kit returns 200 JSON with version '1.0.0' (do not use /api/health uptime as the signal).
- [ ] `curl -sS --max-time 60 -X PUT -H 'content-type: application/zip' --data-binary @/home/bilko/Projects/Bilko-Launch-Kit/dist-pack/bilko-launch-kit-1.0.0.zip https://bilko.run/api/web-products/launch-kit/releases/1.0.0` returns 201 (or 409 on a re-run), after which the info endpoint reports available: true.
- [ ] Live negative checks: POST .../checkout returns a url starting https://checkout.stripe.com/; GET .../order?session_id=cs_live_aaaaaaaaaaaaaaaaaaaa returns 404; GET .../download?session_id=bad returns 400; GET .../account-download without auth returns 401; a second PUT returns 409; GET /api/admin/web-products without auth returns 401 or 403.
- [ ] session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-deploy-api.md is committed and pushed (origin only) with SHA, times, CI result and each check PASS/FAIL; any FAIL ends the run with SCHEDULER_VERDICT: FAIL and the reason.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-deploy-api.md

# Implementation notes

Read first: session-manager-operations/reviews/deploy/buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148/publish.md (prior deploy record format), shared/web-products.ts (the launch-kit entry), server/routes/web-products.ts (expected statuses).

Steps:
1. Fetch, merge origin/main, run the full suite and typecheck (criterion 1). If dist-pack/bilko-launch-kit-1.0.0.zip is missing, rebuild it with `node /home/bilko/Projects/Bilko-Launch-Kit/scripts/build-pack.mjs` and confirm its sha256 equals the catalog's before uploading.
2. Push; CI poll with the same `gh run list` command each time (bounded `for i in $(seq 1 20)`).
3. Deploy poll and upload. If the PUT returns 413/415/422, record the response body and FAIL — never retry with different bytes, never commit the zip.
4. Negative checks with `curl --max-time 15`. The checkout POST creates one unpaid, auto-expiring Stripe session and one checkout_start row — note that in the record.
5. Write the record, commit only it, `git pull --rebase origin main` if needed (conflict-free), push.

Never print or record secrets. Do not modify code; if a live check fails, record and FAIL.

# Out of scope

- Publishing the landing page (launch-kit-publish-landing)
- A real purchase (launch-kit-e2e-purchase)
- Code fixes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 curl -sf --max-time 15 https://bilko.run/api/web-products/launch-kit
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
