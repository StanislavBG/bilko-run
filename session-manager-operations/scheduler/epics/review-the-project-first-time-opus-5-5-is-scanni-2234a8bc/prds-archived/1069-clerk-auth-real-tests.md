---
title: Real Clerk auth tests replace the regex-only auth.test.ts
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-04T08:57:07.845Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
disposition: new-head
planId: pl-mutl7n5x-338fbd
---
# Goal

behavior (test): tests/auth.test.ts only checks an email regex and one hard-coded admin email. verifyClerkToken, requireAuth and requireAdmin in server/clerk.ts are never tested, because every route test mocks server/clerk.js. Replace it with tests of the real functions, with only @clerk/backend mocked.

# Acceptance criteria

- [ ] New tests/clerk-auth.test.ts imports the real server/clerk.ts and mocks only @clerk/backend
- [ ] Covers verifyClerkToken: missing header and non-Bearer header return null; missing CLERK_SECRET_KEY returns null without calling Clerk; verifyToken throwing returns null; a valid token returns the user's email lowercased (and the cache path, if clerk.ts caches)
- [ ] Covers requireAuth replying 401 with no or invalid token, and requireAdmin replying 403 for a valid non-admin token and passing for an ADMIN_EMAILS member regardless of email case
- [ ] tests/auth.test.ts is deleted
- [ ] If a test exposes a real bug in server/clerk.ts, fix it minimally in server/clerk.ts and name it in the report

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- tests/clerk-auth.test.ts
- tests/auth.test.ts
- server/clerk.ts

# Implementation notes

Read first: server/clerk.ts (81 lines: verifyClerkToken, requireAuth, requireAdmin, ADMIN_EMAILS, isAdminEmail); tests/auth.test.ts; one route test that builds a Fastify app with app.inject, for the reply pattern (e.g. tests/project-feedback.test.ts).

Use vi.mock('@clerk/backend', ...) to stub whatever clerk.ts imports (verifyToken / createClerkClient). Set and restore process.env.CLERK_SECRET_KEY per test, and use vi.resetModules() if clerk.ts reads env at import time.

Do not touch: any other test file.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/clerk-auth.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
