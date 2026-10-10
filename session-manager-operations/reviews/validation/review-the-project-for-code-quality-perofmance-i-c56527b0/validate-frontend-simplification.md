# Validation: frontend simplification plan

Base: f6c830b41387627d97916c1af828bf4c1472dae1 (HEAD 7413af5). 158 files changed in the combined diff.
Whole-plan gates, all run in the foreground: `pnpm typecheck` exit 0, `pnpm build` exit 0, `pnpm test` exit 0 (72 files, 871 tests passed).
The worktree had no node_modules, so I ran `pnpm install --offline --frozen-lockfile` first.

## Per-PRD verdicts

- **1130 admin-api-hook: VERIFIED.**
  - `src/constants.ts:3` exports `API_BASE`.
  - `src/hooks/useAdmin.ts` exports `useIsAdmin`, `useAdminFetch`, `useAdminResource` and `AdminGate`.
  - The Bearer header is set only `if (token)` (`useAdmin.ts:18`).
  - `Layout.tsx:5,22` uses the shared `useIsAdmin`.
- **1131 film-dialog-progress-rerender: VERIFIED.** `FilmDialog.tsx:49-52` moves the per-frame `time` state into the `FilmScrubber` child, mounted at line 448. The parent keeps no `currentTime` state. The landing and book tests pass.
- **1132 registry-client-slim: VERIFIED.**
  - `vite.config.ts:7-25` is a build-only plugin that strips `sourceRepo` and `localPath`.
  - `grep -l "localPath\|~/Projects/\|sourceRepo" dist/assets/*.js` finds nothing.
  - The full JSON is still on disk, and the tests pass.
- **1133 frontend-dead-exports: VERIFIED.**
  - `git grep -nw fetchJSON|postJSON|LIVE_PROJECTS|COOKING_PROJECTS` over src, tests, scripts and e2e finds nothing.
  - `Channel` is now a non-exported interface at `portfolio.ts:34`.
  - `src/data/api.ts` was kept with only `API`, which `manualClient.ts` uses.
- **1136 document-title-hook: VERIFIED.** `useDocumentTitle.ts` has the default constant and restores it on unmount. All 10 listed pages use the hook. The remaining `document.title` assignments are in files the PRD excludes (AdminPage, SessionManagerPage) and in PortfolioProjectDetailPage and the admin sub-pages, which the PRD does not list.
- **1134 registry-public-fields-schema: VERIFIED.**
  - `registry.ts:51-52` adds `public: z.boolean().optional()` and `displayName: z.string().min(1).max(60).optional()`.
  - `mcp-host-server/dist/contract/registry.js` was rebuilt.
  - `tests/registry-contract.test.ts:86-106` covers the new cases, and the dist-sync test passes.
- **1147 admin-pages-wire: VERIFIED.**
  - A grep for `const API`, `getToken` and `Authorization` in the three files finds nothing.
  - `AdminCostPage` uses `AdminGate` (lines 28-30) and shows `loadError` (line 89).
  - Line counts, before to after: AdminCostPage 215→230, SecretsPage 231→211, ObservabilityPage 412→375.
- **1148 adminpage-split-1: VERIFIED.**
  - `analytics/parts.tsx` holds StatCard, BarChart, Panel, LoadingState and the `Stats` interface, with no `any`.
  - `ActivityTabs.tsx` exports Overview, Users, Roasts and Activity tabs, each using `useAdminResource`.
  - The "AdminPage.tsx line count before and after" part of this PRD is covered by the 103-line final count below.
- **1149 projects-view-from-registry: VERIFIED.**
  - 7 entries in `standalone-projects.json` have `"public": true`, and 2 have `displayName`.
  - `PUBLIC_CARDS` in `projectsView.ts` derives from the registry; the old hardcoded `PUBLIC_SLUGS` set and `DISPLAY_NAME` map are gone.
  - `PUBLIC_SLUGS` is now a derived export at `projectsView.ts:174`.
  - `tests/projects-view.test.ts` pins the 7 slugs, their order and names, and passes.
  - The `projectsRegistry.ts` header documents `public` and `displayName`.
