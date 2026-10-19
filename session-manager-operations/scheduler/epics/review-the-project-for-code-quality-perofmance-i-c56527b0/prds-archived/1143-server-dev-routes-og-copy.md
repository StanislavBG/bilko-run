---
title: Dev server: register project-events routes in development too; neutral /projects share text
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:12:46.259Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [server-error-handler]
planId: pl-mv1ksmd2-85365b
---
# Goal

bug. server/index.ts registers registerProjectEventsRoutes only inside the production block where dist/ exists (~line 210), so /api/projects/... event routes 404 in `pnpm dev`, which confuses anyone testing locally. Also, the OG_OVERRIDES description for /projects still names specific tools (PageRoast, HeadlineGrader, AdScorer). It should describe the portfolio neutrally. Read the landed index.ts from server-error-handler first.

# Acceptance criteria

- [ ] Project-events routes are registered in both dev and production. The GET fallback that uses reply.sendFile still works in production; in dev without the static plugin it returns the existing 'no events' JSON or a 404 JSON instead of throwing. Explain in the report how sendFile availability is handled.
- [ ] The /projects OG description names no individual tools (e.g. 'Every project Bilko is building: live apps, games and tools, each in its own repo.').
- [ ] A test (tests/project-events.test.ts or a new tests/project-events-dev.test.ts) builds the app without dist and asserts the events GET does not 404 as an unknown route and does not throw.
- [ ] Full `pnpm test` green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/index.ts
- tests/project-events-dev.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/index.ts lines 160-300; server/routes/project-events.ts (sendFile fallback). Do not touch: server/routes/project-events.ts beyond a guarded sendFile check if strictly needed (it is owned by project-events-cache; this PRD runs after it only if you add it as needed — prefer index.ts-only changes).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 400 pnpm vitest run
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
