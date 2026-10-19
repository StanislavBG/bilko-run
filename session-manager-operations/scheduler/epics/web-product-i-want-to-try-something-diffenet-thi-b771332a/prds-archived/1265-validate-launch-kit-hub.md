---
title: Validate: Bilko Launch Kit is listed on the public bilko.run/projects hub
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T07:40:00.735Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
tag: build
agentType: validator
dependsOn: [launch-kit-hub-public, launch-kit-hub-commit-order, launch-kit-hub-deploy]
planId: pl-mv3idm9q-d23f06
---
# Goal

validate: verify the plan that lists the Bilko Launch Kit publicly on https://bilko.run/projects — launch-kit-hub-public (registry public flag and displayName, hub row enrichment, public-cards test), launch-kit-hub-commit-order (commit-order/commit-counts sidecar refresh), launch-kit-hub-deploy (push to origin main and live signed-out check).

# Acceptance criteria

- [ ] Each PRD file is at $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/web-product-i-want-to-try-something-diffenet-thi-b771332a/prds/<NN>-<slug>.md while queued, or under prds-archived/ (possibly a timestamped subfolder) once done; find each by slug.
- [ ] launch-kit-hub-public: VERIFIED or REFUTED against its own criteria and gate.
- [ ] launch-kit-hub-commit-order: VERIFIED or REFUTED (the sidecars came from scripts/refresh-commit-order.ts, not hand edits; both contain launch-kit).
- [ ] launch-kit-hub-deploy: VERIFIED or REFUTED — re-check live yourself with a signed-out headless browser: https://bilko.run/projects shows the 'Launch Kit' row and its open action reaches /projects/launch-kit/.
- [ ] session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-launch-kit-hub.md is written and committed with one verdict line per PRD and any findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-launch-kit-hub.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: da0047df4beb7741fa705736deaaf859c803c4b8

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
