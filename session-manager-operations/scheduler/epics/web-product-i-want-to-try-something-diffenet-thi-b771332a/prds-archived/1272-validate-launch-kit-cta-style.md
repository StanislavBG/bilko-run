---
title: Validate: the Launch Kit page's four buy buttons look consistent and still reach checkout, live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T21:51:29.731Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
tag: build
agentType: validator
dependsOn: [launch-kit-cta-style, launch-kit-cta-style-publish]
planId: pl-mv4cxsw1-4fe9c4
---
# Goal

validate: verify the plan that gives every buy button on https://bilko.run/projects/launch-kit/ one consistent style: launch-kit-cta-style (sibling-repo markup and CSS, style-consistency test, screenshots, Bilko record) and launch-kit-cta-style-publish (bilko-host MCP publish and live style and checkout checks).

# Acceptance criteria

- [ ] Each PRD file is at $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/web-product-i-want-to-try-something-diffenet-thi-b771332a/prds/<NN>-<slug>.md while queued, or under prds-archived/ (possibly a timestamped subfolder) once done; find each by slug.
- [ ] launch-kit-cta-style: VERIFIED or REFUTED against its own criteria and gate. The real work is in /home/bilko/Projects/Bilko-Launch-Kit: check its git log and files, and re-run its gate with absolute paths. Look at the committed screenshots yourself.
- [ ] launch-kit-cta-style-publish: VERIFIED or REFUTED. Re-check live yourself in headless Chromium, with the checkout POST and /api/analytics/** stubbed in-browser so no real Stripe session is created: the 4 [data-buy] buttons share computed fill, text colour, font and radius, and each reaches the stubbed checkout URL.
- [ ] session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-launch-kit-cta-style.md is written and committed with one verdict line per PRD and any findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-launch-kit-cta-style.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 1f71c8c7cd5464fe4211cf942ea4211589d603f6

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
