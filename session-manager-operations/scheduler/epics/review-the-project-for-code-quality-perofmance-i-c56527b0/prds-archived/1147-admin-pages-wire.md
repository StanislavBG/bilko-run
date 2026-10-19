---
title: Admin pages: AdminCostPage, SecretsPage and ObservabilityPage use the shared admin hook (fixes 'Bearer null')
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:14:43.235Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [admin-api-hook]
planId: pl-mv1ktdhy-60aef1
---
# Goal

wire. Adopt useAdminResource/useAdminFetch/useIsAdmin/AdminGate and API_BASE (from src/hooks/useAdmin.ts and src/constants.ts, landed by admin-api-hook; read them first) in src/pages/AdminCostPage.tsx, src/pages/admin/SecretsPage.tsx and src/pages/admin/ObservabilityPage.tsx. AdminCostPage only checks sign-in, not admin, and sends 'Bearer null' when there is no token. A failed fetch should show an error, not 'Loading…' forever.

# Acceptance criteria

- [ ] The three pages no longer define their own `const API = ...` or hand-rolled getToken/Authorization code; they use the hook.
- [ ] AdminCostPage is wrapped in AdminGate (admin-only), like the others.
- [ ] Each page shows an error message when its request fails.
- [ ] The duplicated drift badge / formatBytes helpers in ObservabilityPage are kept as they are (shared-util extraction is manual-page-hooks' job).
- [ ] `pnpm typecheck` and `pnpm build` pass; report the line count of the three files before and after.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/AdminCostPage.tsx
- src/pages/admin/SecretsPage.tsx
- src/pages/admin/ObservabilityPage.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/hooks/useAdmin.ts; the three page files. Do not touch: src/pages/AdminPage.tsx, src/pages/admin/BandwidthPanel.tsx.

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
