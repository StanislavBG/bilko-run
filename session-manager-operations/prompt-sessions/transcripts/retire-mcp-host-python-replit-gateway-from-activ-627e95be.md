# Transcript — retire-mcp-host-python-replit-gateway-from-activ-627e95be

## User — 2026-10-09T17:50:19.729Z

This session is INBOUND FEEDBACK from another project: /home/bilko/Projects/MCP-Host (session investigate-project-state-i-think-i-took-down-th-9c9bf55e). Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Retire MCP-Host (Python/Replit gateway) from active listings + future blog content; keep existing posts

**Owner decision (2026-10-09):** The Python MCP-Host gateway ("the iStore for MCPs", github.com/StanislavBG/MCP-Host) has been decommissioned. Its Replit Reserved VM was taken down to stop spend. Verified today: the Replit MCP `get_publish_status` for replId fc7604c9-477e-4138-a998-3a2aa24370f1 returns `found:false` (no deployment), and both https://mcp-host.replit.app/health and https://bilko-mcp-host.replit.app/health return 404 "This app isn't live yet".

**Ask from the owner:** remove MCP-Host from bilko.run's ACTIVE listing so that future blogs and listing-driven content skip it. **Leave the existing blog posts as they are.** Do not edit or unpublish them.

**What I found in this repo (origin/main @ 3188782). I'm only reporting it here and changed nothing:**
1. `src/data/standalone-projects.json:470` has slug `mcp-host`, status `live`, and URL github.com/StanislavBG/bilko-run/tree/main/mcp-host-server. The listing text describes bilko.run's own TypeScript `bilko-host` publishing server, not the Python gateway. The blog ledger merges the two under one slug: `.claude/skills/blog-from-git/blog-ledger.md` attributes both `mcp-host-istore-for-mcps` (2026-06-03, the Python gateway) and `siblings-can-now-see-their-own-bandwidth-bill` (2026-08-19, the TS server) to `mcp-host`.
2. `src/data/projectsView.ts:37` lists `mcp-host` in PUBLIC_SLUGS, and `:100` has a hub card that says "live registry, TypeScript".
3. `src/data/commit-counts.json` and `src/data/commit-order.json` have `mcp-host` entries.
4. The blog rotation (`rotation.md`, `blog.config.yaml`) has no exclusion list for retired projects. Off-list projects can still be blogged, so removing the tile alone may not keep the pipeline away from MCP-Host.

**Decisions for this repo:**
- The owner told the MCP-Host session to go ahead and remove the `mcp-host` listing. Before you do, confirm whether the bilko-host TS server should keep a tile of its own. If it should, re-slug or re-describe it (e.g. `bilko-host`) so it can't be confused with the retired gateway. If not, unregister `mcp-host` through the bilko-host MCP (or set it to `archived`) and clean up the PUBLIC_SLUGS / hub-card / commit-count entries.
- Add a durable "retired / do-not-cover" list (e.g. in `blog.config.yaml` rotation) with the Python MCP-Host (and its demo providers edgar-rag / social-trader as hosted on it), so blog-from-git and spotlight mode never choose it as a subject again.
- Existing posts stay unchanged.

Reference: /home/bilko/Projects/Bilko/src/data/standalone-projects.json
Reference: /home/bilko/Projects/Bilko/src/data/projectsView.ts
Reference: /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/rotation.md
Reference: /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/blog.config.yaml
Reference: /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/blog-ledger.md

## Agent — 2026-10-09T17:56:44.669Z

The `mcp-host` listing on bilko.run is gone, and the blog pipeline can no longer pick the retired Python MCP-Host as a subject. Existing posts weren't touched. Tests (725) and typecheck pass, and the change is pushed to `origin/main` as `6ae91ae`; Render deploys it from there.

**What I checked first.** The report was right. The `mcp-host` tile didn't describe the retired Python gateway. It described bilko.run's own TypeScript publishing server in `mcp-host-server/`, which is still running (it's the `bilko-host` MCP). Only the shared name made them look like the same thing.

**What I decided.** The TypeScript server keeps its tile under a new name, so nothing called "MCP Host" stays listed:
- **Tile:** the slug is now `bilko-host` and the name is "Bilko Host MCP". It's still live, still public, and links to the same GitHub folder.
- **Hub card:** the old description was close to the gateway's pitch ("Claude sessions … discover and call one another"). It now says what the server actually does: sibling repos use it to register, publish and inspect their apps, and to check their own usage.
- **Renamed to match:** the commit-count and commit-date entries, the refresh script that rebuilds them, and the homepage ticker line.

**Keeping the blog off it:**
- `blog.config.yaml` has a new `rotation.retired_subjects` list. It covers the Python MCP-Host and the demo providers it hosted (edgar-rag and social-trader). edgar-rag and social-signals-trader as standalone projects are not affected.
- `rotation.md` has a new rule: anything on that list is never a post subject in any mode, no override allowed, and commits in its repo are ignored.
- The watchdog script reads the list, removes those slugs from spotlight picks, and states the rule in every publish prompt. It matches slugs exactly, so retiring `mcp-host` can't knock out `bilko-host`. I added two tests for this.
- **Ledger:** the 2026-08-19 post (about the TypeScript server) is now attributed to `bilko-host`. The 2026-06-03 post is marked `mcp-host (retired 2026-10-09)`. Neither post was edited.

One side effect: the blog pipeline treats `bilko-host` as a new project, so it may be picked for a spotlight post soon. That's allowed, since it's a different, live project.
