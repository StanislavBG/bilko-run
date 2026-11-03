# Validation: nested-product-views

Base: 66f610b1. Commit for this PRD: f58ea065 (subject exactly `fix(admin): count nested product pages under their own product`; touches only server/routes/admin-web-products.ts and tests/admin-web-products.test.ts).

## nested-product-views — VERIFIED

- AC1 viewsFilter signature and branches: server/routes/admin-web-products.ts:16 `viewsFilter(p, products)`; prefix branch uses `likePrefix(page)` plus one `NOT LIKE ?` per nested product (starts with `page + '/'`); host-page branch unchanged. Both page_views queries use `viewsFilter(p, products)` (line 52) and bind `...page.args` (lines 57, 74).
- AC2 nested page test: tests/admin-web-products.test.ts:261-269 — row at /projects/launch-kit/agent-factory-kit/ gives agent-factory-kit views 1 / uniqueVisitors 1 / daily 1, launch-kit 0.
- AC3 parent and retired path: tests/admin-web-products.test.ts:271-278 — launch-kit and launch-kit/thanks count 2 for launch-kit; /projects/agent-factory-kit/ counts 0 for agent-factory-kit.
- AC4 existing tests unedited: the diff to the test file only adds lines (no removed lines in the pre-existing describes in this commit's 25-line addition); full suite passes. Commit subject matches.
- Gate (re-run): `pnpm test` → 166 files passed, 1865 tests passed, 15 skipped; `pnpm typecheck` → exit 0.
- `pnpm identity:scan` → "no tracked file contains a deny-listed identifier", exit 0.

## Review of combined diff
Self-review (diff is 6 files, only f58ea065 is in this PRD). SQL: only placeholders interpolated, all values bound; LIKE prefix escaped via existing likePrefix. No secrets, no path handling issues, no helper duplication.

## Findings
- Critical: none.
- Important: none.
- Minor: the Co-Authored-By trailer names the model; harmless. Test for the retired path asserts only agent-factory-kit is 0 (launch-kit's count of 2 also proves it adds nothing there).
