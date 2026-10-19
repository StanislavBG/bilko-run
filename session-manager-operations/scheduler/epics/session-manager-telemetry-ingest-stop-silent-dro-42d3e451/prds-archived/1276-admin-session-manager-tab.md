---
title: Admin dashboard: Session Manager tab rendering the remote-install usage summary
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-12T15:56:12.722Z
sourcePromptId: session-manager-telemetry-ingest-stop-silent-dro-42d3e451
tag: feature
agentType: dev-lead
disposition: new-head
planId: pl-mv5fpeeq-08b4a9
---
# Goal

feature: GET /api/admin/session-manager/usage (server/routes/admin-session-manager-usage.ts) already returns installs, usage, issues and errors for Session Manager remote installs, but nothing in src/ calls it, so nobody looks at the data. Add a 'session manager' tab to the /admin dashboard that renders that summary, with an env picker (prod default) so test/dev traffic can be inspected separately.

# Acceptance criteria

- [ ] New file src/pages/admin/analytics/SessionManagerTab.tsx exports SessionManagerTab({days, excludeSelf}) that fetches `/admin/session-manager/usage?days=${days}&env=${env}` via useAdminResource from src/hooks/useAdmin.ts and shows LoadingState from ./parts.js while loading or on error
- [ ] SessionManagerTab renders KPI cards for installs total (with new7), active 7d, active 30d, launches, sessions and epics summed over usage.daily, and median machine (GB RAM, CPUs)
- [ ] SessionManagerTab renders tables for installs.byVersion, installs.byPlatform, issues (name: msg, installsAffected, occurrences, versions, topPlatform, lastSeen in America/Los_Angeles with zone abbreviation), usage.byVersion, errors.byVersion and usage.daily, each with an empty-state line
- [ ] SessionManagerTab has an env picker with buttons prod/dev/test/all, default prod, styled like the AdminPage day buttons (bg-fire-500 active, bg-warm-100 inactive)
- [ ] src/pages/AdminPage.tsx adds 'session manager' to TABS after 'products' and renders <SessionManagerTab days={days} excludeSelf={excludeSelf} /> for it

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/analytics/SessionManagerTab.tsx
- src/pages/AdminPage.tsx

# Implementation notes

Read first: src/pages/admin/analytics/WebProductsTab.tsx (whole file — copy its structure, card/table classes and PT_FORMAT Intl.DateTimeFormat with timeZone 'America/Los_Angeles', timeZoneName 'short'); src/pages/AdminPage.tsx (TABS const, tab render list); server/routes/admin-session-manager-usage.ts lines 225-290 (the response object — mirror it as a TypeScript interface UsageResponse; timestamps firstSeen/lastSeen/generatedAt are epoch SECONDS); src/pages/admin/analytics/parts.tsx line 141 (LoadingState).

Steps:
1. Create SessionManagerTab.tsx with a local UsageResponse interface, small Kpi / Panel / Table helper components, useState<'prod'|'dev'|'test'|'all'>('prod') for env.
2. The server does not yet honour ?env= (a sibling PRD adds it and an `env` field in the response); treat `env` in the response as optional and always send the query param — unknown params are ignored by the current server.
3. Wire the tab into AdminPage.tsx (import, TABS entry 'session manager', render line).
No server changes. No new tests (the project's test policy excludes UI snapshot tests); typecheck is the gate.

# Out of scope

- Server route changes
- Charts/visualisation libraries — plain tables only

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
