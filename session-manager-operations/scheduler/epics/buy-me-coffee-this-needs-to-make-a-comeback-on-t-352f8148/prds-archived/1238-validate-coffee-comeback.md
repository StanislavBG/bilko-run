---
title: Validate: bring "Buy me a coffee" back on bilko.run and the Session Manager page, backed by a real Stripe product
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T01:37:18.409Z
sourcePromptId: buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148
tag: build
agentType: validator
dependsOn: [coffee-stripe-defaults, coffee-stripe-live-config, coffee-cta-main-site, coffee-cta-session-manager, coffee-docs, coffee-publish-live-check]
planId: pl-mv35j362-c3a974
---
# Goal

validate: Verify the plan — coffee-stripe-defaults (/coffee reaches the live Stripe payment link and payments are attributed), coffee-stripe-live-config (live product/payment-link config), coffee-cta-main-site (footer + home hero CTA), coffee-cta-session-manager (Session Manager header CTA), coffee-docs (.env.example + CLAUDE.md), coffee-publish-live-check (pushed and verified live).

# Acceptance criteria

- [ ] coffee-stripe-defaults: every criterion in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148/prds/1232-coffee-stripe-defaults.md (or its prds-archived copy, found by slug) holds in the tree and its gate is green.
- [ ] coffee-stripe-live-config: criteria in .../prds/1233-coffee-stripe-live-config.md hold; re-check live with `stripe payment_links retrieve plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live` and `stripe products retrieve prod_V2Q4ego2oijqo4 --live`.
- [ ] coffee-cta-main-site: criteria in .../prds/1234-coffee-cta-main-site.md hold and its gate is green.
- [ ] coffee-cta-session-manager: criteria in .../prds/1235-coffee-cta-session-manager.md hold and its gate is green.
- [ ] coffee-docs: criteria in .../prds/1236-coffee-docs.md hold.
- [ ] coffee-publish-live-check: criteria in .../prds/1237-coffee-publish-live-check.md hold; independently re-run the /coffee 302 check against https://bilko.run/coffee.
- [ ] Record written and committed at session-manager-operations/reviews/validation/buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148/validate-coffee-comeback.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148/validate-coffee-comeback.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 37ffe61deeb285e7e79113eecfc178c2035b843e

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
