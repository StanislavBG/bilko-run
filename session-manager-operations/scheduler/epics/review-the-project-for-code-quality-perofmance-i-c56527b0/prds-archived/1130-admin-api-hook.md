---
title: Admin UI: one hook for admin API calls, one admin check, one API base constant
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:08:11.542Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1ktdhy-60aef1
---
# Goal

primitive. `const API = import.meta.env.VITE_API_URL || '/api'` is redefined in ~10 files. The Clerk getToken plus Bearer-header fetch is copy-pasted ~14 times; AdminCostPage sends `Bearer null` when there is no token. The admin-email check is duplicated in 4 pages, and one of them doesn't lowercase. Create the shared pieces; later PRDs adopt them.

# Acceptance criteria

- [ ] src/constants.ts exports `API_BASE` (= import.meta.env.VITE_API_URL || '/api') next to ADMIN_EMAILS.
- [ ] New src/hooks/useAdmin.ts exports: `useIsAdmin()` (Clerk user email, lowercased, checked against ADMIN_EMAILS); `useAdminFetch()` returning `(path, init?) => Promise<Response>` that adds the Bearer token only when one exists and never sends 'Bearer null'; `useAdminResource<T>(path, opts?)` returning `{ data, error, loading, reload }` that surfaces errors instead of spinning forever; and an `<AdminGate>` component that renders children only for admins and a short 'Admins only' message otherwise.
- [ ] src/components/Layout.tsx uses the exported useIsAdmin instead of its private copy.
- [ ] `pnpm typecheck` and `pnpm build` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/constants.ts
- src/hooks/useAdmin.ts
- src/components/Layout.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. React 18 + @clerk/clerk-react. No React test runner is installed; typecheck plus build are the gate.

Read first: src/constants.ts; src/components/Layout.tsx lines 1-30 (private useIsAdmin); src/pages/AdminCostPage.tsx lines 30-70 (fetch pattern + Bearer null); src/pages/admin/SecretsPage.tsx lines 80-100.

Do not touch: any page file (wire PRDs adopt).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
