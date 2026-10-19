---
title: Observability: report global cost alerts once, not once per app row
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T03:37:52.102Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: bug
agentType: dev-lead
planId: pl-mvepeuhy-686687
---
# Goal

behavior: GET /api/admin/observability currently copies every global cost alert (cost_alerts.app_slug IS NULL) into every row's openAlerts, and ObservabilityPage sums openAlerts across rows, so one global alert with 12 manifest rows shows as "12 alerts". Return global alerts once in a new top-level `globalAlerts` array, keep per-row `openAlerts` to that slug's own alerts, and make the page header count = sum of row alerts + globalAlerts.length. This is data-correctness groundwork for the Observability page redesign, which will consume the corrected shape.

# Acceptance criteria

- [ ] server/routes/admin-observability.ts GET /api/admin/observability: each row's openAlerts contains only alerts whose app_slug equals that row's slug (no app_slug IS NULL alerts).
- [ ] server/routes/admin-observability.ts GET /api/admin/observability: the response includes top-level `globalAlerts: { kind: string; details: string }[]` holding every open alert with app_slug IS NULL exactly once; all existing response fields (env, rows, desktopApps, latestKit, generatedAt) are unchanged.
- [ ] src/pages/admin/ObservabilityPage.tsx: ObservabilityResponse type gains `globalAlerts`, and openAlertCount = sum of rows[].openAlerts.length + (data.globalAlerts?.length ?? 0), so one global alert renders as "1 alert".
- [ ] tests/observability.test.ts: new tests seed cost_alerts with one global alert (app_slug NULL) plus one alert for slug A, with two manifest rows A and B, and assert: row A openAlerts has length 1, row B openAlerts has length 0, globalAlerts has length 1.
- [ ] tests/observability.test.ts: new test asserts GET /api/admin/blog-cadence returns 403 without admin auth (it currently has no coverage).
- [ ] docs/host-internals.md: the line that says auto-refresh defaults to 30s is corrected to say it defaults to 5m (options 30s, 1m, 5m, off), matching DEFAULT_REFRESH_MS in ObservabilityPage.tsx.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-observability.ts
- src/pages/admin/ObservabilityPage.tsx
- tests/observability.test.ts
- docs/host-internals.md

# Implementation notes

Read first:
- server/routes/admin-observability.ts lines 39-60 (safeQuery, endpoint start) and 120-186 (open cost_alerts query, row mapping; the bug is the `.filter(a => a.app_slug === slug || a.app_slug === null)` around line 178) and 540-586 (blog-cadence endpoint).
- src/pages/admin/ObservabilityPage.tsx lines 13-43 (Row, ObservabilityResponse types) and line 178 (openAlertCount).
- tests/observability.test.ts lines 1-110 (requireAdmin mock, DB setup that already runs `DELETE FROM cost_alerts`, the 403 auth test pattern at ~81-98).
- docs/host-internals.md around line 143 ("Auto-refresh defaults to 30s").

Steps:
1. tests/observability.test.ts: add the failing tests first (global alert dedupe; blog-cadence 403 without auth, following the existing 403 test for /api/admin/observability). Look at how existing tests insert into cost_alerts columns (app_slug, alert_kind, details_json, plus whatever marks it open — read the open-alerts query in admin-observability.ts to match its WHERE clause exactly).
2. server/routes/admin-observability.ts: change the per-row filter to `a.app_slug === slug`; compute `globalAlerts = alerts.filter(a => a.app_slug === null).map(a => ({ kind: a.alert_kind, details: a.details_json }))`; add `globalAlerts` to the returned object.
3. src/pages/admin/ObservabilityPage.tsx: add `globalAlerts?: { kind: string; details: string }[]` to ObservabilityResponse and update openAlertCount as in the criteria. No other UI change.
4. docs/host-internals.md: fix the one sentence.

Keep all SQL parameterized via the existing db helpers. Do not change requireAdmin wiring.

# Out of scope

- Any visual redesign of the Observability page (separate design-driven PRDs will follow).
- Rendering globalAlerts content anywhere beyond the header count.
- Changes to /api/admin/traffic, /egress, /observability/installs or /blog-cadence behavior.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/observability.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
