---
title: Cleanup: Sessions panel becomes list-only and powers the Session View picker; dark mode + apps fix
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-19T02:43:02.889Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [cleanup-session-player-format]
planId: pl-mvenf35m-a18aa0
---
# Goal

minimalism: SessionsPanel.tsx (on /admin/observability) still carries its own inline journey timeline, now a weaker duplicate of the Session View. SessionViewPage.tsx re-implements the same session list: row type, filters, debounced fetch and formatters. Make SessionsPanel list-only, with each row linking to /admin/sessions/:id, and reuse it as the Session View picker. Also fix the missing dark mode on the Session View page, its Apps header, and the colSpan typo.

# Acceptance criteria

- [ ] src/pages/admin/SessionsPanel.tsx renders only the filterable session list, with each row linking to /admin/sessions/<session_id>. The inline timeline (its detail fetch, the selected-session state, the describe/entryPath helpers and its TimelineItem type) is removed, and the colSpan={10}className typo around line 228 is fixed.
- [ ] SessionsPanel fetches through useAdminFetch from src/hooks/useAdmin.ts, keeping the debounce and cancellation, instead of a hand-built token fetch with a local API constant. It uses fmtTime and shortId from src/lib/format.ts.
- [ ] src/pages/admin/SessionViewPage.tsx renders <SessionsPanel /> as its /admin/sessions picker and no longer contains its own list, filters, row type or formatters. Its /admin/sessions/:id detail fetch also uses useAdminFetch.
- [ ] The Session View header shows apps from the API's apps field on /api/admin/sessions/:id (from PRD cleanup-admin-sessions-api), not from scanning events and errors.
- [ ] Every surface and text element in SessionViewPage.tsx has dark: variants matching SessionPlayer.tsx: rg -c 'dark:' src/pages/admin/SessionViewPage.tsx is at least 8.
- [ ] The /admin/observability page and /admin/sessions both still render the list. pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/SessionsPanel.tsx
- src/pages/admin/SessionViewPage.tsx

# Implementation notes

Read first: src/pages/admin/SessionsPanel.tsx (whole); src/pages/admin/SessionViewPage.tsx (whole); src/hooks/useAdmin.ts lines 1-60 (useAdminFetch, useAdminResource); src/lib/format.ts (fmtTime and shortId, landed by PRD cleanup-session-player-format); src/pages/admin/SessionPlayer.tsx (the dark-mode classes to match).

Do not touch: SessionPlayer.tsx, ObservabilityPage.tsx (it already mounts <SessionsPanel />), server files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-svlist --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
