---
title: Validate: blog cadence auto-recovery fix wave
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T08:28:36.467Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: build
agentType: validator
dependsOn: [blog-heartbeat-auto-retry]
planId: pl-mus4qaiv-8b53ae
---
# Goal

validate. Plan PRDs: blog-watchdog-catchup-spotlight (spotlight fallback mode-aware in catch-up), blog-watchdog-lock-after-publish (same-day lock only after a real publish), blog-heartbeat-auto-retry (heartbeat check auto-retries the watchdog on warn/error).

# Acceptance criteria

- [ ] blog-watchdog-catchup-spotlight: verify against session-manager-operations/scheduler/epics/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/prds/1019-blog-watchdog-catchup-spotlight.md (or prds-archived/)
- [ ] blog-watchdog-lock-after-publish: verify against .../prds/1020-blog-watchdog-lock-after-publish.md (or prds-archived/)
- [ ] blog-heartbeat-auto-retry: verify against .../prds/1021-blog-heartbeat-auto-retry.md (or prds-archived/)
- [ ] Write and commit session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-cadence-recovery.md

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-cadence-recovery.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 0364a52

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
