# Validation: server traffic capture

Base: 14e1059877bb8fd7f187f0d65fc4026a07fbc0ac (from the PRD's `Base:` line). HEAD: 7d8aaa8.
PRD files were all in `prds-archived/`. Commits per PRD: 7dc9cf9 (1303), b03bd6c (1304), 373114c (1305), deeeb4f (1306), bd9ec2c (1307), 29787f8 (1308), b7df26b (1309). A later PRD, 1311 (4c1555db), widened `page_hits` (see Findings).

Gates re-run in this worktree (the main repo's node_modules was symlinked in temporarily, then removed):
- `pnpm vitest run` on page-hits, egress, observability, analytics-click, analytics-pageview and click-beacon: 6 files, 72 tests, all pass.
- `pnpm typecheck`: exit 0.
- `pnpm test`: 100 files, 1088 tests, all pass.
- `/code-review` and `/security-review` were not run as slash commands. I self-reviewed the diff instead (see Findings).

## 1303 page-hits-recorder — VERIFIED
- The `page_hits` table and its three indexes are in `server/db-schema.ts` (the diff adds the columns and `idx_page_hits_date`, `_slug_date` and `_ts`).
- `server/page-hits.ts` exports `slugFromPath`, `recordPageHit`, `flushPageHits` and `registerPageHitRecorder`. The slug regex is `^/projects/([^/?#]+)/`.
- The onResponse hook checks `GET`, skips `/api/`, requires `text/html`, and sits inside try/catch (`page-hits.ts` hook at the end of the file).
- `visitorHash` is sha256 of `date|ip|ua`, first 16 hex chars. `refHost` strips `www.` and returns null when the host matches the request's Host.
- The buffer is capped at `MAX_BUFFER = 5000`. Inserts are parameterized and batched in chunks of 100. The 90-day prune runs once per day.
- The tests in `tests/page-hits.test.ts` pass (12 tests).
- AC deviation, supplied by PRD 1311: rows now also store raw `ip`, `ua`, `referrer`, a stable `visitor_id` and `user_email`. The original AC said no raw IP is stored. This was an explicit later decision, so I record it as a Finding rather than a refutation.

## 1304 page-hits-wire — VERIFIED
- `server/index.ts` imports `registerPageHitRecorder` and calls it right after `registerEgressMeter(app)`, before the routes and `staticPlugin` (diff hunk @@ -146).
- The `onClose` hook flushes, and the timer is created only when `flush !== false`.
- The static-app test is in `tests/page-hits.test.ts` and passes.
- The full suite and typecheck are green.

## 1305 traffic-admin-api — VERIFIED
- `GET /api/admin/traffic` is at `server/routes/admin-observability.ts:190`. It has the requireAdmin guard, a days clamp and an optional slug.
- The human aggregates use `is_bot=0 AND status<400`. Bot hits and 404s are counted separately. `recent` is limited to 50 rows (about line 259). The top lists are capped at 25.
- Every query goes through `safeQuery` with parameterized SQL.
- `traffic24h` in the rollup now reads from `page_hits` (lines 52-75).
- The traffic tests in `tests/observability.test.ts` pass (26 tests).

## 1306 click-events-endpoint — VERIFIED
- The `click_events` table and its indexes are in `db-schema.ts`.
- `POST /api/analytics/click` is at `server/routes/analytics.ts:204`.
  - Field limits: path 300, tag 20 (lowercased), id 80, label 80 (whitespace collapsed), href 300.
  - A non-`/` path gets 400. A rate-limit hit or an internal error returns 204.
  - The href regex `^(https?:\/\/|\/(?![/\\]))` nulls `javascript:`, `data:` and protocol-relative links.
  - Only the five listed fields are read.
- `visitorHash` is exported from `page-hits.ts` and reused.
- Live check: a text/plain POST with `href: "javascript:x"` returned 204 and stored `href=null` with a `visitor_hash`.
- Persistence: the `click_events` row contains no IP column and no input value. The hash is one-way.
- `tests/analytics-click.test.ts` passes.

## 1307 traffic-panel-ui — VERIFIED
- `TrafficPanel.tsx` fetches `${API}/admin/traffic?days=${days}${slugParam}` with a Bearer token from Clerk `getToken` (lines 120-123).
- It has the days selector, the stat row, the tables, the 'No hits recorded yet' empty state with the earliest date (line 139), and the 'Filtered to … ×' control (line 173).
- `<TrafficPanel />` is mounted at `ObservabilityPage.tsx:216`, and the page imports it at line 8.
- Typecheck is green. I did not check the panel in a browser, because I could not authenticate as admin.

## 1308 click-beacon-injection — VERIFIED
- `BEACON_JS` is 721 bytes and contains no http(s) URL (checked with tsx).
- The onSend hook in `click-beacon.ts` handles string, Buffer and stream payloads. It skips non-HTML responses, attachments and blog-video paths. It inserts before `</head>` (falling back to `</body>`) and removes content-length.
- The `/admin` guard and the try/catch wrappers are in place. The only input value ever read is the `value` of submit/button inputs.
- `server/index.ts` registers `registerClickBeacon` right after the recorder.
- Live boot: `pnpm build`, then `NODE_ENV=production node dist-server/server/index.js` with a temp SQLite file.
  - `curl /` returned 200 with one `<script nonce="…">(function(){try{` tag.
  - `curl /projects/academy/` returned 200 with exactly one nonced beacon tag.
  - After SIGTERM, `page_hits` held 2 rows: `/` (slug null) and `/projects/academy/` (slug academy), both status 200 and is_bot 0. `click_events` held 1 row.
- `tests/click-beacon.test.ts` passes.

## 1309 clicks-report — VERIFIED
- The traffic handler adds `totals.clicks` and `topClicks` (human rows only, honoring the slug filter, limit 25, safeQuery). See `admin-observability.ts` lines 264-275.
- `TrafficPanel.tsx` has the 'Top clicks' table (line 280).
- The click seed test is in `tests/observability.test.ts` and passes.

## Findings

### Critical
- None.

### Important
- `server/page-hits.ts` (the `PageHitRow` fields and the INSERT) now stores the raw `ip`, the full `ua` and `user_email` in `page_hits`. PRD 1303 AC4 said no raw IP or UA is stored. PRD 1311 deliberately overrode this, but the retention is still 90 days and covers all visitors. Confirm that a privacy notice covers the stored IPs and emails.
- Possible gap in the persistence AC for click events: `visitor_hash` uses `req.ip` and `user-agent` with the date, with no secret salt. The IPv4 space is small, so an offline brute force could in theory reverse it. This is low risk but worth knowing.

### Minor
- `server/click-beacon.ts` (the onSend hook): every HTML response is buffered in memory, and streams are fully read. Large static HTML files are buffered per request. This is acceptable for HTML, but note it.
- `server/routes/analytics.ts:204` (the click route): text/plain relies on Fastify's default string parser instead of the `hasContentTypeParser` guard the PRD described. The result is the same, and a test covers it.
- A stray empty untracked file named `<path>` sits at the worktree root. I did not create or stage it, and it is outside this review.
