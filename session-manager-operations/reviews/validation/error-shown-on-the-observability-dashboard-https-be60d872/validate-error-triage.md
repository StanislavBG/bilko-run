# Validation: error-triage plan

Base: a4ca4eac2f5eadb237f72eb135bb85349f0d6f27. PRD files read from `prds-archived/`.
Gates re-run (foreground): `pnpm vitest run` on mcp-errors-report, mcp-dist-sync, observability, obs-command-errors, obs-command-layout, obs-command-kpis → 6 files / 66 tests pass; `pnpm typecheck` → exit 0.
Not run: `/code-review` and `/security-review` (self-review of the combined diff instead). dist boot check skipped by the test (mcp-host-server/node_modules absent); the dist byte-match test passed.

## mcp-errors-report-module — VERIFIED
- Exports `errorsReport`/`errorDetail`, parameterized SQL only: mcp-host-server/src/errors-report.ts:62,159. The only interpolation is `?` placeholders and constant fragments.
- Grouping, signature, sort, limit cap 50/200, totals, byApp, sampleStack ≤2000: errors-report.ts:66-155.
- env semantics (prod default via COALESCE, all, dev/test, fallback prod), days 1..90, app slice 60: errors-report.ts:52-57, 66-72.
- errorDetail full columns, context_json parsed, null for unknown: errors-report.ts:159-185.
- tests/mcp-errors-report.test.ts covers grouping, days window, env incl. NULL, limit, detail/null, injection value (lines 46-90); passes.

## mcp-errors-report-tools — VERIFIED
- `hostDbSource()`: mcp-host-server/src/db.ts:13.
- `errors_report` registered with the specified zod inputs and top-level `database`: server.ts:695-715 (src diff).
- `error_detail` registered, returns `error <id> not found` via err(): server.ts:719-738.
- usage_report: `database` added to both outputs, and the local-DB note is the first notes line: server.ts:637, 673-681.
- Header comment lists both tools (server.ts:22-23); dist/server.js contains both tools and `mcp-dist-sync` passes (dist matches src).
- hostDbSource test: tests/mcp-errors-report.test.ts:41.

## admin-observability-errors-endpoints — VERIFIED
- Both routes call `requireAdmin` as their first statement, before any query: server/routes/admin-observability.ts:408-410 and :487-489 (new route lines).
- Response shape, signature SQL, env/app/days/limit handling, sort: admin-observability.ts:412-490 (new lines).
- Detail: 400 for non-integer, 404 for unknown, context_json parsed: same file, detail handler.
- All SQL is parameterized through dbAll/dbGet. Tests: 403 on both, grouping, app/env filters, days window, 400/404, injection (tests/observability.test.ts); pass.

## admin-observability-errors-ui — VERIFIED
- ErrorGroup / ErrorGroupsData / ErrorDetailData: src/pages/admin/command/types.ts:216-252.
- `errorGroupsPath` and the `fetcher` prop: AppsModule.tsx:11-13, AppsModule signature. Falls back to useAdminFetch.
- List shows name, msg, count, last seen, versions, plus loading/empty ("No errors in the last 24h")/HTTP-error states. Stale-response guard via `latest` ref: AppsModule.tsx ErrorsPanel.
- Detail renders the stack in a monospace `<pre>` (overflow auto, whiteSpace pre), plus url, version, ua, session_id, and a back button.
- PreviewPage previewFetcher serves both endpoints and passes `fetcher={previewFetcher}`.
- tests/obs-command-errors.test.ts covers encoding and the env suffix; passes.

## error-triage-skill — VERIFIED
- SKILL.md frontmatter name and triggers match. 55 lines.
- Step 2 stops when `database` is `local` and names TURSO_DATABASE_URL/TURSO_AUTH_TOKEN and ~/.claude.json.
- Classification, error_detail on sampleId, ownership via standalone-projects.json/get_project, gateway-tool stack rule, dedup (+10 count or new version), send-feedback dispatch, ledger, report table: all present.
- ledger.md has only the header and separator rows.
- Tool names `mcp__bilko-host__errors_report`, `error_detail` and `get_project` match the tools registered in mcp-host-server/src/server.ts (get_project pre-existing).

## Findings

### Critical
- none

### Important
- none

### Minor
- server/routes/admin-observability.ts (list handler): `msg` is `MIN(msg)` per group, not the newest sample's msg. The MCP module and `sampleId` use the newest row, so the UI list message can differ from the detail message when messages vary within a signature. Not an AC violation.
- AppsModule.tsx: the old "Latest error" Fact was removed from ManifestFacts, as the PRD intended. `latestError` is still on ObservabilityRow, so it is now unused in this sheet.
- The ledger and dispatch flow are untested against a live Turso DB; that needs a human to set the bilko-host MCP env.
