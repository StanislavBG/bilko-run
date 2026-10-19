---
title: Cleanup: shared admin formatters + Session player step identity + sessionSteps page origin
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T02:42:54.356Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [cleanup-admin-sessions-api]
planId: pl-mvenf35m-a18aa0
---
# Goal

behavior: three fixes from an independent review. First, the Session player's ?step value indexes the filtered list, so a shared link, or toggling All/Clicks-only, lands on a different step; make the step value the unfiltered Step.index. Second, an event or error with no current page starts a 'page' named after an app slug or a full URL; stop that. Third, time-formatting helpers are copy-pasted across admin files; move them into src/lib/format.ts.

# Acceptance criteria

- [ ] src/lib/format.ts exports fmtTime(ms), shortId(id) and fmtMmSs(ms), matching the existing implementations. SessionPlayer.tsx and FlowsPanel.tsx import them and no longer define local copies: rg -n 'function (fmtTime|shortId|fmtMmSs)' src/pages/admin/SessionPlayer.tsx src/pages/admin/FlowsPanel.tsx returns nothing.
- [ ] In SessionPlayer.tsx, initialStep and onStepChange use Step.index from the unfiltered buildSessionSteps output. Switching All to Clicks-only keeps the same step selected if it is visible, else the nearest earlier visible step. A ?step value then always names the same step whatever the filter.
- [ ] src/lib/sessionSteps.ts imports TimelineItem from shared/session-timeline.ts (added by PRD cleanup-admin-sessions-api) instead of defining it.
- [ ] In src/lib/sessionSteps.ts, an event or error that arrives before any page exists, or with no path, attaches to the current page, or to a single leading page with path '(before first page)' if none exists yet. It never starts a page named after an app slug or a URL containing a query string. tests/session-steps.test.ts gets a test for each case.
- [ ] pnpm typecheck, tests/session-steps.test.ts and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/lib/format.ts
- src/lib/sessionSteps.ts
- src/pages/admin/SessionPlayer.tsx
- src/pages/admin/FlowsPanel.tsx
- tests/session-steps.test.ts

# Implementation notes

Read first: src/lib/sessionSteps.ts (whole file; lines 55-70 are where pages start); src/pages/admin/SessionPlayer.tsx (whole file; lines 30-55 cover the step state and filter); src/pages/admin/FlowsPanel.tsx lines 15-25; src/lib/format.ts; shared/session-timeline.ts.

Do not touch: SessionsPanel.tsx and SessionViewPage.tsx. PRD cleanup-session-view-list owns them and adopts the formatters next.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/session-steps.test.ts
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-playerfmt --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
