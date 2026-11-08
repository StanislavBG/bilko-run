# Ship: internal-traffic marker (PRDs 1685, 1686)

SHIP: PASS. 8:24 AM to 8:27 AM PST, 2026-11-08 (America/Los_Angeles). Shipped by hand from the inbound-feedback Epic session. The scheduled Ship (1686) was cancelled mid-run, so it would not push a duplicate.

## What happened to 1685

PRD 1685 showed `completed` (exit 0, gate passed, 1:15 AM PST) but landed nothing. Its executor never committed. The app restarted mid-run (adoptedAtBoot), and the job worktree was removed with the work uncommitted. The gate was the full suite plus typecheck, which also pass on an unchanged tree. The work was recovered by replaying the executor's own edits from its transcript (session 9da8f0aa) into a throwaway tree at its base. All 14 edits replayed with the same outcome as the original run. The work was then rebased onto origin/main. Reported to Session Manager as a proposed bug session.

## Commits

- `feat(analytics): bilko_internal marker counts automation as the owner's traffic`: dadcd3e5. Includes one test fix the replay exposed. tests/agent-buy.test.ts read is_admin as the last insert argument; it now reads each flag by its column.
- `feat(mcp): report descriptions name the bilko_internal marker`: f13cbd9b. Updates the flows_report, sessions_report and traffic_report descriptions, with dist rebuilt.
- Pushed `02659911..f13cbd9b` with `git push origin HEAD:main` from /tmp/replay-1685. No other commit was pushed.

## Checks

| Check | Result |
| --- | --- |
| `pnpm vitest run` on the pushed tree | PASS (2108 passed, 15 skipped) |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |
| Render deploy newer than the push | PASS (/api/health uptime 35 s at 8:26:59 AM PST; push 8:24:15 AM PST) |
| Headless Chromium load of https://bilko.run/projects/academy/?bilko_internal=1 | PASS (200; bilko_internal=1 cookie, 24 h) |
| That session in /api/admin/sessions?days=1&mine=include&bots=include | PASS (found; internal: true, mine: true, bot: true from the HeadlessChrome UA) |
| Same read with mine=exclude&bots=include | PASS (absent, so the marker alone drops it) |
| /api/admin/flows?app=academy&days=30&mine=exclude&bots=exclude | PASS (200; filters {mine: exclude, bots: exclude, env: prod}) |

Academy's 30-day flows with both filters still show course start 7 and lesson start 7 across 19 sessions. Historical rows are not re-flagged (out of scope). Burrow's 2026-11-03 link checks and similar runs stop counting only once that automation sends the marker or reports navigator.webdriver.

Local main was not synced: three Bilko jobs (1703, 1711, 1712) were running. Siblings get the new MCP descriptions after the next sync and a new session.
