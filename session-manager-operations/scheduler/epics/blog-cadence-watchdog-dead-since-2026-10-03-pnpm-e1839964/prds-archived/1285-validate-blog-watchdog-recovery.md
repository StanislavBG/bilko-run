---
title: Validate: the blog watchdog runs under systemd again and a stuck watchdog alerts a human
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:06:07.471Z
sourcePromptId: blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964
tag: build
agentType: validator
dependsOn: [blog-watchdog-path-preflight, blog-heartbeat-escalate-to-human, blog-watchdog-live-recovery]
planId: pl-mv5x50j1-471a98
---
# Goal

validate. Verify the plan: blog-watchdog-path-preflight (Blog watchdog: put ~/.npm-global/bin on PATH and preflight every required binary), blog-heartbeat-escalate-to-human (Blog heartbeat checker: escalate a persistent or unfixable watchdog failure to a human), blog-watchdog-live-recovery (Blog watchdog: live recovery run and one real escalation check on this machine).

# Acceptance criteria

- [ ] blog-watchdog-path-preflight VERIFIED or REFUTED against its PRD at /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964/prds/1282-blog-watchdog-path-preflight.md (or prds-archived/ beside it; find by slug).
- [ ] blog-heartbeat-escalate-to-human VERIFIED or REFUTED against its PRD at /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964/prds/1283-blog-heartbeat-escalate-to-human.md (or prds-archived/ beside it; find by slug).
- [ ] blog-watchdog-live-recovery VERIFIED or REFUTED against its PRD in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964/prds/ (or prds-archived/; find by slug); also check the live /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/.watchdog-heartbeat does not read `error: cadence gate unavailable` and .watchdog.log has a post-fix next_slot= line.
- [ ] Write and commit session-manager-operations/reviews/validation/blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964/validate-blog-watchdog-recovery.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964/validate-blog-watchdog-recovery.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 71bc8190050c33d83f277b1c99d722f5ec2f29d1

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
