---
title: Validate: blog min-gap fix plan (no more same-day publications)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T19:12:14.323Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
tag: build
agentType: validator
dependsOn: [blog-cadence-gate-primitive, blog-api-scheduled-publishing, blog-cadence-remediate-10-03, blog-watchdog-wire-cadence-gate, blog-skill-docs-min-gap]
planId: pl-musroq7k-b96201
---
# Goal

validate: verify the plan fixing the 2026-10-03 double blog publication — blog-cadence-gate-primitive (cadence gate check/next-slot), blog-api-scheduled-publishing (future-dated posts hidden), blog-cadence-remediate-10-03 (OutdoorHours rescheduled to 2026-10-07T16:00Z), blog-watchdog-wire-cadence-gate (watchdog obeys gate, target [3,4]), blog-skill-docs-min-gap (override never bypasses min gap).

# Acceptance criteria

- [ ] blog-cadence-gate-primitive (session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/prds/1039-blog-cadence-gate-primitive.md, or prds-archived/) VERIFIED against its AC and gate.
- [ ] blog-api-scheduled-publishing (.../prds/1040-blog-api-scheduled-publishing.md) VERIFIED against its AC and gate.
- [ ] blog-cadence-remediate-10-03 (.../prds/1041-blog-cadence-remediate-10-03.md) VERIFIED, including live: after Render deploys origin/main, https://bilko.run/api/blog lists exactly one post dated 2026-10-03 (turn-your-github-year-into-a-heatmap-and-badge-wall) and does not list twelve-places-one-weather-rule-you-set-yourself (bounded poll, at most 20 x 15s).
- [ ] blog-watchdog-wire-cadence-gate (.../prds/1042-blog-watchdog-wire-cadence-gate.md) VERIFIED, including that `pnpm tsx scripts/blog-cadence-gate.ts next-slot` prints a timestamp >= 2026-10-10T16:00:00.000Z (3 days after the rescheduled post), so the watchdog cannot publish on 2026-10-07.
- [ ] blog-skill-docs-min-gap (.../prds/1043-blog-skill-docs-min-gap.md) VERIFIED against its AC and gate.
- [ ] Write and commit session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-min-gap.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-min-gap.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 3e91c9427ff01f167d5142f04844b5f58012fa69

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
