# Validation: analytics-allow-page-view-event

Base: 8b14f9d092a52b6be6f26cb5fa149baf552e1a2a. Commit in range: 38e60f80 (touches only `server/routes/analytics.ts` and `tests/analytics-event.test.ts`).

VALIDATION: analytics-allow-page-view-event VERIFIED

## Evidence
- AC1 (allowlist): `server/routes/analytics.ts:17` adds `'page_view'` to `ALLOWED_EVENTS`; diff is a one-line change, no other entry or 400 path touched.
- AC2 (test): `tests/analytics-event.test.ts` asserts 200 `{ok:true}` plus one `funnel_events` row (`page_view`/`projects`), and 400 for `not_a_real_event`.
- AC3 (ProjectsPage unchanged): `git diff 8b14f9d0..HEAD -- src/pages/ProjectsPage.tsx` is empty; line 151 still calls `track('page_view', { tool: 'projects' })`.

## Gate (re-run)
- `pnpm vitest run tests/analytics-event.test.ts tests/analytics-pageview.test.ts`: 2 files, 9/9 passed.
- `pnpm typecheck`: exit 0.

## Review of combined diff
Self-review (no unsafe input handling, secrets, or path handling added; the event is checked against the allowlist and stored via the existing parameterized path; test reuses repo setup pattern).

## Findings
- Critical: none
- Important: none
- Minor: none
