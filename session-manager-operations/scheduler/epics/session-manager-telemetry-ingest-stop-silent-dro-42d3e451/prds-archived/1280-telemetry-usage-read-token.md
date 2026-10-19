---
title: Session Manager usage endpoint: headless owner read via Bearer token
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-12T15:59:35.272Z
sourcePromptId: session-manager-telemetry-ingest-stop-silent-dro-42d3e451
tag: feature
agentType: dev-lead
dependsOn: [telemetry-env-read-filter]
planId: pl-mv5fnakk-fbfa8e
---
# Goal

feature: GET /api/admin/session-manager/usage only accepts a Clerk admin session (requireAdmin, server/clerk.ts), so the owner's local scripts and MCP cannot read it headlessly. Accept `Authorization: Bearer <token>` matching SM_USAGE_READ_TOKEN (dedicated read secret) or, as a fallback, PROJECT_SNAPSHOT_TOKEN (already held locally for the feedback/snapshot routes), compared in constant time; any other request falls through to requireAdmin unchanged (403 without valid auth).

# Acceptance criteria

- [ ] server/routes/admin-session-manager-usage.ts: hasReadToken(authHeader) returns true only for 'Bearer <x>' where x is non-empty and equals process.env.SM_USAGE_READ_TOKEN or process.env.PROJECT_SNAPSHOT_TOKEN (unset vars are skipped), compared with crypto.timingSafeEqual after a length check
- [ ] server/routes/admin-session-manager-usage.ts: the handler skips requireAdmin when hasReadToken is true and otherwise calls requireAdmin exactly as before (a Bearer that matches neither token is treated as a possible Clerk JWT)
- [ ] server/db.ts SECRET_NAMES includes 'SM_USAGE_READ_TOKEN' right after 'PROJECT_SNAPSHOT_TOKEN'
- [ ] tests/session-manager-usage.test.ts: with vi.stubEnv for both tokens, a request with either exact token gets 200 and windowDays 30 for ?days=30; a near-miss token, 'Bearer ' and no header each get 403 (requireAdmin mocked to refuse); vi.unstubAllEnvs in finally

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-session-manager-usage.ts
- server/db.ts
- tests/session-manager-usage.test.ts

# Implementation notes

Read first: server/routes/admin-session-manager-usage.ts lines 1-60 (handler start; telemetry-env-read-filter has already added env parsing there — read the landed file); server/routes/project-feedback.ts lines 105-117 (checkBearer, the existing PROJECT_SNAPSHOT_TOKEN pattern); server/db.ts lines 262-275 (SECRET_NAMES); tests/session-manager-usage.test.ts lines 1-60 (requireAdmin mock; extend `get(url, headers = {})` to pass headers to app.inject).

Reference implementation: /home/bilko/Projects/Bilko/session-manager-operations/logs/sm-telemetry-ingest.patch (absolute path, untracked; read, do not apply whole) — take the hasReadToken function + its call and the 'accepts the read token headlessly' test. Security: never log the token; never echo it in responses. The owner must set SM_USAGE_READ_TOKEN in the Render dashboard; until then PROJECT_SNAPSHOT_TOKEN works.

# Out of scope

- Token auth on /api/admin/observability routes
- Changing requireAdmin

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/session-manager-usage.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
