---
title: Register and publish the Launch Kit landing page at bilko.run/projects/launch-kit/ via the bilko-host MCP and verify it live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-11T04:41:37.509Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-deploy-api, launch-kit-buy-flow]
planId: pl-mv3bwyfa-549f4d
---
# Goal

deploy: put the Launch Kit sales page live through the sanctioned sibling-publish path. Register slug 'launch-kit' in the host registry (so it shows on /projects and in the command palette) and publish /home/bilko/Projects/Bilko-Launch-Kit/site/dist with every publish gate passing, then prove the landing and thanks pages are served live and talk to the production API. The paid zip must never reach the published folder.

# Acceptance criteria

- [ ] Before publishing, the run fails if any *.zip or SKILL.md file exists under /home/bilko/Projects/Bilko-Launch-Kit/site/dist (checked with find, inverted so the clean case exits 0).
- [ ] mcp__bilko-host__register_static_project registers slug 'launch-kit' (name 'Bilko Launch Kit', displayName 'Launch Kit', tagline '8 Claude skills that take your product from it-works to launched. $9.', category 'Claude Skills · Download', status 'live', year 2026, tags ['Claude Code','Paid'], public true, host localPath '~/Projects/Bilko-Launch-Kit', no public sourceRepo); a re-run that finds it already registered skips this step.
- [ ] mcp__bilko-host__publish_static_project publishes {slug 'launch-kit', distPath '/home/bilko/Projects/Bilko-Launch-Kit/site/dist', sourceRepoPath '/home/bilko/Projects/Bilko-Launch-Kit/site'} with NO gate bypassed; on a gate failure the run fixes the site and rebuilds at most twice, then FAILs with the gate output.
- [ ] Bounded poll (max 20 x 30s): https://bilko.run/projects/launch-kit/ returns 200 containing 'Launch Kit' and '$9'; https://bilko.run/projects/launch-kit/thanks/?session_id=x returns the launch-kit thanks page (not the main bilko.run SPA shell); https://bilko.run/og/launch-kit.png returns 200; no URL under https://bilko.run/projects/launch-kit/ serves a .zip.
- [ ] session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-publish-landing.md is committed and pushed to origin main (after a conflict-free `git pull --rebase origin main`; origin only) with the publish commit SHA from mcp__bilko-host__status, times in America/Los_Angeles with PDT/PST, and each check PASS/FAIL.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-publish-landing.md

# Implementation notes

The bilko-host MCP is registered at user scope but its tools arrive deferred: load them first with ToolSearch `select:mcp__bilko-host__register_static_project,mcp__bilko-host__publish_static_project,mcp__bilko-host__list_projects,mcp__bilko-host__status,mcp__bilko-host__get_host_contract`. Read the tool schemas before calling; read docs/host-contract.md 'Registry rules' and 'Manifest contract'. These tools commit and push to origin from their own publish checkout — do not copy files into public/projects/ by hand.

Steps:
1. Rebuild site/ (`pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site build`) and run the no-paid-files check.
2. list_projects -> register if missing -> publish -> status.
3. Live checks with `curl --max-time 15` in a bounded loop (`for i in $(seq 1 20)`). Distinguish the thanks page from the SPA by a launch-kit-specific string in its HTML.
4. Write the record, commit only it, rebase on origin/main (conflict-free), push origin.

Do not touch: server code, the sibling's pack/ or dist-pack/.

# Out of scope

- A real purchase (launch-kit-e2e-purchase)
- Blog or social announcement

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 curl -sf --max-time 15 https://bilko.run/projects/launch-kit/
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