- **1152 adminpage-split-2: VERIFIED.**
  - `GrowthTabs.tsx` exports Sources, Funnels, Audience and Tools tabs.
  - The Tools tab takes its project list from `PROJECTS` in the registry (line 283).
  - `Math.max` is computed under `useMemo` (lines 277-282).
- **1153 manual-page-hooks: VERIFIED.**
  - `src/lib/format.ts` exports `formatBytes`; ManualPage, BandwidthPanel and ObservabilityPage import it, and no local copies remain.
  - `ManualPage.tsx` has `useManualChapters` (line 68) and `memo(function Chapter)` (line 102).
  - The manual-client and book tests pass.
- **1156 adminpage-split-3: VERIFIED.**
  - `OpsTabs.tsx` exports `SyntheticTab` and `ManifestsTab`.
  - `DriftBadge` is defined once in `admin/DriftBadge.tsx` and used by both pages.
  - `AdminPage.tsx` is 103 lines (limit 250) with no `any`.
- **1157 sm-landing-hooks: VERIFIED.**
  - `hooks.ts:140,190` exports `useBookPages` and `useCanvasTurnInputs`.
  - `Chevron.tsx` is defined once and imported by both pages.
  - SessionManagerPage went from 447 to 325 lines.
  - The landing, book and open-core tests pass.
- **sm-pages-folder-move: VERIFIED.**
  - Both pages now live in `src/pages/session-manager-landing/`, and the `App.tsx:49-50` lazy imports point there.
  - No stale code or test path references remain (the CLAUDE.md note below is documentation only).
  - The full vitest run is green.

## UI check

I served the build with `NODE_ENV=production tsx server/index.ts` on port 4377 and drove it with Chromium through `@playwright/test`. The Playwright MCP had no browser installed.

| Page | Result |
| --- | --- |
| `/` | Renders (title "Bilko Bibitkov — small AI tools"). No uncaught page errors. |
| `/projects` | Renders, title "Projects — Bilko Bibitkov". |
| `/blog` | Renders, title "Blog — Bilko Bibitkov". |
| `/admin` (signed out) | Renders the short gate message, title "Admin — bilko.run". |
| `/products/session-manager` | Renders, title "Session Manager — bilko.run". |
| `/products/session-manager/manual` | Renders about 77k characters of chapters. |

Every page logged only HTTP 400 resource errors. The Clerk requests to `clerk.bilko.run` return 400 because the production Clerk key is used from localhost, which is environmental. `/projects` also logged a 400 from `POST /api/analytics/event`, which I did not investigate. No JS exceptions on any page.

## Findings

**Critical:** none.

**Important:** none.

**Minor**
1. `CLAUDE.md:134` still lists `src/pages/SessionManagerPage.tsx` and `src/pages/ManualPage.tsx`. They moved to `src/pages/session-manager-landing/`, which the same line already lists as a directory, so the allowlist is only stale in wording.
2. `const API = import.meta.env.VITE_API_URL || '/api'` is still duplicated in `usePageView.ts:5`, `BlogPage.tsx:6`, `BlogPostPage.tsx:7`, `BandwidthPanel.tsx:5`, `BlogCadencePanel.tsx:4` and `data/api.ts:1`. Each could use `API_BASE` from `src/constants.ts`.
3. `SecretsPage.tsx:96` and `ObservabilityPage.tsx:144` still set `document.title` by hand instead of using `useDocumentTitle`. This is outside PRD 1136's list.
4. `POST /api/analytics/event` returned 400 when loading `/projects` locally. I did not check whether this is a local-only artifact.

Self-review of the combined diff found no secrets, no unsafe input handling and no path traversal. The Vite plugin only reads the JSON it transforms.
