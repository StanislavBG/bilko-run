# Validation: session-manager telemetry ingest plan

Base: cb1889e0395902470a582c7f152d05b59cef35a1. PRD files found under `prds-archived/`.
Gates re-run (job worktree, `node_modules` symlinked from the main checkout; link removed afterwards):
- `pnpm vitest run tests/telemetry.test.ts tests/session-manager-usage.test.ts tests/observability.test.ts` — 3 files, 60 tests passed.
- `pnpm typecheck` — client stage passed. Server stage failed only in `server/routes/project-catalog.ts` (missing `@modelcontextprotocol/sdk` in the shared node_modules). That file belongs to the unrelated project-catalog work, not this plan. `tsc -p tsconfig.scripts.json` passed. No type errors in any file this plan touched.
- Commits per PRD: b0881e3 (1275), e8fb777 (1276), 18ebbad (1277), 9514505 (1278), 7f268c9 (1279), c6598b1 (1280). Each also appears as a duplicate hash (fb55995, 3902d95, 28adc9b, 2823ca1, 0758fbd) from the merge; the content is the same.

## telemetry-quota-429 — VERIFIED
- 429 + `Retry-After` + `{error:'quota_exceeded', retryAfterSec}`: `sendThrottled`, server/routes/telemetry.ts:~127; used by /event, /log and /error.
- Zero rows on refusal: each route returns before the INSERT loop when `!admitted.ok`.
- No quota consumed on refusal: `chargeQuotas` peeks every bucket with `quotaWait`, then consumes with `quotaConsume` only if all fit. `quotaWait` never mutates.
- /install: `chargeQuotas` over `_appDay` and `install:${id}`, then `sendThrottled`. The bad-slug `return {ok:true}` and the 400 for missing install_id are kept.
- Malformed records (bad slug, invalid /log level via the `valid` predicate) are dropped before any quota is charged. Responses are `{ok:true, ingested:n}`.
- Comments: header rewritten; the X-SM-Beacon-Key note sits by `beaconTag`.
- Tests: `per-install hourly limit answers 429…` expects statuses `[200,200,200,200,429]` (tests/telemetry.test.ts:219-234); the 190-used refusal test is at ~250. Passing.

## admin-session-manager-tab — VERIFIED
- `SessionManagerTab.tsx` uses `useAdminResource` (line 2, 121) and `LoadingState` (line 146); the PT formatter uses America/Los_Angeles (line 49).
- The env picker has the `bg-fire-500` / `bg-warm-100` classes (line 133), default prod.
- AdminPage.tsx: `'session manager'` added to TABS after `'products'`, with the render line.
- Typecheck is clean for these files. I read the KPI and table sections for structure only; they were not run.

## telemetry-persist-env — VERIFIED
- db-schema.ts: ADDITIVE_COLUMNS adds `env` to funnel_events (with comment), app_logs, app_errors and app_installs.
- `envOf`, `parseEnvSelector` and `envPredicate` are in telemetry.ts. prod is `COALESCE(col,'prod')='prod'`, dev/test is `col = ?`, all is `1 = 1`.
- All four INSERTs write env, and the install upsert has `env = excluded.env`.
- The env test passes in the vitest run.

## telemetry-scheduled-retention — VERIFIED
- `pruneTelemetryScheduled`: `DELETE FROM funnel_events WHERE created_at < ? AND (env IS NOT NULL OR version IS NOT NULL)` and `DELETE FROM app_installs WHERE last_seen_at < ?`. Both are parameterized, with 180-day and 365-day cutoffs.
- `startScheduledPrune`: unref'd setTimeout (5 min) and setInterval (24 h), cleared in `onClose`, failures go to `app.log.warn`, and `{scheduledPrune:false}` disables it.
- The retention test (tests/telemetry.test.ts:177-196) keeps a 200-day-old `checkout_start` row that has neither env nor version. That is the web-analytics / checkout-metrics safety check, and it passes.

## telemetry-env-read-filter — VERIFIED
- admin-session-manager-usage.ts: all 11 queries add `AND ${ev.sql}` (the join uses `evE`), with `ev.args` placed before the LIMIT args. The response includes `env`.
- admin-observability.ts: the errors, logs, latest-error (inner subquery plus outer `evA`) and desktopApps queries are filtered, and the response includes env. All seven /installs queries are filtered, and that response includes env.
- session-manager-usage and observability tests pass (22 observability tests unchanged).

## telemetry-usage-read-token — VERIFIED
- `hasReadToken`: requires a `Bearer ` prefix and a non-empty value. It skips unset env vars, checks length, then uses `timingSafeEqual`. The handler skips `requireAdmin` only on a match.
- db.ts SECRET_NAMES has `SM_USAGE_READ_TOKEN` right after `PROJECT_SNAPSHOT_TOKEN`.
- Test 'accepts the read tokens headlessly and refuses everything else' (tests/session-manager-usage.test.ts:78) passes.

## Combined-diff checks
- Retention cannot delete rows with both env and version NULL. Web analytics (analytics.ts:185), web-products (:158) and `_shared.ts:63` all insert without env or version.
- Every SQL change is parameterized. `${ev.sql}` interpolates only a trusted literal column plus placeholders, and the selector value is always bound.
- Quota refusal returns before any INSERT, and no quota is consumed.

## Findings
### Critical
- none
### Important
- none
### Minor
- server/routes/telemetry.ts (`quotaWait`): a single batch whose per-bucket count `n` exceeds the bucket limit can never fit, so it would get a 429 with a retry hint forever. Today MAX_BATCH (50) is below the visitor hourly limit (200), so it is unreachable. It would matter if the limits or batch size are changed.
- server/routes/project-catalog.ts is outside this plan, but the shared worktree fails the server typecheck there (missing MCP SDK dependency). Flagging for whoever owns it.
- Code-review and security-review were done as self-review (no tool run). Nothing found: no secrets are logged, the token comparison is constant-time, and there is no path handling.
