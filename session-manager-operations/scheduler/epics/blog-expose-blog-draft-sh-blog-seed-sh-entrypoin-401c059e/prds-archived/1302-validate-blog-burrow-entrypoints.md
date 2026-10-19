---
title: Validate Burrow blog entrypoints (1299-1301)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T02:11:16.161Z
sourcePromptId: blog-expose-blog-draft-sh-blog-seed-sh-entrypoin-401c059e
agentType: validator
dependsOn: [1301-blog-watchdog-use-entrypoints]
planId: pl-mv61m6ql-0ceaeb
---
# Goal

Validate PRDs 1299-blog-draft-entrypoint, 1300-blog-seed-entrypoint and 1301-blog-watchdog-use-entrypoints against the real tree and the Burrow contract (Burrow PRDs 1376/1378), once, after the last lands.

# Acceptance criteria

- [ ] Each PRD's gate re-run and passes
- [ ] Every acceptance criterion checked against the tree with one VERIFIED/REFUTED verdict per PRD
- [ ] Contract cross-check: blog-draft.sh args/result.json/post.md and blog-seed.sh args/exit 3/last-line JSON match /home/bilko/Projects/burrow/session-manager-operations/scheduler/epics/drafting-and-activity-queue-i-just-requested-a-n-e2871b7b/prds/1376-blog-slot-drafter.md and 1378-blog-publisher.md
- [ ] Every claude -p call under scripts/blog-*.sh pins --model
- [ ] Systemd blog timers were NOT disabled by this plan

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-draft.sh

# Implementation notes

Read-only. Run `pnpm typecheck` and the full blog test set. Check `systemctl --user is-enabled blog-cadence-watchdog.timer blog-watchdog-heartbeat-check.timer` still reports enabled.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 900 pnpm vitest run tests/blog-draft.test.ts tests/blog-seed.test.ts tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-env.test.ts tests/blog-watchdog-heartbeat.test.ts
timeout 600 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
