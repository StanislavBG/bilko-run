---
title: Traffic panel: raw hit log, visitors table and click-through visitor timeline
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:52:04.600Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [traffic-visitors-api]
planId: pl-mv64vt5k-acb57a
---
# Goal

wire. Surface the full-detail traffic data from PRD traffic-visitors-api in src/pages/admin/TrafficPanel.tsx so the owner can read a server-log style view of every hit, see each visitor (themselves marked), and open one visitor's full timeline of pages and clicks.

# Acceptance criteria

- [ ] TrafficPanel's 'Recent hits' table shows the 200 latest rows with local time (with zone abbreviation), path, status, IP, country, device/browser/OS, referrer, signed-in email and a 'you' badge when isAdmin; the full user-agent shows on hover (title attribute).
- [ ] A new 'Visitors' table lists the visitors array (visitor id short form, IP, country, device, email, hits, clicks, pages, first/last seen) with admin rows badged 'you'.
- [ ] Clicking a visitor row (or the visitor cell in Recent hits) fetches /api/admin/traffic/visitor/<id>?days=<days> and shows that visitor's merged hit/click timeline in an inline detail section with a close control.
- [ ] A 'Hide my own traffic' checkbox, unchecked by default, adds &self=exclude to the traffic fetch.
- [ ] Empty and error states follow the panel's existing treatment; pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/TrafficPanel.tsx

# Implementation notes

Read first: src/pages/admin/TrafficPanel.tsx (whole file; PRDs traffic-panel-ui and clicks-report), server/routes/admin-observability.ts /api/admin/traffic and /api/admin/traffic/visitor/:id handlers (PRD traffic-visitors-api) for the exact response shapes, src/pages/admin/BandwidthPanel.tsx for fetch/auth idiom.
Steps: extend the TS interfaces, add the table/section/checkbox. No new dependencies.
Do not touch: server/, src/pages/admin/ObservabilityPage.tsx.

# Out of scope

- Server changes
- Charts libraries

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 600 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
