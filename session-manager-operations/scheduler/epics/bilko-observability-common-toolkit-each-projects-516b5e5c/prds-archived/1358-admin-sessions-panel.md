---
title: Admin Sessions panel: session list + click-through journey timeline
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-18T18:29:50.450Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [admin-sessions-api]
planId: pl-mve5lxlp-756161
---
# Goal

behavior: add the Session view to /admin/observability. It is a filterable list of recent sessions; clicking a session opens its journey, showing where the user landed, every page they went to across host and static-path apps, every click, every app event, and every error, in order. The data comes from GET /api/admin/sessions and GET /api/admin/sessions/:id.

# Acceptance criteria

- [ ] New src/pages/admin/SessionsPanel.tsx exports SessionsPanel. It fetches /api/admin/sessions with the same authenticated fetch helper TrafficPanel.tsx uses. Its filters are days (1/7/30), email, visitor and app text inputs, and it renders a table with columns: started (local time), user (email or short visitor id), landing to exit path, apps as badges, pages, clicks, events, errors, and duration.
- [ ] Clicking a row fetches /api/admin/sessions/:id and renders a vertical timeline. Each entry shows the time offset from session start (+m:ss), a kind badge (view/click/event/error, with errors visually distinct), the path, and the label, href, event name or error message as applicable. Clicks with a track_name show it.
- [ ] Loading, empty ('No sessions in this window') and error states are rendered, and a failed fetch never throws out of the component.
- [ ] src/pages/admin/ObservabilityPage.tsx renders <SessionsPanel /> directly above <TrafficPanel />.
- [ ] Styling uses the same Tailwind classes and patterns as TrafficPanel.tsx and works in both light and dark mode, using the same dark: variants TrafficPanel uses.
- [ ] pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/SessionsPanel.tsx
- src/pages/admin/ObservabilityPage.tsx

# Implementation notes

Read first: src/pages/admin/TrafficPanel.tsx (whole file, ~485 lines: the fetch helper, the table and timeline markup, and the TimelineEvent/VisitorResponse types to mirror); src/pages/admin/ObservabilityPage.tsx lines 1-20 and 200-225; server/routes/admin-sessions.ts (landed by PRD admin-sessions-api: the exact response shapes; define matching TS types locally in the panel).

Admin pages need a Clerk admin login, so a headless run cannot screenshot them. Proof is typecheck plus build plus following TrafficPanel's patterns.

Do not touch: TrafficPanel.tsx, server files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-sessions --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
