---
title: Push the coffee comeback to origin/main and verify /coffee and both CTAs live on bilko.run
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-11T01:37:05.790Z
sourcePromptId: buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148
agentType: dev-lead
dependsOn: [coffee-stripe-defaults, coffee-stripe-live-config, coffee-cta-main-site, coffee-cta-session-manager, coffee-docs]
planId: pl-mv35j362-c3a974
---
# Goal

validate-adjacent deploy: once the four code/doc PRDs and the Stripe config PRD have landed on main, push main to origin (StanislavBG/bilko-run, which Render auto-deploys) and prove the hook is real in production: /coffee redirects to the live Stripe payment link, the payment link serves a $5 checkout, and the main-site and Session Manager bundles contain the /coffee CTA. Record the evidence.

# Acceptance criteria

- [ ] main is pushed with `git push origin HEAD:main` (origin only, never the content-grade remote, no force) and the pushed SHA contains the commits of coffee-stripe-defaults, coffee-cta-main-site, coffee-cta-session-manager and coffee-docs.
- [ ] GitHub Actions CI for the pushed SHA is checked with a bounded poll (max 20 x 15s via `gh run list --commit <sha>`); its conclusion is recorded.
- [ ] Bounded poll (max 20 x 30s): `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 15 https://bilko.run/coffee` returns 302 with redirect https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d.
- [ ] `curl -sL --max-time 15 https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d` returns 200 (Stripe checkout page reachable).
- [ ] The live JS bundles referenced by https://bilko.run/ contain the string 'Buy me a coffee' in the chunk(s) for the Layout/HomePage and for the Session Manager page (find chunk names from the index HTML and the entry bundle's imports; same approach as the npx-repairs publish record).
- [ ] session-manager-operations/reviews/deploy/buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148/publish.md is committed and pushed with the SHA, push time (America/Los_Angeles, with PDT/PST), CI result and each live check PASS/FAIL. Any FAIL ends the run with SCHEDULER_VERDICT: FAIL and the reason.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148/publish.md

# Implementation notes

Read first: session-manager-operations/reviews/deploy/session-manager-page-add-back-the-npx-install-as-cfc175af/publish-repairs.md (prior record format to copy).

Steps:
1. `git fetch origin` and confirm HEAD is a fast-forward of origin/main; if not, `git pull --rebase origin main` only if it is conflict-free, otherwise FAIL with the reason. Never push to the `content-grade` remote.
2. Push, note the SHA and time.
3. CI poll (bounded, §1 pattern: `for i in $(seq 1 20)`).
4. Deploy poll: Render deploys take a few minutes; poll /coffee (bounded 20 x 30s) until it 302s to buy.stripe.com. Do NOT use /api/health uptime as the signal. If it never flips, record FAIL.
5. Bundle checks with curl --max-time 15.
6. Write and commit the record, push again (origin only).

Never print or record secrets. Do not modify code; if a live check fails, record and FAIL — don't fix.

# Out of scope

- Code changes or fixes
- Making a real payment

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 curl -sf -o /dev/null --max-time 15 https://bilko.run/products/session-manager
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
