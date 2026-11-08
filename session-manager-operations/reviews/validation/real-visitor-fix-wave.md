# Validation: real-visitor fix wave (PRDs 1703-1707)

Base: unknown (the validate PRD has no `Base:` line). Commits were found by path and subject in `git log`.
Combined review: self-review of the five commits (b28f7e9c, c7b878c0, e27fb825, 929df64c, 33b7feee). `/code-review` and `/security-review` were not run. SQL stays parameterized in the changed files I read. No secrets or path handling were added.

Gate run on the current tree:
- `pnpm test` was **red**: 1 failed, 2121 passed, 15 skipped. The failure is `tests/mcp-errors-report.test.ts:395` ("sessions_report > timeline: true adds each session timeline…").
- `pnpm typecheck` exited 0.
- Each PRD's own gate passed. I ran their test files together (11 files, 247 tests passed).

## telemetry-bot-rule-first-party (1703): VERIFIED
- `isBotRequest` and `beaconTag` are exported from `server/services/analytics.ts:145,157`. Commit b28f7e9c touches `analytics.ts`, `telemetry.ts` and `git-viewer.ts` in the routes.
- A beacon request stores is_bot 0, HeadlessChrome stores 1, a node CLI stores 0, and an empty-UA pageview is covered in `tests/telemetry.test.ts` and `tests/analytics-automation.test.ts`. All passed.
- The idempotent repair is in `server/db.ts` (+15 lines).
- I did not check the commit message for the repair method and row count.
- Session Manager desktop events (beacon header or node UA) now store is_bot = 0, so the bots=exclude defaults no longer hide them. This is shown by the passing beacon test, not by live data.

## automation-flag-once-per-visitor (1704): VERIFIED
- The `automation_visitors` table is at `server/db-schema.ts:710`.
- `server/routes/analytics.ts:197` records the visitor once. The click path at `:307` flags a known automation visitor.
- `server/page-hits.ts` and `server/click-beacon.ts` changed. The three required tests are in `analytics-automation.test.ts` and `click-beacon.test.ts`, and they pass.

## git-viewer-report-accuracy (1705): VERIFIED
- `server/routes/admin-git-viewer.ts` was reworked. `server/traffic-filters.ts:176` sets `OWNER_IDS_TTL_MS = 5 * 60_000`.
- `git-viewer.ts:413` uses `isOwnerRow(await cachedOwnerIds(), …)`.
- `mcp-host-server/dist` was rebuilt, and `tests/mcp-dist-sync.test.ts` passes.
- The tests for a zeroed-but-built row and for the cache are in the passing files.

## sessions-report-robustness (1706): REFUTED: it left `tests/mcp-errors-report.test.ts` red, so `pnpm test` fails
- Every acceptance criterion is met in code.
  - Non-UUID ids get an empty timeline with a note (`errors-report.ts`, `SESSION_ID_RE` check).
  - `admin-sessions.ts:387` selects the utm fields. `admin-funnel.ts:52-55` drops sessions with `is_bot` funnel rows.
  - `scrubEmails` drops email-like keys.
  - The report now uses the stored `referrer_host` (`str(r.referrer_host)`), and the host's timeline supplies it (`admin-sessions.ts:463`).
- The change was not applied to the existing test. The fixture `DETAIL` in `tests/mcp-errors-report.test.ts` still has a `referrer` only, so `referrer_host` is now null where the test expects `www.linkedin.com`.
- The PRD's gate excluded that file, so its own gate stayed green while the full suite broke.

## blog-watchdog-test-lock-and-recount (1707): VERIFIED
- `scripts/blog-cadence-watchdog.sh:172` reads `LOCKFILE="${BLOG_WATCHDOG_LOCKFILE:-/tmp/bilko.blog-cadence-watchdog.lock}"`.
- `tests/blog-cadence-watchdog.test.ts` passes in the combined run. I did not re-run two copies at once.
- `CLAUDE.md` Testing line is recounted with the date 2026-11-08. It still lists the failing test.

## Findings
### Critical
- None.
### Important
- `tests/mcp-errors-report.test.ts:395` (fixture `DETAIL`, expectation at `:396`). The view item needs `referrer_host: 'www.linkedin.com'` in the fixture, because the code reads the stored field and no longer parses `referrer`. Until then, `pnpm test` stays red and CLAUDE.md's "1 failing" stays true.
### Minor
- The PRD gates for 1706 and 1707 do not include the test file that covers `sessions_report` timelines (`tests/mcp-errors-report.test.ts`). Future gates for MCP report changes should include it.
- The validate PRD has no `Base:` line and its acceptance criteria do not list slugs. I took the five slugs from `dependsOn`.
