---
title: Link Sessions panel and Observability page into the Session View
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-18T19:21:05.835Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-view-page]
planId: pl-mve7llht-15f8de
---
# Goal

wire: make the new Session View reachable from the dashboard the owner already uses. Each row in the Sessions panel on /admin/observability gets an 'Open in Session View' link, and the Observability page header gets a 'Session View' link to /admin/sessions.

# Acceptance criteria

- [ ] In src/pages/admin/SessionsPanel.tsx, every session row and the open timeline header show a react-router <Link> labelled 'Open in Session View' to /admin/sessions/<session_id>. The existing inline timeline still works.
- [ ] In src/pages/admin/ObservabilityPage.tsx, the page header has a <Link> to /admin/sessions labelled 'Session View'.
- [ ] Clicking the row link does not also toggle the inline timeline (stopPropagation on the link).
- [ ] pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/SessionsPanel.tsx
- src/pages/admin/ObservabilityPage.tsx

# Implementation notes

Read first: src/pages/admin/SessionsPanel.tsx lines 180-261 (the row rendering and the onClick that selects a session); src/pages/admin/ObservabilityPage.tsx (the header markup near the start of the returned JSX); src/App.tsx (the /admin/sessions routes landed by PRD session-view-page).

Do not touch: SessionViewPage.tsx, SessionPlayer.tsx.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-svlinks --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
