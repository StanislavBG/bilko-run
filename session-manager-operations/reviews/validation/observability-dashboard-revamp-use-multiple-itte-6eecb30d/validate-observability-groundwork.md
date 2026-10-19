# Validation: observability groundwork

Base: 6e01caf52b5140db3f4537e167ea0c3482f60995. PRD file: `prds-archived/1383-observability-global-alerts-once.md`. Landed commit: `44ee4f36` (the only commit touching the PRD's four files since base).

## 1383 observability-global-alerts-once — VERIFIED

Gate (re-run in foreground):
- `timeout 300 pnpm vitest run tests/observability.test.ts` → exit 0, 32 passed.
- `timeout 300 pnpm typecheck` → exit 0.

Criteria:
1. Row `openAlerts` is own-slug only: `server/routes/admin-observability.ts` filter is now `a.app_slug === slug` (diff in 44ee4f36, ~line 179).
2. `globalAlerts` returned once: `alerts.filter(a => a.app_slug === null).map(...)` added to the return object. `env`, `rows`, `desktopApps`, `latestKit` and `generatedAt` are still returned unchanged.
3. `src/pages/admin/ObservabilityPage.tsx`: `ObservabilityResponse` gains `globalAlerts?`, and `openAlertCount` = row sum + `(data?.globalAlerts?.length ?? 0)`.
4. `tests/observability.test.ts` "aggregator — cost alerts" seeds one global alert, one alert for slug-a, and manifests a and b. It asserts rowA has 1, rowB has 0, and `globalAlerts` equals `[{global_spend}]`. Passes.
5. `tests/observability.test.ts` "blog-cadence auth gate" asserts a 403 without admin auth. Passes.
6. `docs/host-internals.md`: now "defaults to 5m (options 30s, 1m, 5m, off)".

Only the four PRD-listed files changed in 44ee4f36.

## Findings

- Critical: none.
- Important: none.
- Minor: `globalAlerts` is optional in the page type (`?`). That is defensible for older cached responses, and the count handles it with `?? 0`.
- Minor: the executor reported no red-first run. This does not affect the final state, which is correct.
- Review: the self-review of the diff found no unsafe input handling, secrets, or path traversal. SQL in the tests is parameterized and no route wiring changed.
