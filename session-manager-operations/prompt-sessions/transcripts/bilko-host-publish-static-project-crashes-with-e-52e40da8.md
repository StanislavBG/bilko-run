# Transcript — bilko-host-publish-static-project-crashes-with-e-52e40da8

## User — 2026-10-04T19:05:39.066Z

This session is INBOUND FEEDBACK from another project: /home/bilko/Projects/Bilko-Academy (session academy-state-this-is-a-bad-type-of-widgets-no-m-18b23380). Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: bilko-host publish_static_project crashes with ENOENT when ~/.local/state/bilko-host/ is missing

On 2026-10-04, publishing Academy with the bilko-host MCP tool `publish_static_project` (slug academy) failed after the gates with `ERROR: ENOENT: no such file or directory, mkdir '/home/bilko/.local/state/bilko-host/publish-checkout.lock'`. The parent directory ~/.local/state/bilko-host/ did not exist. A manual `mkdir -p` fixed it, and the retry published 368bf9b, which deployed. Expected: the publish code creates its state directory recursively before taking the lock (mkdir with recursive on the parent). Look at the mcp-host-server publish path where publish-checkout.lock is created. Also worth documenting: headless `claude -p` scheduler runs didn't have the bilko-host MCP tools, so Academy's scheduled publish PRD couldn't publish at all.

## Agent — 2026-10-04T19:07:56.154Z

The crash report is correct, and I've fixed it in commit `355a262`, pushed to `origin/main`.

**The bug:** In `mcp-host-server/src/publish-checkout.ts`, the publish code creates its lock directory with a plain, non-recursive `mkdir`. That happens before `ensureCheckout` creates the parent `~/.local/state/bilko-host/`, so on a machine where that folder doesn't exist yet, publishing fails with ENOENT.

**The fix:** `withPublishCheckout` now creates the parent folder recursively before taking the lock. I rebuilt `dist/` and committed it with the change.

**Test:** I added a regression test to `tests/mcp-publish-checkout.test.ts`. Without the fix it fails with the same ENOENT error Academy reported; with the fix, all 8 tests in that file and `mcp-dist-sync.test.ts` pass.

**The headless claim didn't check out as stated:**
- bilko-host is registered at user scope in `~/.claude.json`, so headless `claude -p` runs load it.
- The scheduler's `buildClaudeSpawnArgs` only blocks built-in tools (ScheduleWakeup, the Cron tools, Monitor, the plan and worktree tools) and doesn't remove MCP servers.
- The likeliest cause is that MCP tools load as deferred tools, so a headless run has to fetch them with ToolSearch before it can call them. This is unconfirmed: I didn't have the failing run's transcript.

I added a "Headless / scheduled runs" section to `mcp-host-server/README.md` covering user-scope registration and the ToolSearch step. Academy's scheduled publish PRD should say it needs to load `mcp__bilko-host__publish_static_project` through ToolSearch first.

Any bilko-host MCP server that's already running keeps the old code until it's restarted, which happens when a new Claude session starts. Academy's manual `mkdir -p` already works around the bug on this machine.
