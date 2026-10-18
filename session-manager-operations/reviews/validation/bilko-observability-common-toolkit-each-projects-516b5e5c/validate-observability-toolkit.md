# Validation: bilko-observability-common-toolkit

Base: cbe9161d1f46ee2899dcaea5dd14b9db509cdeef (21 commits to HEAD, 48 files). Gates were run in the foreground on the final tree. No PRD has a `# Gate` section beyond typecheck/test, so evidence is per criterion plus the combined runs.

## Combined gates

- `pnpm typecheck`: exit 0 (client, server, scripts).
- `pnpm vitest run`: 1235 passed, **2 failed**, 110 files.
  - `tests/open-core-positioning.test.ts` "keeps every Clerk hook inside a quiet boundary": **regression from this plan** (see Findings, Important 1).
  - `tests/spa-fallback-notfound-crash.test.ts` "/projects/game-academy/ answers 404": `dist/projects/game-academy/index.html` exists in the stale gitignored `dist/`. Environment artifact, not touched by the plan (Minor 2).
- Targeted: session-identity, click-beacon, admin-sessions, host-track-flow, analytics-pageview, telemetry tests: 68/68 pass.
- host-kit package suite: telemetry (13), bus, auth and manifest-cli pass. `game-shell.spec.tsx` and `timer.test.ts` fail to resolve `@testing-library/react` (missing dependency in this worktree, unrelated files).
- /code-review and /security-review were not run as separate tools. I self-reviewed the diff (see Findings).

## Per-PRD verdicts

### session-identity-cookie: VERIFIED
- `server/session-identity.ts:56-90`: onSend sets `bilko_vid` (Max-Age 31536000) and `bilko_sid` (Max-Age 1800), Path=/, SameSite=Lax, Secure on https or x-forwarded-proto.
- `session-identity.ts:68-71`: cookies only for GET + 200 + non-`/api/` + `text/html`. No `/api/*` or non-200 response sets cookies.
- `session-identity.ts:35-50`: values failing the UUID regex count as absent. A fresh UUID is minted and the raw value is never echoed or stored.
- Registered before the recorder/beacon in `server/index.ts`. `tests/session-identity.test.ts` passes.

### host-kit-shared-session-sdk: VERIFIED
- `packages/host-kit/src/telemetry.ts`: `touchSession` reads/writes the `bilko_vid`/`bilko_sid` cookies. `defaultEndpoint()` is same-origin `/api/telemetry` on bilko.run. `trackFlow` is exported with `FLOW_RE` validation and `track` auto-inits.
- Changeset `.changeset/host-kit-session-telemetry.md`. host-kit telemetry tests pass (13).

### telemetry-ingest-cookie-session: VERIFIED
- `server/routes/telemetry.ts` `batchOf()` stamps cookie `session_id`/`visitor_id` over body ids before `admit()`. Used by event, log and error. Desktop clients with no cookie keep body ids. `tests/telemetry.test.ts` passes.

### session-columns-page-hits: VERIFIED
- `server/db-schema.ts:576-591`: additive `session_id`, `client_vid`, `track_name` on click_events and `session_id`, `client_vid` on page_hits.
- `server/db.ts:179-186`: indexes. `server/page-hits.ts` inserts the ids using `(req).bilkoIds` with a cookie fallback. `tests/page-hits.test.ts` passes.

### beacon-session-and-navigation: VERIFIED
- `server/click-beacon.ts`: BEACON_JS sends the ids, wraps pushState/replaceState with `try { r = o.apply(...) } ... return r` and the extra work in try/catch. `popstate` fires a pageview. Dedupes on a repeated path and skips `/admin`.
- Clicks honor `data-track`/`data-track-redact`, scrub emails and 6+ digit runs, and drop href query and hash. `tests/click-beacon.test.ts` passes.
- The history wrappers cannot break navigation: the original return value is always returned and the beacon work is swallowed.

### privacy-cookie-disclosure: VERIFIED
- `src/pages/PrivacyPage.tsx`: new "3. Cookies" section names bilko_vid (1 year) and bilko_sid (30 min idle), purpose, and click-label scrubbing. The date is updated and the sections are renumbered.

### analytics-ingest-session-ids: VERIFIED
- `server/routes/analytics.ts` `resolveIds()`: cookie first, body fallback. Strict UUID mode for click, legacy 64-char truncation for pageview/event. Pageview accepts a text/plain string body. Click stores `session_id`, `client_vid`, `track_name`. Tests pass.

### remove-usepageview-pageviews: VERIFIED
- `grep analytics/pageview` over src, packages and public/projects: no client POST outside BEACON_JS (`click-beacon.ts`). `src/hooks/usePageView.ts` no longer exports `usePageView`. It now holds only `track`, `trackFlow`, `trackScreen` and the id helpers.
- `AccountChip.tsx` PageViewBeacon/PageViewTracker removed.
- Caveat: the `open-core-positioning` test, which was updated for this PRD, fails after a later PRD (Important 1).

### admin-sessions-api: VERIFIED
- `server/routes/admin-sessions.ts`: `GET /api/admin/sessions` (191), `/api/admin/sessions/:id` (275) and `/api/admin/flows` (70) all call `requireAdmin` first.
- All values are bound parameters. The only interpolations are the constant `TIMELINE_CAP`, the `?` placeholder lists, and fixed `appTool` fragments. The `app` filter is regex-validated and the LIKE `_` is escaped. The `:id` param is UUID-validated (400).
- `tests/admin-sessions.test.ts` passes.

### admin-flows-api: VERIFIED
- `admin-sessions.ts:70-189`: per-app health (views, clicks, events, errors, sessions) and per-flow step funnels from `funnel_events` `json_extract(metadata,'$.flow'/'$.step')`. days is clamped 1-30. Bad `app` returns 400. Covered by `tests/admin-sessions.test.ts`.

