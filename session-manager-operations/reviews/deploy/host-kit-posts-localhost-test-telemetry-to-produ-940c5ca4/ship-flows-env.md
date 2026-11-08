# Ship: flows-env

SHIP: PASS

Pushed SHA: 026599114138a84122e9a8423b09dc7615aa9762 (origin/main, 2a0122ea..02659911, fast-forward, no force, origin only: https://github.com/StanislavBG/bilko-run.git)
Push time: 8:18:04 AM PST, 2026-11-08.

## Commits

Found on local main by exact subject (one match each) and cherry-picked in local-main order onto origin/main 2a0122ea in the throwaway tree /tmp/ship-flows-env. Both applied cleanly; no mcp-host-server/dist conflict.

| Local main SHA | Pushed SHA | patch-id (stable) | Subject |
| --- | --- | --- | --- |
| 12a9441a5c191bd3d7332d2bff27e3eeaf2f8257 | 84920352bbf984302452c807559ddb9a2a21578e | eeed8d70e24c9a882c58189202ad8d19c9ac8a12 | feat(admin): env filter on /api/admin/flows, prod by default |
| 39228786d130af4b0b453a99c3d052ba34834138 | 026599114138a84122e9a8423b09dc7615aa9762 | c8b1d4d551af4b2cff04701edc65e501a82aab46 | feat(mcp): flows_report env filter, prod by default |

Validation record: `docs(validation): flows env filter review` (d47bc2a0, local backup/main-pre-sync-20261108-0110) was already on origin/main as 1672bfb1 before this ship. Its subject count on origin/main was 1, so it was not re-picked.

Sibling plan: the real-visitor analytics commits (ed975e40, c371c81c, validation ee9bd8ba) were already on origin/main. `git log origin/main..main` on local main listed only the two commits above, so nothing else from local main was pushed.

## Checks (throwaway tree, HEAD 02659911, before the push)

- `pnpm vitest run tests/admin-sessions.test.ts tests/mcp-dist-sync.test.ts tests/mcp-errors-report.test.ts tests/mcp-report-defaults.test.ts`: 4 files, 80 tests passed, exit 0 (8:16:59 AM PST).
- `pnpm typecheck` (client, server, scripts): exit 0.
- `pnpm build`: exit 0 (vite build + precompress).
- Re-fetch right before the push: origin/main still 2a0122ea, an ancestor of HEAD (fast-forward).

## Deploy

- /api/health uptime before the push: 15407 s.
- 8:21:11 AM PST: uptime 54 s, 187 s after the push, so Render redeployed.

## Live check (8:21 AM PST, admin key as Bearer, read-only GETs, script /tmp/ship-flows-env-check/check.sh)

| Query | filters | academy events | sessions |
| --- | --- | --- | --- |
| `/api/admin/flows?app=academy&days=30` | `{"mine":"include","bots":"include","env":"prod"}` | 168 | 45 |
| `...&env=all` | `{"mine":"include","bots":"include","env":"all"}` | 168 | 45 |
| `...&env=prod` | `{"mine":"include","bots":"include","env":"prod"}` | 168 | 45 |

The default is prod, and env=all returns at least as many events (equal). Equal counts mean no academy rows in the last 30 days carry a non-prod env yet. That fits: host-kit only began stamping env in this Epic, and NULL env counts as prod.

## Cleanup

Symlinks removed, worktree /tmp/ship-flows-env removed. Local main was not touched; it already holds the two commits (same patch-ids).
