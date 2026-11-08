# Validation: flows-env-filter, mcp-flows-report-env

Base: no `Base:` line was read; commits located by path (a2adcf71, 8c7ddce4). PRD files found in prds-archived (1681, 1682).

Gate (re-run, foreground): `vitest run tests/admin-sessions.test.ts tests/mcp-report-defaults.test.ts tests/mcp-dist-sync.test.ts` plus `tests/mcp-errors-report.test.ts` (PRD 1682 gate): 4 files, 80 tests pass. `pnpm typecheck`: exit 0.

## flows-env-filter (1681) — VERIFIED
- parseEnvSelector/envPredicate imported: server/routes/admin-sessions.ts:7; applied at :167-172 (pushed to feParts and aeParts).
- feWhere used in the events (:212), steps (:224) and totals (:230) funnel_events queries; aeWhere in app_errors (:216). Args follow the fragments in order (:213, :217, :225, :231).
- Default prod: envPredicate is `COALESCE(env,'prod')='prod'` (telemetry.ts:205), so NULL counts as prod. `all` is `1 = 1`; dev/test is `env = ?` bound (:206). parseEnvSelector sends unrecognised values to prod (test at tests/admin-sessions.test.ts:595).
- Echo gains `env`: admin-sessions.ts:298; asserted at tests/admin-sessions.test.ts:340, 443-479, 577-592.
- Tests seed NULL/prod/dev/test (tests/admin-sessions.test.ts:524-569) and cover default, all, test, dev, garbage.
- Bound parameters only: the only interpolated value is the trusted-literal predicate SQL; user input goes through `?`. page_views/click_events untouched.

## mcp-flows-report-env (1682) — VERIFIED
- inputSchema `env: z.enum(['prod','dev','test','all']).default('prod')`: mcp-host-server/src/report-tools.ts (diff hunk at ~:129); flowsReport always does `p.set('env', opts.env ?? 'prod')` (src/errors-report.ts). Description (ENV_FILTER) states default prod, host-kit 0.11.0+ dev/test tagging, NULL as prod.
- tests/mcp-report-defaults.test.ts:77-81 asserts default `env=prod`; env 'all' sends `env=all`; an out-of-enum value is refused.
- dist matches src: tests/mcp-dist-sync.test.ts passes (byte compare against a fresh compile); dist/errors-report.js and dist/report-tools.js are in commit 8c7ddce4.
- README (mcp-host-server/README.md:29, :33) and docs/observability.md describe the filter and host-kit env tagging.

## Findings
- Critical: none.
- Important: none.
- Minor: tests/mcp-errors-report.test.ts was edited outside the PRD's Files list. It is in the PRD's gate, and the commit message says so. Acceptable.
- Minor: the Base: line was not read, so commits were found by path; no ambiguity found.
- Self-review (code-review/security-review skills not run as separate agents): no injection, secret or path-traversal issues. The envPredicate column argument is a literal and the value is bound. No duplicate helper (the existing envPredicate is reused).
