---
title: Split AdminPage (2): Sources, Funnels, Audience and Tools tabs into their own file
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:16:02.940Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [adminpage-split-1]
planId: pl-mv1ktdhy-60aef1
---
# Goal

migration. Step 2 of 3. Move the Sources, Funnels, Audience and Tools tabs out of src/pages/AdminPage.tsx into src/pages/admin/analytics/GrowthTabs.tsx. Each tab loads its own data with useAdminResource and uses the shared parts from src/pages/admin/analytics/parts.tsx (both landed by adminpage-split-1; read them first). The Tools tab's hardcoded, stale 'All Projects' list (~lines 944-955 originally) is replaced by data from src/data/projectsRegistry.ts.

# Acceptance criteria

- [ ] src/pages/admin/analytics/GrowthTabs.tsx exports SourcesTab, FunnelsTab, AudienceTab and ToolsTab with the same markup as before, each fetching its own data and showing errors.
- [ ] The Tools tab's project list comes from the registry (projectsRegistry), not a hardcoded array.
- [ ] The O(n²) `Math.max` inside `.map` in the Tools tab is computed once per render with useMemo.
- [ ] AdminPage.tsx no longer contains those tabs; `pnpm typecheck` and `pnpm build` pass; report the AdminPage.tsx line count.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/AdminPage.tsx
- src/pages/admin/analytics/GrowthTabs.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/pages/AdminPage.tsx (as landed); src/pages/admin/analytics/parts.tsx; src/hooks/useAdmin.ts. Do not touch: Synthetic/Manifests tabs (adminpage-split-3).

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
