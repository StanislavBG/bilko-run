# Validation: Observability Command plan

Base: 22d848b4f959ce9abc9994a6830d53cb1e913efa. All 15 PRD files found under `epics/observability-dashboard-revamp-use-multiple-itte-6eecb30d/prds-archived/`.
Combined diff: 71 files, +3862/-1966. Commits 44ee4f36 (1383), 13c8fb3f (1385), 39c4157f (1386), c148fc32 (1387), 349365d0 (1388), 8f72c9ca (1389), f8e75a1f (1390), ea248880 (1391), 376d3d16 (1392), 452d01df (1393), 34291476 (1394), 7c524db5 (1395), d95df924 (1396), c7fd3217 (1397), 5c42c12d (1398).

**Gate limitation.** The job worktree's `node_modules` is partial (no vitest/tsc; `pnpm install --offline` aborts with no TTY) and the main checkout's install also lacks `vitest/vitest.mjs`. So no PRD gate (`pnpm typecheck`, `pnpm vitest run`, `pnpm test`) could be re-run. Every verdict below rests on reading the tree and diff, not on a green gate. `/code-review` and `/security-review` were not run; I self-reviewed the diff.

## Verdicts

- **1383 observability-global-alerts-once — VERIFIED (static).** `server/routes/admin-observability.ts:179` filters `a.app_slug === slug`; `globalAlerts` built from `app_slug === null` and returned at the top level with env/rows/desktopApps/latestKit/generatedAt unchanged. `tests/observability.test.ts:591` asserts globalAlerts; `:595` blog-cadence 403 test. `docs/host-internals.md` now says 5m default.
- **1385 obs-cmd-theme-types — VERIFIED (static).** `command/types.ts` and `command/theme.tsx` exist (231 and 229 lines). The `useCommandFonts` Google Fonts link is at `theme.tsx:39`. Typecheck not re-run.
- **1386 obs-cmd-shell — VERIFIED (static).** `CommandShell.tsx` uses `STORAGE_KEY='obs-cmd:v1'` (:37), `startViewTransition` gated on reduced motion (:73-75), INPUT/TEXTAREA key guard (:138). `tests/obs-command-layout.test.ts` present. Tests not re-run.
- **1387 obs-cmd-data-kpis — VERIFIED (static).** `useCommandData.ts` has the interval/visibility polling, `deriveKpis` and `deriveStatus`. `tests/obs-command-kpis.test.ts` present. Tests not re-run.
- **1388 obs-cmd-globe — VERIFIED (static).** `package.json` adds d3-geo, topojson-client, world-atlas, @types/*. Land data comes via dynamic `import('world-atlas/land-110m.json')` (`GlobeModule.tsx:66`), so there is no CDN fetch. No `Math.random` and no simulated pings: pings come only from `pingCountries` (:112-120, :248). Reduced motion is respected (:125) and rAF is cancelled on unmount (:267). `pnpm-lock.yaml` is not in the diff stat for this PRD; I did not confirm it was updated (see Findings).
- **1389 obs-cmd-sessions — VERIFIED (static).** Playback is 1000ms/speed (:148); Space toggles only when `stage` is true and focus is not in an input (:161-170); YOU chip uses the Clerk primary email (:72, :246); optional `fetcher` injection.
- **1390 obs-cmd-apps — VERIFIED (static).** `appTiles` uses the heat formula `min(1, sqrt((s+v+c+e/10)/400))` (:36) and a 48h recency window (:7). `appsSubtitle` is exported.
- **1391 obs-cmd-traffic — VERIFIED (static).** `TrafficModule.tsx` present, with `trafficSubtitle` used by the page.
- **1392 obs-cmd-audience — VERIFIED (static).** `AudienceModule` has a visitor timeline with a stale-response guard (:90) and an injectable fetcher.
- **1393 obs-cmd-clicks — VERIFIED (static).** `ClicksModule` and `clicksSubtitle` are present and wired.
- **1394 obs-cmd-bandwidth — VERIFIED (static).** `BandwidthModule` has an injectable fetcher and uses `egressInsight`.
- **1395 obs-cmd-kpis-ticker — VERIFIED (static).** `KpiStrip.tsx` injects `obsTicker` keyframes with a reduced-motion override (:62-64).
- **1396 obs-cmd-page-wire — VERIFIED (static).**
  - Admin guard intact (`ObservabilityPage.tsx`: `Navigate to="/"` for non-admins, loading text until Clerk loads).
  - `/admin/observability` moved outside `<Layout />` in `src/App.tsx:247`.
  - Only the existing endpoints are used (through `useCommandData` and the modules).
  - No hard-coded sample numbers outside `PreviewPage` (grep of `command/*` excluding PreviewPage found none).
  - Defaults are 7D / 5M. `pingCountries` is empty on first load.
- **1397 obs-cmd-retire-legacy — VERIFIED (static), with a deviation.** `FlowsPanel`, `TrafficPanel`, `BandwidthPanel` and `BlogCadencePanel` are deleted. `SessionsPanel.tsx` was kept because `SessionViewPage.tsx:6,118` imports it, which the PRD's step 1 allows ("keep that file and say so"). `host-internals.md` describes the console.
- **1398 obs-cmd-visual-pass — VERIFIED (static); screenshots unverifiable.** The preview route is registered only when `import.meta.env.DEV` is true (`App.tsx:41`), and the lazy import is in the dead branch, so a production build tree-shakes it. I did not run a production build to confirm. `PreviewPage.tsx` uses fixtures and `previewFetcher`. I cannot confirm the screenshot iterations or the 1280x760 overflow check from the tree alone.

## Findings

### Critical
- none.

### Important
- **Gates not re-run.** Per the limitation above, typecheck and test results for every PRD are unconfirmed here. The architect should re-run `pnpm typecheck && pnpm test` in a fully installed checkout before trusting the VERIFIED verdicts.

### Minor
- `command/SessionsModule.tsx:229` shows `{list.length} / {list.length}`, so "shown / total" can never differ. The PRD asked for shown / total.
- `pnpm-lock.yaml` for 1388 was not seen in the diff stat tail I read (the stat output was truncated at 50 lines); confirm with `git diff 22d848b4..HEAD --stat -- pnpm-lock.yaml`.
- 1397: `SessionsPanel.tsx` is still present (documented deviation, justified).
- `ObservabilityPage.tsx` passes `layout="rails"` fixed; the shell persists layout itself, so this is only an initial value (no action).
