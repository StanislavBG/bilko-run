# Ship: real-visitor fix wave (Ship PRD 1709)

SHIP: PASS

Pushed SHA: ecd51e1ea1fd2dd52b6a91b832075d416319f93a (origin/main, 93ad58b7..ecd51e1e, fast-forward, no force, origin only: https://github.com/StanislavBG/bilko-run.git)
Push time: 9:03:50 AM PST, 2026-11-08.
Deploy: Render restarted the service at 9:05:56 AM PST, 2 min 6 s after the push (/api/health uptime 49 s at 9:06:45 AM PST). Baseline uptime just before the push was 512 s.

## Commits

The five fix commits are the ones named in validation/real-visitor-fix-wave.md (4aca5160). They were found by exact subject in `git cherry -v origin/main main` and cherry-picked in log order onto origin/main 93ad58b7 in the throwaway tree /tmp/ship-real-visitor-fixes.

| Local main SHA | Pushed SHA | Subject | Applied |
| --- | --- | --- | --- |
| b28f7e9c | 33471f87 | fix(telemetry): one bot rule; first-party desktop and CLI clients are not bots | conflict, resolved |
| c7b878c0 | ba7dd976 | fix(analytics): flag automation once per visitor and at write time | conflict, resolved |
| e27fb825 | 1a1622f7 | fix(admin): accurate git-viewer report and cheaper builder class | clean |
| 929df64c | d374adb5 | fix(mcp): sessions_report survives legacy ids; funnel and sessions agree on bots and apps | conflict, resolved |
| 33b7feee | a1ebb445 | fix(test): per-test lock for blog-cadence-watchdog; recount tests | clean |
| (new) | ecd51e1e | fix(test): sessions_report timeline fixture carries the stored referrer_host; recount tests | added here |

All three conflicts came from origin's dadcd3e5 (bilko_internal marker, PRD 1685), which landed on origin after these fixes were cut. Each resolution keeps both sides:
- server/routes/telemetry.ts: imports `internalFlag` and the fix's `beaconTag, isBotRequest`; drops the now-unused `classifyVisitor` import.
- server/page-hits.ts: the fix's per-chunk `stampAutomation` loop, with `is_internal` added to `insertStmt` (column and argument), so the marker is still written.
- server/routes/admin-funnel.ts: the fix's `feBotFilter`, and origin's `is_internal` exclusion in `feAdmin`; the doc comment names both.

The sixth commit was needed for the gate. 929df64c made the MCP timeline read the host's stored `referrer_host`, but the test fixture in tests/mcp-errors-report.test.ts still had only `referrer`. So the test failed on every run (local main's 33b7feee recorded it as "1 failing"). The fixture now carries `referrer_host`, as /api/admin/sessions/:id sends it, and CLAUDE.md's test count is updated.

Not pushed: the /book commits a41d4442, 440c5b89 and 6e5ceed1 belong to another plan, and the record commits stay local.

## Checks

- pnpm test on the pushed tree, 9:00:57 AM PST: exit 0. 181 files passed, 2 skipped; 2136 tests passed, 15 skipped. (First run, before the fixture fix: 1 failed, the test above.) PASS
- pnpm typecheck (client, server, scripts): exit 0. PASS
- pnpm build: exit 0. PASS
- `git status --short` was clean and origin/main was still 93ad58b7 when re-fetched just before the push. PASS
- Push: `git rev-list --count origin/main..HEAD` = 6, no merges, no force. `git ls-remote origin refs/heads/main` returned ecd51e1e right after. All 6 commits are authored by Bilko <bilko@bilko.run>. PASS
- GET /api/admin/git-viewer/profiles with the admin key, 9:06:52 AM PST: 200 application/json. `totals` has `built` (12), plus all 12, neverBuilt 0, claimed 0, unclaimed 12, showcaseStamped 0; byBuiltBy owner 0, automation 0, visitor 0, unknown 12. PASS
- X-SM-Beacon in a local server test: tests/telemetry.test.ts "a Session Manager beacon request stores is_bot = 0" (UA `node`, header `x-sm-beacon: session-manager/1.4.2`) stores is_bot 0 on funnel_events and app_errors. The other two beacon tests ("invalid X-SM-Beacon tag does not clear a HeadlessChrome flag", and "the beacon tag gives recognised clients their own per-IP bucket") pass too: 3 of 3. PASS
- The admin key (~/.config/bilko-host/admin-key) was sent only as a Bearer header through a curl config file in a mode-700 temp dir, used only for the read-only GET, and the dir was deleted. PASS
- Throwaway tree: the 2 node_modules symlinks (root and mcp-host-server) were unlinked, the main tree's node_modules were intact, and `git worktree remove` ran without --force. PASS

## Local main

Because three cherry-picks needed conflict resolution, their patches differ from the originals. After the push, `git cherry -v origin/main main` still marks b28f7e9c, c7b878c0 and 929df64c `+`; e27fb825 and 33b7feee are `-`. Their content is on origin. When scripts/sync-local-main.sh replays local main, it must drop those three originals rather than reapply them.

## Findings

- Critical: none.
- Important: none new.
- Minor: the /book fix commits (a41d4442, 440c5b89, 6e5ceed1) are still only on local main; their own Ship PRD must push them.
