---
title: Session View page: /admin/sessions picker + /admin/sessions/:id player route
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T19:20:52.576Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-player-component]
planId: pl-mve7llht-15f8de
---
# Goal

behavior: give the Session View its own admin page. /admin/sessions lists recent sessions to pick from, filterable by window, email, visitor and app. /admin/sessions/:id shows the session header and the SessionPlayer, so the owner can pick a user session and see what they clicked on the site in order. Deep links (?step=N) reopen at a specific step.

# Acceptance criteria

- [ ] New src/pages/admin/SessionViewPage.tsx exports SessionViewPage. It is admin-gated the same way ObservabilityPage.tsx is (useIsAdmin, with Navigate away for non-admins once Clerk has loaded).
- [ ] It is routed in src/App.tsx as lazy routes /admin/sessions and /admin/sessions/:id, next to the existing /admin/observability route.
- [ ] /admin/sessions shows a picker that fetches /api/admin/sessions with filters for days (1/7/30), email, visitor and app. Rows show the start time (local), the user (email or short visitor id), the landing to exit path, page and click counts, and the duration, and each row links to /admin/sessions/<session_id>.
- [ ] /admin/sessions/:id fetches /api/admin/sessions/:id and renders a header (user, start time, duration, landing, exit, apps, a back link to the picker) plus <SessionPlayer timeline startedAt initialStep onStepChange />.
- [ ] The ?step query param initializes initialStep, and onStepChange updates it with replace navigation, so the URL is shareable. A 404 or 400 from the API renders 'Session not found'; other failures render an error state without throwing.
- [ ] pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/SessionViewPage.tsx
- src/App.tsx

# Implementation notes

Read first:
- src/App.tsx lines 40-50 (lazyWithRetry imports) and 200-210 (admin routes)
- src/pages/admin/ObservabilityPage.tsx lines 1-12 and 107-110 (the admin gate pattern, useIsAdmin and useAdminResource from src/hooks/useAdmin.ts)
- src/pages/admin/SessionsPanel.tsx lines 69-130 (how it fetches /api/admin/sessions with the Clerk token; mirror that)
- src/pages/admin/SessionPlayer.tsx (landed by PRD session-player-component)

Do not touch: SessionsPanel.tsx, SessionPlayer.tsx, server files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-sessionview --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
