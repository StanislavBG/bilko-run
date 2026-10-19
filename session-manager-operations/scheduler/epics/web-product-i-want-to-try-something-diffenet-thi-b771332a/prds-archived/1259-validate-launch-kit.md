---
title: Validate: Sell and deliver the $9 Bilko Launch Kit skill pack on bilko.run (web products v1)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T04:43:01.757Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
tag: build
agentType: validator
dependsOn: [wp-catalog, launch-kit-stripe, launch-kit-sources, wp-store, wp-buy-routes, wp-webhook-orders, launch-kit-skills-a, wp-release-account-routes, wp-admin-stats, launch-kit-skills-b, wp-admin-tab, launch-kit-package, wp-docs, launch-kit-landing-page, launch-kit-buy-flow, launch-kit-catalog-entry, launch-kit-deploy-api, launch-kit-publish-landing, launch-kit-e2e-purchase]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

validate: verify the plan that sells the $9 Bilko Launch Kit: web-products framework (wp-catalog, wp-store, wp-buy-routes, wp-webhook-orders, wp-release-account-routes, wp-admin-stats, wp-admin-tab, wp-docs), the pack in the private repo /home/bilko/Projects/Bilko-Launch-Kit (launch-kit-sources, launch-kit-skills-a, launch-kit-skills-b, launch-kit-package), Stripe (launch-kit-stripe), landing (launch-kit-landing-page, launch-kit-buy-flow), and going live (launch-kit-catalog-entry, launch-kit-deploy-api, launch-kit-publish-landing, launch-kit-e2e-purchase).

# Acceptance criteria

- [ ] Each PRD file is at $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/web-product-i-want-to-try-something-diffenet-thi-b771332a/prds/<NN>-<slug>.md while queued, or under prds-archived/ (possibly a timestamped subfolder) once done; find each by slug.
- [ ] 1239-wp-catalog: VERIFIED or REFUTED against its own criteria and gate.
- [ ] 1240-launch-kit-stripe: VERIFIED or REFUTED (read-only Stripe CLI retrieves with --live; the promo code value must not appear in the repo).
- [ ] 1241-launch-kit-sources: VERIFIED or REFUTED (sibling repo files and licenses).
- [ ] 1242-wp-store: VERIFIED or REFUTED.
- [ ] 1243-wp-buy-routes: VERIFIED or REFUTED.
- [ ] 1249-wp-webhook-orders: VERIFIED or REFUTED (1244-wp-webhook was archived unrun and replaced by this PRD; do not validate 1244).
- [ ] 1245-launch-kit-skills-a: VERIFIED or REFUTED.
- [ ] 1246-wp-release-account-routes: VERIFIED or REFUTED.
- [ ] 1247-wp-admin-stats: VERIFIED or REFUTED.
- [ ] 1248-launch-kit-skills-b: VERIFIED or REFUTED.
- [ ] 1250-wp-admin-tab: VERIFIED or REFUTED.
- [ ] 1251-launch-kit-package: VERIFIED or REFUTED (reproducible zip check).
- [ ] 1252-wp-docs: VERIFIED or REFUTED (docs match the landed code).
- [ ] 1253-launch-kit-landing-page: VERIFIED or REFUTED (no fabricated testimonials; credits present).
- [ ] 1254-launch-kit-buy-flow: VERIFIED or REFUTED.
- [ ] 1255-launch-kit-catalog-entry: VERIFIED or REFUTED (price id and sha256 match the records and releases/1.0.0.json).
- [ ] 1256-launch-kit-deploy-api: VERIFIED or REFUTED (re-check the live info endpoint reports available true).
- [ ] 1257-launch-kit-publish-landing: VERIFIED or REFUTED (live page 200; no .zip or SKILL.md under public/projects/launch-kit/ on origin/main).
- [ ] 1258-launch-kit-e2e-purchase: VERIFIED or REFUTED.
- [ ] Plan-wide: no paid content (SKILL.md bodies, the zip, the promo code or a full cs_live session id) exists anywhere in the Bilko repo's tracked files or history added by this plan.
- [ ] session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-launch-kit.md is written and committed with one verdict line per PRD and any findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-launch-kit.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: d38335231fb942c9a916336a0d44f1e05ccdfcb5

Sibling-repo PRDs (launch-kit-sources, -skills-a, -skills-b, -package, -landing-page, -buy-flow, -e2e-purchase) did their real work in /home/bilko/Projects/Bilko-Launch-Kit (a private local git repo); their Bilko commits are metadata records. Verify their criteria against that repo's files and git log, and re-run their gates (absolute paths).

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
