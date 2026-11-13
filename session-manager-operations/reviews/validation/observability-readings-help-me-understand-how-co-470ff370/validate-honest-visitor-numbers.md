# Validation: honest visitor numbers

Base: 095d4ff41943c85acc6164bbc8dab77b51c369fa. All PRD files found in prds-archived/. Gates re-run in this worktree: all exit 0
(10 vitest files 291 tests incl. mcp-dist-sync; spa-fallback-notfound-crash 9 tests after fresh `pnpm build`; `pnpm typecheck` exit 0).
/code-review and /security-review were not run as separate tools; I self-reviewed the combined diff (see Findings).

## non-page-paths-helper — VERIFIED (f9d7a7f1)
- server/non-page-paths.ts:1-38 exports isProbePath/isNonPagePath; strips ?/#, non-string/empty -> false (segmentsOf).
- Probe rules: dotfile segment except .well-known (:22), PROBE_FILENAMES (:24), PROBE_EXTENSIONS incl .bak/.old/.save for .php.bak (:26). isNonPagePath adds `\.[A-Za-z0-9]{1,8}$` (:37).
- tests/non-page-paths.test.ts: 122 passed (includes query and case cases).

## traffic-confirmed-visitors — VERIFIED (23288212)
- server/routes/admin-observability.ts ~394-431: confirmation sets (page_views visitor/session, click_events.client_vid, page_hits client_vid HAVING COUNT>=2), lookback 30d, date/ts_ms bounded, parameterized, set queries joined in JS.
- totals.confirmedVisitors = min(size, totals.visitors); visitors[].confirmed added; existing fields untouched (diff adds only).
- tests/traffic-confirmed-visitors.test.ts 4 passed; tests/observability.test.ts passed.

## spa-fallback-404-non-pages — VERIFIED (733d3b51)
- server/index.ts:61 import; :379 `if (isNonPagePath(path)) reply.status(404);` right after the projects root 404 line, before the existing no-store + send.
- tests/spa-fallback-notfound-crash.test.ts 9 passed against freshly built server; non-page-paths and project-not-found tests pass.

## probe-hits-flag-visitor — VERIFIED (4a20820c)
- server/page-hits.ts recordPageHit: probe path -> 'script', markProbeVisitor; later human hits within window -> 'script'; flush stamps buffered rows and runs backfill UPDATE (is_bot IS NOT 1, vid, ts >= first-24h) in last insert batch; resetProbeVisitorCache exported. automation_visitors path unchanged.
- tests/page-hits.test.ts 25 passed.

## kpi-confirmed-visitors — VERIFIED (24a2012f)
- types.ts optional fields; useCommandData.ts deriveKpis: `of N fetched` + mineNote when confirmedVisitors is a number, else old '<n> countries' tile; AudienceModule.tsx chip only when `confirmed === false`.
- tests/obs-command-kpis (24) and obs-command-audience (8) passed.

## mcp-traffic-confirmed — VERIFIED (7f03437a)
- mcp-host-server/src/errors-report.ts: confirmed (null if absent), unverified = max(human-confirmed,0); report-tools.ts description sentence added; dist/ updated, mcp-dist-sync passes.
- tests/mcp-errors-report.test.ts passed (both cases).

## doc-observability-confirmed — VERIFIED (3f871888)
- docs/observability.md: confirmed/unverified rule matches the handler; "Not caught" updated; "Why visitors can exceed sessions" covers beacon-only sessions, /blog-videos/, EasyPrivacy; "404s count real missing pages" paragraph. No owner name/email.

## Findings
- Critical: none.
- Important: none.
- Minor: probe mark is in-memory only and not extended by later probes (per PRD design; page-hits.ts markProbeVisitor).
- Minor: confirmation lookups (admin-observability.ts ~397) fetch all human hit rows in the window; fine at current volume, may need a cap on large windows.
- Self security review: SQL parameterized, no path traversal/secrets; isNonPagePath only changes status code.
