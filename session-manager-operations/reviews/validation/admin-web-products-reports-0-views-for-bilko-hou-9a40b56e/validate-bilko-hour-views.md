# Validation: bilko-hour-views

Base: 66f610b1fc814022f87c690cbddc181584c9a408. Commit: 99891bcd `fix(admin): count Bilko hour views on the /bilko page` (only commit in Base..HEAD; touches the 4 PRD files).

## bilko-hour-views — VERIFIED

- AC1 HOST_PAGE_PATHS: `server/page-hits.ts:71` exports the six strings (flatMap of /bilko,/hire,/human-for-hire with and without `/`); `slugFromPath` uses `.includes` (`:74`); `grep HOST_PAGE_RE` over server/tests/src/shared: no hits; `tests/page-hits.test.ts` has zero removed lines in the diff and passes (20 tests).
- AC2 viewsFilter: `server/routes/admin-web-products.ts:16-21` returns `path IN (?,...)` with all HOST_PAGE_PATHS as args when `productPageSlug(p) === HOST_PAGE_SLUG`, else the `path LIKE ? ESCAPE '\\'` with `likePrefix(p.slug)`; both page_views queries (`:51`, `:68`) use `${page.sql}` / `...page.args`.
- AC3 beacon test: `tests/admin-web-products.test.ts` 'counts a beacon hit on /bilko' (POST /api/analytics/pageview, Chrome UA, real WEB_PRODUCTS); passes.
- AC4 path matrix, bot, is_admin: test 'counts the page and its aliases, not look-alikes, bots or the retired path' and 'counts an is_admin row only with exclude_self=0'; pass.
- AC5 other products: 'leaves every other product filter alone' and 'still counts a /projects/<slug>/ row for a service with no pageSlug'; pass. Diff removes 0 lines from the test file, so existing tests are unedited.
- AC6 CLAUDE.md line 153 names HOST_PAGE_SLUG and HOST_PAGE_PATHS in server/page-hits.ts and their use in admin-web-products.ts; commit subject matches exactly.
- Query equivalence for launch-kit and agent-factory-kit (neither has pageSlug 'human-for-hire'): Base SQL `WHERE date >= ? AND path LIKE ? ESCAPE '\\' AND COALESCE(is_bot, 0) = 0${selfSql}` with args `(sinceDate, pattern)`, where pattern = `likePrefix(p.slug)`. Now `${page.sql}` expands to the identical `path LIKE ? ESCAPE '\\'` and args are `(sinceDate, likePrefix(p.slug))`. Same for the GROUP BY date query. Identical SQL text and bound args.
- Gate: `timeout 300 pnpm test` → 166 files passed, 1863 tests passed, 15 skipped; `timeout 120 pnpm typecheck` → exit 0.
- `pnpm identity:scan` → "no tracked file contains a deny-listed identifier".
- Combined diff: 4 files, +81/-7. /code-review and /security-review not run as separate tools; self-reviewed: only `?` placeholders are interpolated, all values bound; no secrets or path handling.

## Findings

- Critical: none.
- Important: none.
- Minor: none. (Test file counts for the CLAUDE.md "Testing" line were deliberately untouched per PRD.)
