# Validation: observability cleanup plan

Base: f11543f64c5ca98f934b9783e8af53f49c2ed112 (8 commits to HEAD d8e6cc01). PRD files found in `prds-archived/` (1375–1381).
Reviews: `/code-review` and `/security-review` were not run as separate tools; I self-reviewed the combined diff (SQL binding, auth, input handling, secrets, duplication).

## Gates re-run
- `pnpm vitest run` (full): 111 files, 1260 tests, all pass.
- `pnpm typecheck`: exit 0.
- `pnpm exec vite build --outDir /tmp/bilko-gate-val`: built.
- host-kit `vitest run tests/telemetry.test.ts`: 15/15 pass. `pnpm --filter host-kit test|typecheck|build` as a whole fail only because this worktree lacks `@testing-library/react` and `tsup` (game-shell.spec.tsx and timer.test.ts cannot resolve imports; `tsup` spawn ENOENT). Environmental, not a regression. The build gate was therefore not verified here.

## cleanup-server-session-identity — VERIFIED
- `declare module 'fastify'` + `bilkoIds?: BilkoIds`: server/session-identity.ts:40-42; `rg 'as any\)\.bilkoIds' server` empty.
- Exact `/api` exclusion: server/session-identity.ts:83 (`pathname === '/api' || startsWith('/api/')`); tests tests/session-identity.test.ts:34,123-124 (`/apiary`, `/api?x=1`).
- page-hits fallback: server/page-hits.ts:192 `req.bilkoIds ?? readSessionIds(h.cookie)`.
- Header comment names src/lib/telemetry.ts and the two visitor_id meanings: server/session-identity.ts:1-21.
- analytics.ts comment rewritten, comment-only diff: server/routes/analytics.ts:97-98.

## cleanup-admin-sessions-api — VERIFIED
- shared/session-timeline.ts exports TimelineItem (4 variants); imported at server/routes/admin-sessions.ts:5, no local definition.
- One validator `APP_FILTER_RE` on both routes: admin-sessions.ts:90 (flows) and :219 (sessions) → 400; test '400s on an invalid app value'.
- ESCAPE written inline in the pushed condition (:224-227); no `.replace` patching of the where array; all values bound with `?`. Test 'matches % and _ literally'.
- `/:id` returns `apps` via `appsForSessions([id])` (:306-308); test seeded with page views only.
- `appSlugFromPath` not exported (:37). requireAdmin present on all three routes (:85, :206, :273).

## cleanup-host-kit-telemetry — VERIFIED
- Single `touchSession()` per enqueue in logError (packages/host-kit/src/telemetry.ts:127) and enqueueLog (:191).
- `newId()` uses crypto.randomUUID else Math.random v4 UUID; 'anon' only in the catch (:75-90).
- `defaultEndpoint()` moved after constants (:19-26). Two new tests present and passing; changeset .changeset/host-kit-telemetry-touch-once.md is a patch bump.

## cleanup-host-telemetry-module — VERIFIED
- One `send(url, body)` helper at src/lib/telemetry.ts:65, used by track (:89) and trackFlow's sendTelemetry (:115). Both URLs use `${API}`.
- `rg -c "'bilko_vid'"` = 1 (the constant). `trackScreen` gone; getOrCreate* are not exported and are unused elsewhere.
- track/trackFlow payload fields unchanged (read in the file: same keys and order). host-track-flow tests pass.

## cleanup-session-player-format — VERIFIED
- src/lib/format.ts:10-17 exports fmtTime/shortId/fmtMmSs; no local `function fmtTime|shortId|fmtMmSs` in SessionPlayer.tsx or FlowsPanel.tsx.
- SessionPlayer selection is unfiltered Step.index (SessionPlayer.tsx:34-61), nearest earlier visible step on filter change.
- sessionSteps.ts imports TimelineItem from shared (:4); '(before first page)' handling covered by tests/session-steps.test.ts (+22 lines), which pass.

## cleanup-session-view-list — VERIFIED
- SessionsPanel is list-only; colSpan typo fixed (SessionsPanel.tsx:142); uses `useAdminFetch` (:3, :28).
- SessionViewPage renders `<SessionsPanel />` (:118), detail fetch via useAdminFetch (:29), header Apps from `session.apps` (:89). `rg -c 'dark:'` = 8 (threshold 8).
- Admin diff: SessionsPanel 31+/160-, SessionViewPage 19+/153-. No duplicate list or inline timeline remains in these files.

## cleanup-click-tagging — VERIFIED
- ProjectsPage.tsx:281,333 use `project-open-${slug}`.slice(0,60); no data-track-slug; trackFlow('explore','open-project') kept (:235).
- ManualPage.tsx:39 `open-download-page` for page links; real file downloads call `trackDownloadClick('session-manager-manual', ...)` (:269). Downloads.tsx:12 exports trackDownloadClick(artifact, platform, version); no trackAppDownload remains.
- Header.tsx:37 includes `area: 'sm-header'`. The only preventDefault calls in ManualPage (:188, :338) are pre-existing non-tracking handlers.

## Combined
- `git diff --stat` for src/pages/admin: 4 files, 79 insertions / 330 deletions (net −251). PASS.
- Full vitest and typecheck green. PASS.
- Duplicate definitions: TimelineItem is defined once (shared/). **fmtTime/shortId are still defined locally in src/pages/admin/TrafficPanel.tsx:76-77** — see Findings.

## Findings
### Critical
- none
### Important
- src/pages/admin/TrafficPanel.tsx:76-77 still defines its own `fmtTime` and `shortId`. The first is a different format (toLocaleString with timeZoneName) and the second is identical to src/lib/format.ts:14. This misses the plan's combined "no duplicate fmtTime/shortId definitions in src/" criterion. No PRD listed TrafficPanel in its Files, so the per-PRD verdicts stand, but the plan is not fully minimal. Fix: import `shortId` from lib/format and reconcile `fmtTime` (rename or share).
### Minor
- src/pages/admin/SessionViewPage.tsx has exactly 8 `dark:` variants (the minimum); fine, but the margin is zero.
- host-kit full gate and build could not run in this worktree (missing devDeps); rerun in the main checkout.
