# Transcript — live-bilko-host-registry-still-has-no-offering-p-456f236e

## User — 2026-10-17T19:15:18.022Z

This session is INBOUND FEEDBACK from another project: Bilko-Academy (/home/bilko/Projects/Bilko-Academy, session sync-bilko-listing-json-with-the-live-listing-of-cc533d10). It was raised while working on: Sync bilko.listing.json with the live listing (offering/pricing/callToAction/avoidClaims) so the next publish doesn't wipe them. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Live bilko-host registry still has no offering/pricing/callToAction for academy

## Why
Academy synced bilko.listing.json with the marketing fields Bilko set on 2026-10-15 (commit 6abd311 in Bilko-Academy). But the running bilko-host MCP's get_project("academy") on 2026-10-17 returns only audience, talkingPoints and shareImage. So the update_project_listing change, or commit ee742ec, never reached the live host. X marketing will keep skipping Academy until that's fixed.

## Acceptance criteria
- [ ] get_project academy returns offering, pricing, callToAction and avoidClaims
- [ ] https://bilko.run/api/projects returns academy with non-empty offering, pricing and call_to_action

## Details
Observed 2026-10-17 via mcp bilko-host get_project slug=academy: the listing has only audience, talkingPoints and shareImage. Possible causes: the host process is running a stale registry and needs a restart or redeploy, or the edit landed in src/data/standalone-projects.json without going through the live host's store. Academy's bilko.listing.json now carries all four fields, so the next Academy publish (or an update_project_listing call) should fill them in. Worth checking the outdoor-hours entry too.

## Agent — 2026-10-17T20:07:09.744Z

The report is half right. The fields were never lost. The live site already serves them, and the stale data is a bug in how the bilko-host MCP reads the registry. I've fixed that here.

**What I checked:**
- **bilko.run is fine.** `https://bilko.run/api/projects` already returns academy with `offering: content`, `pricing: free`, `call_to_action` and all 5 `avoid_claims`. outdoor-hours has all four fields too. Commit `ee742ec` reached `origin/main` and Render deployed it.
- **`get_project("academy")` really does return only audience, talkingPoints and shareImage.** That's because the MCP's read tools read the registry file from the `~/Projects/Bilko` working folder, which only updates when someone pulls. It's 12 commits behind `origin/main` right now. Writes like `update_project_listing` and publishes push from a separate checkout, so reads never saw them.

**The fix (commit `34ed1c4`):**
- I added `mcp-host-server/src/registry-source.ts`. It fetches `origin/main` and reads the registry from there without touching the working folder. If it's offline or there's no remote, it falls back to the local file and says so in the output.
- `get_project`, `list_projects` and the quick owner check at the start of `publish_static_project` now use it. I rebuilt `dist/`, added `tests/mcp-registry-source.test.ts` and updated the README.
- Run against the real `~/Projects/Bilko`, the new reader returns academy's offering, pricing, callToAction and all 5 avoidClaims.
- Typecheck passes, and the full suite passes (104 files, 1176 tests).

**What's still open:**
- The commit is on this epic branch only. I haven't merged it to `main` or pushed it.
- The running bilko-host MCP keeps returning the old data until it's restarted after the fix is pulled into `~/Projects/Bilko`.
- `~/Projects/Bilko` is still behind `origin/main`, and its working tree has uncommitted changes from other work. I left it alone because a pull could clash with those files.
- Academy doesn't need to republish anything.

## User — 2026-10-17T23:29:10.208Z

finish all and merge

## Agent — 2026-10-17T23:38:11.012Z

The fix is merged and pushed. A freshly started bilko-host MCP now returns academy's offering, pricing, callToAction and all 5 avoidClaims, so both acceptance criteria hold.

- **Pushed:** I cherry-picked the fix onto `origin/main` and rebuilt `dist/`. Typecheck and the full suite passed (105 files, 1178 tests), and I pushed it as `ca6ed18` to `StanislavBG/bilko-run` `main`.
- **Live site:** `https://bilko.run/api/projects` already returned academy and outdoor-hours with all four fields before this change. The site was never the problem.
- **Main checkout:** I moved `~/Projects/Bilko` onto `origin/main`; the MCP runs from there.
  - Its 3 local-only commits were older copies of work already on origin, and I saved them on the branch `backup/main-pre-sync-20261017`.
  - The few uncommitted files that clashed with the update already matched origin exactly, so nothing was lost.
  - The other sessions' uncommitted work (outdoor-hours data, session-manager-operations files, 695 files in all) is still there.
- **Restart needed:** MCP clients that were already running keep the old code until they restart. Academy doesn't need to republish anything.
