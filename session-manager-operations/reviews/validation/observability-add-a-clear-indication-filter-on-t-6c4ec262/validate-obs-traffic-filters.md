# Validation: obs-traffic-filters (EXCLUDE MINE / BOT toggles)

Base: 399f7c421c593063a7ba65800c899dfd24404cb6. Commits 8e3d8e74, 8cf2cc98, c2c44aad, 977837e3, fabcfb9c, 1f33b09b, f027fdba.
PRD files found in prds-archived/ (1654-1660).

Gates re-run (foreground): `pnpm vitest run` over traffic-filters, observability, admin-sessions, obs-command-{layout,ticker,traffic-class,kpis}: 7 files, 146 tests pass. `pnpm typecheck` exit 0. Playwright `e2e/observability-shell.spec.ts`: 4 passed.
Review: /code-review and /security-review not run as separate tools; self-reviewed the full diff.

## obs-filter-primitives — VERIFIED
- parseTrafficFilters, mine or self alias, bots: server/traffic-filters.ts:71-79.
- loadOwnerIds, 30 d, cap 500, recent-first, errors give []: traffic-filters.ts:82-97 (SQL at 41-60).
- mineExclusionSql / mineMatchSql, omission, ' AND 0': traffic-filters.ts:118-137.
- Column regex throw: traffic-filters.ts:35,99-104. ids only bound as `?`.
- isOwnerRow: traffic-filters.ts:140-145.
- tests/traffic-filters.test.ts: 25 tests green.

## obs-filter-traffic-endpoint — VERIFIED
- admin-observability.ts:224-246 builds slugSql with mine exclusion once and feeds every page_hits query. `self=exclude` goes through `parseTrafficFilters`, so it equals `mine=exclude`; covered in tests/observability.test.ts.
- botSql applies to recent and allClasses (byClass/topPagesByClass): :243-248, :308. botHits is unchanged.
- recent rows get isMine via isOwnerRow with client_vid selected: ~:428.
- `filters {mine,bots,mineHits}` with mineHits via mineMatchSql, slug-only: ~:342-348, :453-457.
- Existing tests unchanged and green.
- mcp-host-server traffic_report: the `self=exclude` alias is preserved in code and tested; I did not call the live MCP.

## obs-filter-sessions-endpoint — VERIFIED
- Sessions: admin-sessions.ts:307-333 (cookieIds NOT IN, owner and bot session subqueries bound with UTC sinceDay, NULL session ids skipped).
- mine/bot flags from one grouped query `sessionFlags`: :80-96, :350-376. Filters echo present. Tests green.

## obs-filter-flows-endpoint — VERIFIED
- admin-sessions.ts:148-182: per-table fragments (page_views, click_events, funnel_events, app_errors) and bot exclusions; NULL session ids kept via `session_id IS NULL OR ...`. Filters echo at :273-280. Tests green.
- Note: funnel_events/app_errors exclusion also uses cookieIds, which matches the PRD's intent.

## obs-filter-header-toggles — VERIFIED
- ToggleSet in theme.tsx; CommandShell: TrafficFilterState, parsePersistedFilters, EXCLUDE control between WINDOW and REFRESH (CommandShell.tsx:293-302), persistence in obs-cmd:v1, amber `EXCLUDING …` StatusLine, `RECENT HITS · FILTERED` suffix (:395). PreviewPage passes state. Layout tests green.
- 1280 px check on the DEV preview (`/admin/observability/preview`, Playwright, temp spec removed): header scrollWidth <= clientWidth and height 38 px for none, MINE and MINE+BOT states. Header fit uses a measured shed (wordmark, clock, indicator text) rather than the fixed 1360 breakpoint. This is a deviation from the PRD wording but meets its "must not overflow" requirement.

## obs-filter-mine-badges — VERIFIED
- types.ts adds the fields and FilterEcho; KpiStrip.tsx isMineHit (:115-117) and MINE chip in TickerItem (:121,135) with the specified style. Ticker tests green.

## obs-filter-wire-console — VERIFIED
- ObservabilityPage passes filters and onFilters. useCommandData filterQuery (:44-46) and deriveKpis relabelling ('excluded', '· excl. mine'). SessionsModule: params, refetch, MINE and BOT chips. KPI tests green.
- Security: all new SQL values are `?` binds. The only interpolated identifiers are checked by SAFE_COLUMN or are literals ('is_admin'|'is_bot'). All three admin-sessions routes and the traffic route still call requireAdmin (admin-sessions.ts:123,284,388).

## Findings
### Critical
- none
### Important
- none
### Minor
- traffic-filters.ts: loadOwnerIds runs on each /api/admin/traffic request regardless of toggles (needed for isMine/mineHits); two UNION queries over 30 days of hits. Fine at current scale, worth a short cache if the endpoint gets hot.
- CommandShell.tsx: header fit relies on DOM measurement; verified at 1280 px only in the preview with sample data, not on live data.
- Plan also touched built artifacts under public/projects/session-manager/ (unrelated publish commit in range); not reviewed.
