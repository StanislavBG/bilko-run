# Transcript — stale-bilko-host-mcp-processes-fail-every-call-w-bf5ee545

## User — 2026-10-13T20:58:45.259Z

This session is INBOUND FEEDBACK from another project: social-signals-trader (/home/bilko/Projects/social-signals-trader, session review-project-stability-is-the-tradong-resumed--26c177a2). It was raised while working on: Review project stability  Is the tradong resumed? is it going to be happening naturally going forwarD?. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Stale bilko-host MCP processes fail every call with a misleading "invalid registry entry (git-viewer)" error after the listing-schema change

## Why
Projects are now expected to maintain their own bilko.run cards through the bilko-host MCP. Any agent session whose bilko-host server process started before bb6378e ("add offering, pricing, callToAction, avoidClaims listing fields") cannot read or update ANY card: get_project, list_projects and update_project_listing all fail with `invalid registry entry (slug "git-viewer", field "listing"): Unrecognized key(s) in object: 'offering', 'pricing', 'callToAction', 'avoidClaims'`. The message blames git-viewer's data, so callers chase the wrong problem; the real cause is their own stale server process. social-signals-trader hit this on 2026-10-13 and had to spawn a fresh server process to update its card (that worked: pushed 4a52f15).

## Proposed plan
1. Make registry validation failures caused by unknown listing keys say so explicitly, e.g. 'this bilko-host server (built <version/commit>) does not know listing keys X; the registry was written by a newer version — restart/reconnect the bilko-host MCP'.
2. Optionally expose the server's build commit in a tool (status/get_host_contract) and compare it to the host repo HEAD at call time, warning when stale.
3. Consider validating only the entry being read/written (plus a lenient parse of others) so one unknown key elsewhere does not block every project's card.

## Acceptance criteria
- [ ] A bilko-host server process older than the registry schema returns an error that names the stale-server cause and tells the caller to reconnect the MCP, instead of blaming another project's entry.
- [ ] update_project_listing for one project is not blocked by an unrelated project's entry containing keys this server version does not know (or the error clearly explains why).

## Details
Evidence (2026-10-13 ~09:47 PDT): this session's bilko-host process was `node /home/bilko/Projects/Bilko/mcp-host-server/dist/server.js` started Mon Oct 12 19:09 (pid 2725477); Bilko's mcp-host-server/src/contract/registry.ts and dist already include avoidClaims (commit bb6378e). get_project('social-signals-trader'), list_projects() and update_project_listing all failed with the git-viewer error above. Spawning a fresh `node .../dist/server.js` over stdio and calling the same tools worked: get_project returned the card; update_project_listing returned 'updated listing: social-signals-trader / pushed: 4a52f15...'. Note: get_project on the fresh process still showed the old card right after the update because it reads the local Bilko checkout while the update commits and pushes from a separate publish checkout — readers may think the update failed; consider reading back from the published state or saying so in the response.

Reference: /home/bilko/Projects/Bilko/mcp-host-server/src/contract/registry.ts
Reference: /home/bilko/Projects/Bilko/mcp-host-server/src/server.ts
