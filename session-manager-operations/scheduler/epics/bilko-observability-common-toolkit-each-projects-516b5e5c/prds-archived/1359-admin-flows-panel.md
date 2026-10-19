---
title: Admin Flows panel: per-app health tiles + flow funnels
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T18:30:09.393Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [admin-flows-api, admin-sessions-panel]
planId: pl-mve5lxlp-756161
---
# Goal

behavior: add the monitoring view to /admin/observability. It shows a health row per bilko.run app (sessions, views, clicks, events, errors) and a step funnel for each primary flow apps tag with trackFlow. The data comes from GET /api/admin/flows, which a prior PRD built, so an app owner can see whether their primary flows convert and whether their app is throwing errors.

# Acceptance criteria

- [ ] New src/pages/admin/FlowsPanel.tsx exports FlowsPanel. It fetches /api/admin/flows?days=N with the same authenticated fetch helper as SessionsPanel.tsx, with a days selector (1/7/30) and an app select populated from the response's apps.
- [ ] The app health table shows one row per app with sessions, views, clicks, events, errors and last seen. Rows with errors > 0 highlight the errors cell, and clicking an app sets the app filter.
- [ ] For each flow, the panel renders its steps as horizontal bars. Bar width is the step's sessions divided by the flow's top step's sessions, labeled with the step name, the session count and that percentage.
- [ ] Loading, error and empty states are rendered. The empty state says no flows are tagged yet and points to trackFlow in docs/observability.md.
- [ ] src/pages/admin/ObservabilityPage.tsx renders <FlowsPanel /> directly below <SessionsPanel />. It uses the same Tailwind and dark-mode patterns as SessionsPanel.tsx.
- [ ] pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/FlowsPanel.tsx
- src/pages/admin/ObservabilityPage.tsx

# Implementation notes

Read first: src/pages/admin/SessionsPanel.tsx (landed by PRD admin-sessions-panel: the fetch helper, styling and state handling to mirror); src/pages/admin/ObservabilityPage.tsx (where SessionsPanel is mounted); server/routes/admin-sessions.ts, the GET /api/admin/flows handler (landed by PRD admin-flows-api: the response shape; define matching TS types locally).

Keep the bars plain divs. Use no chart library and no new dependency.

Do not touch: SessionsPanel.tsx, server files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-flows --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
