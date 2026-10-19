# Validation: Forum plan

Base: 94f33fda8f1cccaf6486dceec46564182e9305ff. Eight `feat(forum)` commits (276c5485 .. 4fb5fa70), 23 files, +2951/-3.
Gates re-run in the foreground: `pnpm vitest run tests/forum-*.test.ts` (4 files, 37 tests, pass); `pnpm typecheck` (exit 0); `playwright test e2e/forum.spec.ts e2e/site-navigation.spec.ts` (15 passed).
`/code-review` and `/security-review` were not run. The diff was self-reviewed instead. I did not re-run `tests/db.test.ts` or `tests/db-boot.test.ts`, which the forum-store PRD gate lists.

## Verdicts
- forum-shared-primitives: VERIFIED. `shared/forum.ts` has the boards, `FORUM_CAME_VIA`, `FORUM_LIMITS`, the reserved list, `validateHandle` with the exact messages and reasons, `normalizeHandle`, and `forumAvatarColor` (hash h*31+c >>>0 mod 5). `tests/forum-shared.test.ts` passes.
- forum-store: VERIFIED. Tables are in `server/db-schema.ts`. `server/services/forum.ts` has `setHandle` (UNIQUE-race handled), `createThread`, `addPost` (a `brought` thread requires a valid `came`; the `logbook` thread is locked), `signLogbook`, `setHidden`, and an idempotent `ensureForumSeed` (log, brought, sm). `tests/forum-store.test.ts` passes (9 tests).
- forum-api-routes: VERIFIED.
  - Signed-out writes return 401: `tests/forum-routes.test.ts:101`.
  - Non-admin moderate returns 403: `tests/forum-routes.test.ts:173`. Signed-out moderate also returns 403.
  - No response leaks an email: `server/routes/forum.ts` only handles an email as an input. `toPublicMember` and the thread/log selects never select `email` (`server/services/forum.ts`). The "never leaks" test is at `tests/forum-routes.test.ts:181`.
  - A user with no handle gets 403 `needs_handle`. Writes are rate-limited, 6 per minute and 60 per day per member, and return 429. Body size is capped at 32 KB.
- forum-client-lib: VERIFIED. `src/lib/forumClient.ts` has typed fetchers, `moderate`, and the formatters `formatForumWhen`, `formatLogWhen` and `formatEntryNo`. `tests/forum-client.test.ts` passes (6 tests).
- forum-index-page: VERIFIED. `/forum` route at `src/App.tsx:222`, nav pill in `src/data/portfolio.ts:72`, `ForumIndexPage.tsx`. The e2e "forum index renders live data" and the site-navigation pill specs pass.
- forum-thread-page: VERIFIED. `ForumThreadPage.tsx` and `HandleModal.tsx` are present. The admin hide button is gated on `isHost` and calls `moderate` (lines 89 and 145). The e2e "thread page reads signed out" passes.
- forum-logbook-view: VERIFIED with a caveat. `LogbookView.tsx` has the signing form (`maxLength` 140/32) and paging. The e2e suite only covers signed-out reads of the index and thread. The signing flow itself has no browser test. Server-side coverage is in the routes and store tests.
- forum-new-thread-and-handle-chip: VERIFIED. `/forum/new` route at `src/App.tsx:223`. `ForumNewThreadPage.tsx` limits title and body length. `Layout.tsx` has the lazy-loaded handle chip and `HandleModal`.

## Findings

### Critical
None.

### Important
None.

### Minor
1. `server/routes/forum.ts` (`POST /api/forum/handle`): the route has no write throttle. An authed user can rename without limit. Because handles are looked up live, a rename changes how old posts display. That is a squatting and impersonation churn risk. Suggest a per-member rename limit.
2. `server/routes/forum.ts` (`onReady` hook): `ensureForumSeed(ADMIN_EMAILS[0])` is wrapped in try/catch, so a failure only logs and the forum boots with no seed. That is fine, but a failure is silent for visitors.
3. `src/pages/forum/HandleModal.tsx:101`: `maxLength={24}` does not match `FORUM_LIMITS.handleMax` (20). The server and `validateHandle` still reject anything over 20, so only the UX is off. Use the constant.
4. `server/routes/forum.ts`: the throttles, view dedup and online presence are in-process maps. They reset on restart and don't work across multiple instances. This is acceptable on the single-instance deploy and is noted in the code.
5. `POST /api/forum/moderate`: moderating the seeded `log` and `brought` threads is possible and soft. Hiding them makes `addPost` return 404. This is admin-only and reversible.
6. `e2e/forum.spec.ts`: there is no browser coverage of signing, replying or the handle modal. These are covered only by unit and route tests.

### Security notes
- Input validation: every string is type-checked, trimmed and length-limited server-side. The board id is allow-listed. `came` is allow-listed. Handles are validated against the regex and the reserved list, and checked for case-insensitive uniqueness. All SQL is parameterized. The `setHidden` table name comes from a fixed map, not user input. Numeric ids are checked with `/^\d{1,16}$/`.
- XSS: user text is stored raw and rendered through React text nodes. There is no `dangerouslySetInnerHTML` or `innerHTML` in `src/pages/forum` or `src/lib/forumClient.ts`.
- Rate limits: writes are limited per member, handle checks per hashed IP (30 per minute), and the maps are capped.
- Handle rename propagation: correct. The handle lives on `forum_members` and every thread, post and log read joins it live, so a rename shows everywhere with no copied handle strings. The `handle_lc` column is updated in the same UPDATE. The store test covers it.
