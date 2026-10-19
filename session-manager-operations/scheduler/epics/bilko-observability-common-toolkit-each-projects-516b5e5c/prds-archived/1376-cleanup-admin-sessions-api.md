---
title: Cleanup: admin-sessions API — shared TimelineItem type, one app validator, safe LIKE escape, apps on :id
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T02:42:04.090Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
disposition: new-head
planId: pl-mvenf35m-a18aa0
---
# Goal

behavior: make the admin sessions API smaller and clearer, from an independent review. The session timeline item type is defined three times, so it moves to one shared module. Two different regexes validate the same app parameter, with different error behavior. The LIKE ... ESCAPE clause is added by patching SQL strings. And GET /api/admin/sessions/:id does not return the apps the session touched, so the Session View header shows apps incorrectly.

# Acceptance criteria

- [ ] New shared/session-timeline.ts exports the TimelineItem union (view, click, event and error, exactly as in server/routes/admin-sessions.ts lines 30-34 today). server/routes/admin-sessions.ts imports it and no longer defines it locally.
- [ ] server/routes/admin-sessions.ts uses one app-slug validator for both /api/admin/sessions and /api/admin/flows. An invalid app value returns 400 on both routes, and a test asserts the new 400 on /api/admin/sessions?app=bad%20slug.
- [ ] The email/visitor/app LIKE filters are built with their ESCAPE clause written directly into each pushed condition (e.g. `email LIKE ? ESCAPE '\\'`). No post-hoc .replace on the where array or SQL string remains (around lines 206-214), and all values stay bound parameters. The existing filter tests pass, and a new test shows a value containing % or _ is matched literally.
- [ ] GET /api/admin/sessions/:id returns apps: string[], computed by the same helper the list route uses. A test asserts it for a seeded session that only has page views under /projects/<slug>/.
- [ ] appSlugFromPath is no longer exported unless something outside the file imports it. pnpm typecheck and tests/admin-sessions.test.ts pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- shared/session-timeline.ts
- server/routes/admin-sessions.ts
- tests/admin-sessions.test.ts

# Implementation notes

Read first: server/routes/admin-sessions.ts (whole file, ~311 lines); tests/admin-sessions.test.ts; an existing shared/*.ts file (for example shared/game-config.ts) for the module style. shared/ is compiled by both the server and client tsconfigs.

Do not touch: src/lib/sessionSteps.ts, src/pages/admin/*. Sibling PRDs switch the client imports to shared/session-timeline.ts after this lands.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/admin-sessions.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
