---
title: Validate: cadence gate env restore
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T21:19:05.153Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
tag: build
agentType: validator
dependsOn: [blog-cadence-gate-env-restore]
planId: pl-musw9v82-5ceb50
---
# Goal

validate: blog-cadence-gate-env-restore (loadSeededPosts restores the three DB env vars in a finally).

# Acceptance criteria

- [ ] blog-cadence-gate-env-restore (session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/prds/<NN>-blog-cadence-gate-env-restore.md, or prds-archived/) VERIFIED, and the full `pnpm test` suite is green.
- [ ] Write and commit session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-cadence-gate-env-restore.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-cadence-gate-env-restore.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: bc88c34

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
