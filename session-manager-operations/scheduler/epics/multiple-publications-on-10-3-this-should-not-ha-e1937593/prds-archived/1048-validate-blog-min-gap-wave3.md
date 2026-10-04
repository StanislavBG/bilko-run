---
title: Validate: blog min-gap wave 3 (test hardening)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T20:53:02.988Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
tag: build
agentType: validator
dependsOn: [blog-cadence-gate-test-harden]
planId: pl-musvc9ti-9eb5f3
---
# Goal

validate: blog-cadence-gate-test-harden (behavioural faked-clock test replaces the fragile regex scan for clock-stamped blog seeds).

# Acceptance criteria

- [ ] blog-cadence-gate-test-harden (session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/prds/<NN>-blog-cadence-gate-test-harden.md, or prds-archived/) VERIFIED, including independently re-proving the test goes red on a temporary `new Date().toISOString()` seed edit (reverted, not committed).
- [ ] Live https://bilko.run/api/blog still shows exactly one 2026-10-03 post and `pnpm tsx scripts/blog-cadence-gate.ts next-slot` prints 2026-10-10T16:00:00.000Z or later.
- [ ] Write and commit session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-min-gap-wave3.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-min-gap-wave3.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: f08fdee

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
