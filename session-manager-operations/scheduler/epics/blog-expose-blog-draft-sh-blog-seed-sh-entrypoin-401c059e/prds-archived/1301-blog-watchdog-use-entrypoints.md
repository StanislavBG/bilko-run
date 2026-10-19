---
title: Blog: watchdog delegates to blog-draft.sh / blog-seed.sh
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
sourcePromptId: blog-expose-blog-draft-sh-blog-seed-sh-entrypoin-401c059e
tag: feature
agentType: dev-lead
createdVia: scheduler-api
issuedAt: 2026-10-13T02:11:03.688Z
dependsOn: [1300-blog-seed-entrypoint]
planId: pl-mv61m6ql-0ceaeb
---
# Goal

Until Burrow cutover there must be one implementation of drafting and seeding. Refactor scripts/blog-cadence-watchdog.sh so its autonomous path calls scripts/blog-draft.sh (into a temp dir) and then scripts/blog-seed.sh on that bundle, instead of its own inline claude -p phase 1-7 prompt; heartbeat, lock, cadence gate and pending-drafts behaviour keep working.

# Acceptance criteria

- [ ] Autonomous publish path in blog-cadence-watchdog.sh invokes scripts/blog-draft.sh --out <tmp> --slot <NEXT_SLOT> then scripts/blog-seed.sh --bundle <tmp>; the duplicated inline seed/push/verify code is removed or reduced to calling the shared lib
- [ ] Exit mapping: draft skipped -> scan-only/heartbeat ok-or-stall as today; seed exit 3 -> no commit, heartbeat reflects cadence hold; other failures -> heartbeat error naming which script and rc; state lock kept only when blog-seed.sh returned 0
- [ ] Non-autonomous mode still leaves a reviewable draft in .claude/skills/blog-from-git/drafts/ (copy the bundle's post.md there with the existing front-matter fields) and never seeds
- [ ] Every claude -p reached from the watchdog still pins --model
- [ ] tests/blog-cadence-watchdog.test.ts updated to the new structure and an execution test with fake blog-draft.sh/blog-seed.sh covers drafted+seeded, skipped, and exit-3 paths; tests/blog-watchdog-env.test.ts and tests/blog-watchdog-heartbeat.test.ts still pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- scripts/blog-pipeline-lib.sh
- tests/blog-cadence-watchdog.test.ts
- tests/blog-watchdog-heartbeat.test.ts

# Implementation notes

Keep the daily scan-only path, next-slot gate (:505-597), and heartbeat semantics intact. Pending-drafts consumption (:610-760): convert each pending drafts/*.md into a bundle and seed it via blog-seed.sh, honoring max_posts_per_run. Allow BLOG_DRAFT_CMD / BLOG_SEED_CMD env overrides for tests only. Do not touch systemd timers.

# Out of scope

- Disabling blog-cadence-watchdog.timer or blog-watchdog-heartbeat-check.timer (needs explicit owner go-ahead after Burrow blog_publish is enabled)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 900 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-env.test.ts tests/blog-watchdog-heartbeat.test.ts tests/blog-draft.test.ts tests/blog-seed.test.ts
timeout 60 bash -n scripts/blog-cadence-watchdog.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
