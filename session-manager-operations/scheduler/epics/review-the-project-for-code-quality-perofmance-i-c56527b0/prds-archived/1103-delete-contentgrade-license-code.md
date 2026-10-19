---
title: Delete the ContentGrade license API and service from the host
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-09T21:29:41.770Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [stripe-retire-contentgrade-pro]
planId: pl-mv1hacoj-72fbb4
---
# Goal

migration. With license issuance gone from server/routes/stripe.ts (landed by stripe-retire-contentgrade-pro; read it first), server/routes/license.ts (public `GET /api/license/my-keys` and `POST /api/license/validate` for 'CG-' keys) and server/services/license.ts are dead ContentGrade code. Delete them, unregister the routes, and fix the comments that still describe the old contentgrade_pro fallback.

# Acceptance criteria

- [ ] server/routes/license.ts and server/services/license.ts are deleted. server/index.ts no longer imports or calls registerLicenseRoutes.
- [ ] `git grep -n -e services/license -e routes/license -e upsertLicenseKey -e validateLicenseKey -e getLicenseKeysForEmail` returns no hits in server/, shared/, src/ or tests/; the report pastes the command and its empty output.
- [ ] The comment in shared/manual-catalog.ts (~line 22) and the comments in tests/manual.test.ts (~lines 9 and 75) no longer describe a contentgrade_pro license fallback. No test assertion changes.
- [ ] The license_keys table and other DB schema in server/db.ts are untouched (no data drop).
- [ ] Full `pnpm test` and `pnpm typecheck` are green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/license.ts
- server/services/license.ts
- server/index.ts
- shared/manual-catalog.ts
- tests/manual.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko.

Read first: server/routes/license.ts; server/services/license.ts; server/index.ts lines 1-40 and 110-130; shared/manual-catalog.ts lines 15-30; tests/manual.test.ts lines 1-15 and 70-80.

Do not touch: server/routes/stripe.ts, server/db.ts, shared/product-catalog.ts.

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
