# Validation: forum hardening (base 8a22caee)

Commits: c13f4996 (throttle), 1eb9ab2e (maxLength). Diff: server/routes/forum.ts, src/pages/forum/HandleModal.tsx, tests/forum-routes.test.ts — only the files each PRD listed.

## forum-handle-rename-throttle — VERIFIED
- 3/day rename limit, 429 with the exact message: server/routes/forum.ts:212-217 (`RENAMES_PER_DAY = 3` at :44; message matches AC verbatim).
- First creation unthrottled; case-only change is not a rename: `isRename = !!existing && normalizeHandle(handle) !== normalizeHandle(existing.handle)` (forum.ts:213); `normalizeHandle` in shared/forum.ts:56.
- Reuses the in-memory, size-capped pattern: `renameLog` Map + `MAP_CAP` clear (forum.ts:51, 72-81); no new table.
- Counts only successful renames: `if (r.ok && existing && isRename) recordRename(...)` (forum.ts:218).
- Tests: tests/forum-routes.test.ts:118-134 (409 x4 not counted, case-only not counted, 3 renames ok, 4th 429, other member unaffected). The test does exercise the first-claim path through `giveHandle`.
- Gate: `pnpm vitest run tests/forum-routes.test.ts` → 12 passed; `pnpm typecheck` → exit 0.

## forum-handle-input-maxlength — VERIFIED
- Import at src/pages/forum/HandleModal.tsx:10; `maxLength={FORUM_LIMITS.handleMax}` at :102; `grep 24` finds no literal left in that file. `handleMax: 20` at shared/forum.ts:32.
- Gate: `pnpm typecheck` exit 0; `playwright test e2e/forum.spec.ts` → 4 passed.

## Findings
### Critical
- none
### Important
- none
### Minor
- server/routes/forum.ts:212-218 — check and record are separated by `await setHandle`, so concurrent requests from one member can all pass the check and exceed 3 renames. Narrow, and the cap is abuse damping, not security.
- server/routes/forum.ts:213-215 — the 429 check runs before handle validation, so a member at the limit gets 429 even for an invalid handle. Cosmetic.
- No test covers the input's `maxLength` (noted by the implementer); the constant swap is trivial.
- Review method: `/code-review` and `/security-review` not run as skills; self-reviewed the diff. No secrets, no unsafe input handling (handle is validated by `setHandle`; SQL untouched), no new helper duplication.
