# Validation: real-visitor analytics plan (PRDs 1669-1674)

Base: not given in the PRD (no `Base:` line). Commits found by `git log` on each PRD's paths; base treated as unknown.
Gates re-run on the current tree: the six per-PRD vitest sets (14 files, 288 tests, all pass), then the PRD gate `pnpm test` (180 files passed, 2081 tests passed, 15 skipped) and `pnpm typecheck` (exit 0).
`/code-review` and `/security-review` were not run; I reviewed the diff myself (all new SQL uses bound parameters; no email or IP columns added; admin routes behind requireAdmin).

## automation-signals-at-ingest (c2041e0e) — VERIFIED
- Beacon sends webdriver only when true: server/click-beacon.ts, tests/click-beacon.test.ts (13 pass).
- Pageview ingest: `webdriver === true` sets is_bot and bounded 24 h UPDATEs on page_hits, click_events and page_views: server/routes/analytics.ts:144-146, 197-220.
- funnel_events and app_errors gain is_bot and are set from the request UA header: server/routes/telemetry.ts (`uaBotFlag`), server/routes/analytics.ts:260.
- tests/analytics-automation.test.ts (7), tests/telemetry.test.ts pass. Gate green.

## internal-device-mark (7aee49aa) — VERIFIED
- internal_devices table in server/db-schema.ts; server/routes/admin-internal-device.ts (POST/DELETE/GET), registered in server/index.ts.
- loadOwnerIds folds marked ids in without a time window: server/traffic-filters.ts. 'This device' card in src/pages/admin/SecretsPage.tsx.
- tests/internal-device.test.ts (11) and tests/traffic-filters.test.ts pass, including the 90-day-old marked device and the refused admin-key POST.

## real-visitor-reads (6f6c0d60) — VERIFIED
- Sessions flag and filter on funnel_events/app_errors is_bot: server/routes/admin-sessions.ts sessionFlags (~l.85-105) and the bots=exclude block.
- `?app=` matches funnel_events.tool and app_errors.app: admin-sessions.ts (~l.308-320).
- Funnel default self-exclusion drops owner devices: server/routes/admin-funnel.ts:53-55.
- Visitor timeline accepts a cookie id (`client_vid`): server/routes/admin-observability.ts:479-489.
- Tests pass (admin-sessions, admin-funnel, observability). Gate green.

## mcp-real-visitor-defaults (321cc387) — VERIFIED
- flows_report and sessions_report send mine=exclude&bots=exclude unless includeMine/includeBots: mcp-host-server/src/errors-report.ts:246-260, 385-403; descriptions in report-tools.ts:101-116.
- traffic_report: excludeSelf defaults true, sends `mine=`, never `self=`; bots default include with the reason stated: errors-report.ts:203-218, report-tools.ts:43-58.
- dist rebuilt: tests/mcp-dist-sync.test.ts passes. tests/mcp-report-defaults.test.ts (8) pass. docs/observability.md updated.

## git-viewer-profile-attribution (0b62aa01) — VERIFIED
- created_at and built_by columns: server/db-schema.ts and the migration list; set on first INSERT only.
- tests/git-viewer.test.ts (owner, automation, visitor, showcase, refresh keeps values) and tests/git-viewer-subscription.test.ts pass.

## git-viewer-profiles-report (e344a8be) — VERIFIED
- server/routes/admin-git-viewer.ts: requireAdmin GET; totals exclude SHOWCASE_LOGINS (`LOWER(login) NOT IN`); byTier, claimed/unclaimed, byBuiltBy incl. unknown; subscriptions by GIT_VIEWER_TIER; rows capped at 500. Selects no owner_email, payload or allowlist.
- git_viewer_report tool in mcp-host-server/src/git-viewer-report.ts; dist in sync; tests/admin-git-viewer.test.ts passes.

## No-param default check
Only intended changes to no-param responses: sessions `?app=` now also matches funnel/error-only sessions, and /api/admin/funnel default (exclude_self on) now also drops owner devices (both required by PRD 1671). The sessions `bot` response flag now reflects funnel/error is_bot rows. mine/bots params still default to include on sessions, flows and traffic, so console toggles behave. /api/admin/traffic/visitor/:id only widened its id match.

## Findings
### Critical
- none
### Important
- server/routes/admin-funnel.ts:47 — funnelCounts drops bots only via `page_views.is_bot`. It never reads `funnel_events.is_bot`, which 1669 now sets from the UA. A HeadlessChrome session that sent only telemetry and no beacon page view still counts in default funnel reads. Sessions and flows catch it; funnel does not.
### Minor
- /code-review and /security-review were unavailable here; self-review only.
- The PRD named no `Base:` SHA; ranges were taken from the commit history.
- Foreign working-tree changes (public/outdoor-hours, project-pages) were left untouched.
