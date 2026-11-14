# Validation: traffic-missing-paths, traffic-missing-paths-panel

Base: d9e6497347b5ead4509ca67b48c106d982e1d599. Review done by reading the diff (no separate /code-review run; self-review).

## traffic-missing-paths — VERIFIED
Landed commit: 6dae1d67 (server/routes/admin-observability.ts, tests/traffic-missing-paths.test.ts).
- notFoundPaths shape, LIMIT 25, ORDER BY hits DESC, path ASC, status = 404, botHits SUM(is_bot=1), visitors COUNT(DISTINCT VKEY): admin-observability.ts ~362-369, response mapping ~456.
- mine=exclude: query uses `${slugSql}` (= slugOnlySql + mineExcl.sql, line 238); no bot filter applied, so bots=exclude leaves bot rows (test "mine=exclude drops the owner row; bots=exclude keeps bot rows").
- Bounded by `ts_ms >= ?`, parameterized via dbAll, safeQuery fallback []; existing fields unchanged (diff only adds).
- Test covers 404-only, per-path counts, ordering, 25 cap, mine exclusion, out-of-window row.
- Gate: vitest (traffic-missing-paths, traffic-confirmed-visitors, observability) 60 passed; `pnpm typecheck` exit 0.

## traffic-missing-paths-panel — VERIFIED
Landed commit: 3bcc7e76 (TrafficModule.tsx, types.ts, tests/obs-command-missing-pages.test.ts).
- types.ts: optional notFoundPaths added.
- TrafficModule.tsx: exported notFoundRows (slice 8, humanHits = hits - botHits, 48-char ellipsis cut, [] when missing).
- MissingPages renders MonoLabel "MISSING PAGES", hits, "bot N" when botHits > 0, returns null when empty; paths rendered as React text only, no href/dangerouslySetInnerHTML.
- Tests: 4 tests cover cap, humanHits, truncation, empty/missing.
- Gate: vitest (obs-command-traffic-class, obs-command-missing-pages) 9 passed; typecheck exit 0.

## Findings
- Critical: none. Important: none.
- Minor: Compact view also shows a 3-row MissingPages (beyond the PRD's wording; harmless). TrafficModule.tsx ~232.
- Minor: PRD-file path-based check of "bots=exclude" in the test uses only one path assertion (/.env). Adequate.
- Security: paths are untrusted but rendered as text; SQL parameterized; no secrets.
