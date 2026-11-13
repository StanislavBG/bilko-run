# Validation: traffic-cookie-same-ua (PRD 1738)

Base: 45750220. Landed commit: `7b462979` (only commit in base..HEAD; touches exactly the 3 PRD files).

## 1738-traffic-cookie-same-ua — VERIFIED

- AC1 query: `server/routes/admin-observability.ts:421` reads `GROUP BY client_vid HAVING COUNT(*) >= 2 AND COUNT(DISTINCT COALESCE(ua, '')) = 1`, same `lookbackMs` arg; comment at lines 394-399 says a cookie under more than one user agent confirms nobody.
- AC2 unchanged signals: diff shows no edit to the page_views / click_events queries.
- AC3 tests: `tests/traffic-confirmed-visitors.test.ts` `hit()` takes optional `ua` (default NULL); new test "shared across several user agents" (4 keys, 4 UAs → confirmedVisitors 0, all false) and "repeated under one user agent" (2 keys → both true). 6 tests pass.
- AC4 docs: `docs/observability.md:225` bullet now says "2 or more `page_hits` that all carry the same user agent" plus the shared-cookie-jar sentence.
- Gate: `pnpm vitest run tests/traffic-confirmed-visitors.test.ts tests/observability.test.ts` → 2 files, 56 tests passed; `pnpm typecheck` → no errors (tsc client/server/scripts clean).
- Review: self-review of the diff (SQL stays parameterized, no schema change, no secrets/paths/input handling touched, no duplicated helper).

## Findings

- Critical: none.
- Important: none.
- Minor: `tests/traffic-confirmed-visitors.test.ts:8` comment line exceeds the file's wrapping style (cosmetic). Rows with NULL ua and rows with '' ua are treated as the same UA via COALESCE — matches the PRD.