### admin-sessions-panel: VERIFIED
- `src/pages/admin/SessionsPanel.tsx` (261 lines) is mounted in `ObservabilityPage.tsx`. It uses the `/api/admin/sessions` list and timeline. It typechecks.

### admin-flows-panel: VERIFIED
- `src/pages/admin/FlowsPanel.tsx` (187 lines) is mounted in `ObservabilityPage.tsx`. It consumes `/api/admin/flows`. It typechecks.
- No UI render test exists (not required by the criteria).

### observability-adoption-doc: VERIFIED
- `docs/observability.md` (124 lines): section 9 taxonomy matches code. The flow regex `^[a-z0-9][a-z0-9-]{0,39}$` equals the `FLOW_RE` in host-kit and the host. The `data-track` prefixes buy-/tip-/download- match the landed tags. The `batchOf` note about text/plain being ignored is accurate: `/api/telemetry/event` needs a parsed JSON body, hence the Blob wrap. Cookie names and TTLs match `session-identity.ts`.
- Minor: the doc lists steps (`download-started`, `checkout-redirect`, `success`) that no host code emits yet. They are taxonomy for siblings, not claims about the host.

### host-trackflow-helper: VERIFIED
- `src/hooks/usePageView.ts` `trackFlow`/`sendTelemetry` POSTs `{batch:[{app:'bilko',name:'<flow>.<step>',visitor_id,session_id,ts,props:{...,flow,step,path}}]}` as application/json to `/api/telemetry/event`.
- This matches host-kit `trackFlow`, which names the event `flow.step` with `flow`/`step` in props. The handler stores `name` as `event`, `app` as `tool`, `props` as `metadata`, and `props.path` as `path`. That is what admin-flows reads. `tests/host-track-flow.test.ts` passes.

### tag-session-manager-landing: VERIFIED (with regression noted)
- `Downloads.tsx:11-14,40,61`: `data-track="download-mac|download-windows"` plus `trackFlow('download','click-download',{artifact,version:'latest',platform})`. `SessionManagerPage.tsx` tags mac-intel, film, manual and page controls.
- `Header.tsx:36-37`: `data-track="tip-coffee"` with `trackFlow('tip','click-tip',{product:'coffee'})`. `openFilm` calls `trackFlow('film','play')`.
- No handler calls preventDefault. All onClick handlers only call trackFlow, so navigation and downloads are unchanged.
- The criterion is met, but this PRD's import of `trackFlow` from `usePageView.js` breaks `tests/open-core-positioning.test.ts` (Important 1).

### tag-host-core-pages: VERIFIED
- `Layout.tsx` has `nav-*`/`footer-*` plus `tip-coffee` with `area:'footer'` (170). `HomePage.tsx:46-47` has `tip-coffee` with `area:'home'`. `ProjectsPage.tsx:235` has `trackFlow('explore','open-project',{slug})` with `data-track-slug`.
- `PricingPage.tsx`: `view-offer` on mount via `useEffect`, and `click-buy` on each plan link with `data-track="buy-*"`. Checkout behavior is unchanged: the diff is additive only and the links still go to `/projects`. This page has no Stripe redirect or return handler, so `checkout-redirect`/`success`/`cancel` are correctly absent.

### tag-host-content-pages: VERIFIED
- `ContactPage.tsx`: `data-track="contact-*"` on the links. `trackFlow('contact','start')` fires once on first focus/click capture with no props, so no form values or emails reach props. There is no form in the page.
- `BlogPage`, `BlogPostPage`, `ManualPage` and `PortfolioProjectDetailPage` carry tagging with additive-only diffs.

## Findings

### Critical
None.

### Important
1. `tests/open-core-positioning.test.ts:~212`: the test now asserts that no page file contains the substring `usePageView`. The tagging PRDs import `trackFlow` from `'../../hooks/usePageView.js'`. `SessionManagerPage.tsx`, `Downloads.tsx` and `Header.tsx` fail it (`ManualPage.tsx` also imports it but is not in `PAGE_FILES`). The full `pnpm vitest run` is therefore red on the final tree. Fix: relax the test to match the `usePageView(` call instead of the file name, or move `trackFlow`/`track` to a `src/lib/telemetry.ts` module.
   - This failure is also why the "combined: vitest green" criterion is not met.

### Minor
2. `tests/spa-fallback-notfound-crash.test.ts:112`: fails because the gitignored `dist/projects/game-academy/index.html` is stale in this environment. It is unrelated to the plan. A clean `dist/` should pass.
3. The host-kit package tests `game-shell.spec.tsx` and `timer.test.ts` can't resolve `@testing-library/react` in this worktree (missing install). Unrelated to the plan.
4. `session-identity.ts:68`: the cookie is only set when `req.url.startsWith('/api/')` is false. A query-prefixed path is still fine, but `/api` without a trailing slash would be treated as a page. Negligible (no such route).
5. `server/routes/admin-sessions.ts:~215`: the `where[...]` replace for `ESCAPE` is fragile string patching of the SQL. It is correct for the three LIKEs today, but the SQL is still fully parameterized.
6. Security self-review of the diff: no secrets. Cookies are non-HttpOnly by design (documented). Admin routes are guarded. The client beacon scrubs emails, long digit runs and URL query/hash. No path traversal introduced. The `public/projects/social-signals-trader/dashboard-code.bundle.js` change in the diff is a published artifact (+270 lines) and not part of this plan's scope.

## Summary
All 17 PRDs landed their stated criteria. Typecheck is green. The full vitest run has one plan-caused failure (Important 1) and one environmental failure (Minor 2). The verdicts below stay VERIFIED because each PRD's own criteria are met. The architect should fix Important 1.
