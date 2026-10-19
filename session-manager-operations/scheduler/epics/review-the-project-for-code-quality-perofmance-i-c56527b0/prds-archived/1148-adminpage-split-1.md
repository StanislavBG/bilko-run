---
title: Split AdminPage (1): shared analytics parts + Overview, Users, Roasts and Activity tabs into their own files
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-09T23:14:51.497Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [admin-api-hook]
planId: pl-mv1ktdhy-60aef1
---
# Goal

migration. src/pages/AdminPage.tsx is 1,107 lines: helpers, StatCard/BarChart, formatters, five near-identical fetch effects with `any` state, and ten tabs inline. Step 1 of 3: move the shared pieces (StatCard, BarChart, formatters, a Panel and LoadingState component, the Stats type) into src/pages/admin/analytics/parts.tsx. Move the Overview (~292-448), Users (~450-491), Roasts (~493-520) and Activity (~522-550) tabs into src/pages/admin/analytics/ActivityTabs.tsx, each tab fetching its own data via useAdminResource (from src/hooks/useAdmin.ts).

# Acceptance criteria

- [ ] src/pages/admin/analytics/parts.tsx holds StatCard, BarChart, the formatters, Panel, LoadingState and the typed Stats interface (no `any`).
- [ ] src/pages/admin/analytics/ActivityTabs.tsx exports OverviewTab, UsersTab, RoastsTab and ActivityTab; each renders the same markup as before and loads its own data with useAdminResource, showing an error instead of an endless 'Loading…'.
- [ ] AdminPage.tsx imports them and no longer contains those four tabs' JSX or the moved helpers; the other six tabs are untouched.
- [ ] `pnpm typecheck` and `pnpm build` pass; report AdminPage.tsx line count before and after.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/AdminPage.tsx
- src/pages/admin/analytics/parts.tsx
- src/pages/admin/analytics/ActivityTabs.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Pure extraction: keep classNames, text and behavior. Read first: src/pages/AdminPage.tsx lines 1-560; src/hooks/useAdmin.ts. Do not touch: tabs from Sources (~552) onward (adminpage-split-2/3), other admin pages.

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
