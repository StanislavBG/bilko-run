---
title: Remove two caller-less demo endpoints: /api/demos/email-capture and the headline-grader free-tier /unlock
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T16:36:17.601Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
agentType: dev-lead
disposition: new-head
planId: pl-mv2m98ox-7c1cc2
---
# Goal

behavior: Two server endpoints have no caller in any shipped bundle or sibling repo. POST /api/demos/email-capture was only used by the retired ContentGrade app. POST /api/demos/headline-grader/unlock is worse than dead: any request with a made-up email resets the caller's free-tier counter, which gives unlimited free Gemini calls. Delete both routes, along with any helpers that only they used, and add a test that keeps them gone.

# Acceptance criteria

- [ ] server/routes/tools/email-capture.ts is deleted (git rm) and server/routes/tools/index.ts no longer imports or calls `registerEmailCaptureRoutes`.
- [ ] server/routes/tools/headline-grader.ts no longer registers `POST /api/demos/headline-grader/unlock`; the scoring, compare and generate routes in that file are unchanged.
- [ ] In server/routes/tools/_shared.ts, `resetUsage` is deleted if `git grep -n resetUsage` shows no remaining caller (otherwise kept and noted), and the unused export `clearCeilingCache` is deleted. Imports left unused by these deletions (e.g. hashIp, dbRun, FREE_TIER_LIMIT, EMAIL_RE in headline-grader.ts) are removed only where nothing else in that file uses them.
- [ ] The `email_captures` table and its schema in server/db-schema.ts are NOT touched (existing data is kept).
- [ ] New test tests/retired-demo-endpoints.test.ts builds a Fastify app with the real tool route registrar from server/routes/tools/index.ts (follow how tests/tool-gateway-wire.test.ts builds its app and mocks the db/Gemini), and asserts `POST /api/demos/email-capture` and `POST /api/demos/headline-grader/unlock` both return 404, while `POST /api/demos/headline-grader` is still registered (status is not 404).
- [ ] `pnpm typecheck` and `pnpm test` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/email-capture.ts
- server/routes/tools/index.ts
- server/routes/tools/headline-grader.ts
- server/routes/tools/_shared.ts
- tests/retired-demo-endpoints.test.ts

# Implementation notes

Read first: server/routes/tools/index.ts (whole file); server/routes/tools/headline-grader.ts lines 1-30 and 60-90; server/routes/tools/_shared.ts lines 100-160 plus the `resetUsage` definition (`grep -n resetUsage server/routes/tools/_shared.ts`); tests/tool-gateway-wire.test.ts lines 1-60 for how an app with tool routes is built in tests.
Steps:
1. Write tests/retired-demo-endpoints.test.ts first and see it fail (red).
2. git rm server/routes/tools/email-capture.ts; edit index.ts.
3. Delete the /unlock route from headline-grader.ts; clean now-unused imports.
4. `git grep -n 'resetUsage\|clearCeilingCache'` across server, tests, src, scripts; delete what has no caller.
5. Run the gate.
Do not touch: server/db-schema.ts, server/db.ts, any other tool file, src/, packages/.

# Out of scope

- Dropping the email_captures table
- Changing free-tier limits

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
