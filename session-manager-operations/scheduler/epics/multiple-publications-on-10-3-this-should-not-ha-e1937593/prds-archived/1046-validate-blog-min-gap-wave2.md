---
title: Validate: blog min-gap fix wave (legacy dates + live check)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T20:39:59.227Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
tag: build
agentType: validator
dependsOn: [blog-cadence-gate-legacy-dates]
planId: pl-musuvdc1-ca8285
---
# Goal

validate: blog-cadence-gate-legacy-dates (fixed historical published_at for 13 legacy seeds so the cadence gate check passes), plus re-check blog-cadence-remediate-10-03 live now that main was pushed to origin at a1d9d48.

# Acceptance criteria

- [ ] blog-cadence-gate-legacy-dates (session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/prds/1045-blog-cadence-gate-legacy-dates.md, or prds-archived/) VERIFIED against its AC and gate.
- [ ] blog-cadence-remediate-10-03 (prds-archived/1041-blog-cadence-remediate-10-03.md) re-checked live: https://bilko.run/api/blog lists only turn-your-github-year-into-a-heatmap-and-badge-wall on 2026-10-03 and does not list twelve-places-one-weather-rule-you-set-yourself (bounded poll, at most 20 x 15s); origin/main contains all plan commits.
- [ ] Write and commit session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-min-gap-wave2.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-min-gap-wave2.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: a1d9d48

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
