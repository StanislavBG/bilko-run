# Ship: honest visitor numbers

Date: 2026-11-12 (America/Los_Angeles)
Pushed SHA: 24dcaa4fea5db2e44a9da289302f5e52b84c66ea (origin/main, StanislavBG/bilko-run), fast-forward from 095d4ff4
Push time: 10:47:43 PM PST

## Validation gate — PASS
validate-honest-visitor-numbers.md: all seven PRDs VERIFIED; Critical none, Important none. Validation SHAs match `git log origin/main..HEAD -- <files>` (exactly one commit per PRD).

## Commits pushed (log order; local SHA -> pushed SHA)
- non-page-paths-helper: f9d7a7f1 -> bf88d25f feat(server): add isProbePath/isNonPagePath path classifiers
- traffic-confirmed-visitors: 23288212 -> dabc8be6 feat(traffic): add totals.confirmedVisitors and visitors[].confirmed
- probe-hits-flag-visitor: 4a20820c -> a6e20e71 feat(page-hits): flag probe-path visitors as script for 24h either side
- spa-fallback-404-non-pages: 733d3b51 -> 73a412e9 fix(server): SPA fallback answers 404 for non-page paths
- mcp-traffic-confirmed: 7f03437a -> fca91060 feat(mcp): traffic_report adds visitors.confirmed and visitors.unverified
- kpi-confirmed-visitors: 24a2012f -> 884ce89e feat(observability): UNIQUE VISITORS shows confirmed of fetched; UNVERIFIED chip on unconfirmed visitors
- doc-observability-confirmed: 3f871888 -> 24dcaa4f docs(observability): explain confirmed vs unverified visitors, probe bots, sessions and non-page 404s

Exactly 7 commits in 095d4ff4..origin/main; the local validation-record commit (8d70600b) was not pushed.

## Pushed-tree checks (throwaway worktree /tmp/ship-honest-visitors at origin/main + 7 cherry-picks, no conflicts)
- pnpm test — PASS (183 files passed, 2 skipped; 2277 passed, 15 skipped)
- pnpm typecheck — PASS (exit 0)
- pnpm build — PASS (exit 0)
- push to origin only, no force — PASS

## Deploy — PASS
/api/health uptime 50 s at 161 s after push (seen 10:50:23 PM PST).

## Live checks (10:50:30 PM PST, cookie bilko_internal=1 on every request)
- /wp-config.php -> 404 — PASS
- /.env -> 404 — PASS
- /assets/index-doesnotexist123.js -> 404 — PASS
- / -> 200 — PASS
- /book -> 200 — PASS
- /api/admin/traffic?days=1&mine=exclude&bots=exclude — PASS: totals.confirmedVisitors = 4 (numeric), totals.visitors = 55, 4 <= 55; 55 visitors[] rows, every row has a boolean `confirmed` (4 true). Counts only recorded.

SHIP: PASS
