---
title: Validate: /admin/observability shows real server-side traffic and clicks for every page
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
tag: build
agentType: validator
createdVia: scheduler-api
issuedAt: 2026-10-13T03:42:47.606Z
dependsOn: [page-hits-recorder, page-hits-wire, traffic-admin-api, click-events-endpoint, traffic-panel-ui, click-beacon-injection, clicks-report, page-hits-full-detail, click-events-full-detail, traffic-visitors-api, traffic-visitors-ui]
planId: pl-mv64vt5k-acb57a
---
# Goal

validate. Plan: page-hits-recorder (server-side page_hits recorder), page-hits-wire (register it in server/index.ts), traffic-admin-api (GET /api/admin/traffic + traffic24h fix), click-events-endpoint (POST /api/analytics/click + click_events), traffic-panel-ui (TrafficPanel on /admin/observability), click-beacon-injection (site-wide nonced click beacon), clicks-report (top clicks in API + panel), page-hits-full-detail (full IP/UA/referrer, stable visitor id, signed-in user on page_hits), click-events-full-detail (same identity on clicks), traffic-visitors-api (raw hit log, visitors list, visitor timeline), traffic-visitors-ui (those views in TrafficPanel). The owner explicitly wants full per-visitor detail including raw IP and their own traffic recorded and flagged, not excluded.

# Acceptance criteria

- [ ] page-hits-recorder: every AC in session-manager-operations/scheduler/epics/inspect-and-confirm-it-work-fix-otherwise-admin--6406d452/prds/1303-page-hits-recorder.md (or prds-archived/) holds in the tree, except where page-hits-full-detail deliberately adds raw ip/ua columns.
- [ ] page-hits-wire: every AC in .../prds/1304-page-hits-wire.md holds.
- [ ] traffic-admin-api: every AC in .../prds/1305-traffic-admin-api.md holds.
- [ ] click-events-endpoint: every AC in .../prds/1306-click-events-endpoint.md holds; no input value is persisted.
- [ ] traffic-panel-ui: every AC in .../prds/1307-traffic-panel-ui.md holds.
- [ ] click-beacon-injection: every AC in .../prds/1308-click-beacon-injection.md holds; booting the server locally (pnpm build then the start script, bounded) and curling / and one /projects/<slug>/ shows the nonced beacon, and a subsequent flush puts rows in page_hits.
- [ ] clicks-report: every AC in .../prds/1309-clicks-report.md holds.
- [ ] page-hits-full-detail: every AC in .../prds/1311-page-hits-full-detail.md holds.
- [ ] click-events-full-detail: every AC in .../prds/1313-click-events-full-detail.md holds.
- [ ] traffic-visitors-api: every AC in .../prds/1316-traffic-visitors-api.md holds.
- [ ] traffic-visitors-ui: every AC in .../prds/1318-traffic-visitors-ui.md holds.
- [ ] Write and commit session-manager-operations/reviews/validation/inspect-and-confirm-it-work-fix-otherwise-admin--6406d452/validate-server-traffic-capture.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/inspect-and-confirm-it-work-fix-otherwise-admin--6406d452/validate-server-traffic-capture.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 14e1059877bb8fd7f187f0d65fc4026a07fbc0ac
PRD files live under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/inspect-and-confirm-it-work-fix-otherwise-admin--6406d452/prds/ (or prds-archived/ once done); find each by slug.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
