# Validation: forum-seed-observable-retry (PRD 1446)

Base: 8a22caee (given). Commit for this PRD: e29e932d (touches server/index.ts, server/routes/forum.ts, tests/forum-routes.test.ts). PRD file found in prds-archived/.
Note: `git log 8a22caee..HEAD` also lists the rename-throttle commits (c13f4996, 1eb9ab2e) and a docs commit; those belong to another PRD and were not judged here.

## forum-seed-observable-retry — VERIFIED

Evidence per criterion:
- Status + health export: `server/routes/forum.ts:101-109` defines `seedStatus {seeded,error,attempts,lastAttemptAt}` and `getForumSeedHealth()` (returns a copy). `forum.ts:120-121` logs `console.error('[forum] seed failed:', err)`; stored error is `err.message` only (no stack/email).
- Lazy retry: `maybeRetrySeed` (`forum.ts:~128`) returns when seeded, in flight, or within `SEED_RETRY_MS` (60s) of last attempt; called from the existing `onRequest` GET hook on `/api/forum/` (`forum.ts:~145`); fire-and-forget `void runSeed()`, `seedInFlight` guard prevents concurrency.
- Health wiring: `server/index.ts:224` `forum: getForumSeedHealth()` beside `gitViewer`; import at line 31.
- Prod-cause investigation: commit message e29e932d states "not reproducible locally"; likeliest causes are a boot-time Turso failure or handle `bilko` held by another email, now visible at `/api/health` `forum.error`. No `server/services/forum.ts` change (none claimed needed). I did not independently re-derive the libSQL analysis; the conclusion is stated as the AC requires.
- Tests: `tests/forum-routes.test.ts:206-244` mocks the seed to reject once, asserts `seeded:false`/message/attempts 1 and the console.error call, no retry inside the window, retry after +61s flips `seeded:true` (attempts 2), and threads `log`, `brought`, `sm` return 200.

Gate (re-run):
- `timeout 180 pnpm vitest run tests/forum-routes.test.ts tests/forum-store.test.ts` → 2 files, 22 tests passed.
- `timeout 300 pnpm typecheck` → exit 0.

Reviews: `/code-review` and `/security-review` not run; self-reviewed the diff (see Findings).

## Findings

Critical: none.
Important: none.
Minor:
- `server/routes/forum.ts:~121` `seedStatus.error` exposes a raw error message on the public `/api/health`; a driver error could include a DB URL or SQL fragment. Acceptable per the AC (message only), but worth watching after deploy.
- `tests/forum-routes.test.ts:~227` the retry test uses `vi.setSystemTime` while relying on the file-level `useFakeTimers({toFake:['Date']})` set in `beforeEach` (line 60); it works but is coupled to that setup.
- Live production behavior is untested by design (the PRD excludes a post-deploy check).
