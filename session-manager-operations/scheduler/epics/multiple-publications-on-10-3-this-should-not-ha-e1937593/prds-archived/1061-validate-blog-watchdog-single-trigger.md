---
title: Validate: single blog watchdog trigger docs
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T22:26:42.454Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
tag: build
agentType: validator
dependsOn: [blog-watchdog-single-trigger-docs]
planId: pl-musyopyr-19bd0f
---
# Goal

validate: blog-watchdog-single-trigger-docs (docs + script comments describe the systemd timer as the only trigger).

# Acceptance criteria

- [ ] blog-watchdog-single-trigger-docs (session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/prds/1060-blog-watchdog-single-trigger-docs.md, or prds-archived/) VERIFIED, including `crontab -l` has no blog-cadence-watchdog line and `systemctl --user is-enabled blog-cadence-watchdog.timer` prints enabled.
- [ ] Write and commit session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-watchdog-single-trigger.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-watchdog-single-trigger.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 45a960b

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
