---
title: Validate: every Launch Kit buy button starts Stripe checkout on the live page
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T20:17:02.366Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
tag: build
agentType: validator
dependsOn: [launch-kit-cta-checkout, launch-kit-cta-publish]
planId: pl-mv49k24v-9e85f3
---
# Goal

validate: verify the plan that makes every purchase CTA on https://bilko.run/projects/launch-kit/ start Stripe checkout — launch-kit-cta-checkout (sibling-repo CTA wiring, tests, screenshots, Bilko record) and launch-kit-cta-publish (bilko-host MCP publish and live per-CTA check).

# Acceptance criteria

- [ ] Each PRD file is at $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/web-product-i-want-to-try-something-diffenet-thi-b771332a/prds/<NN>-<slug>.md while queued, or under prds-archived/ (possibly a timestamped subfolder) once done; find each by slug.
- [ ] launch-kit-cta-checkout: VERIFIED or REFUTED against its own criteria and gate; the real work is in /home/bilko/Projects/Bilko-Launch-Kit (check its git log and files, re-run its gate with the absolute paths).
- [ ] launch-kit-cta-publish: VERIFIED or REFUTED. Re-check live yourself with headless Chromium, with the checkout POST and /api/analytics/** stubbed in-browser so that no real Stripe session is created: all 4 [data-buy] CTAs reach the stubbed checkout URL.
- [ ] Plan-wide: no .zip, SKILL.md or promo code is in Bilko's tracked files or in public/projects/launch-kit/.
- [ ] session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-launch-kit-cta.md is written and committed with one verdict line per PRD and any findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-launch-kit-cta.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 6b4d8373d17f40a9d4c044c74781b4ca07a74f07

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
