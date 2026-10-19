---
title: List the Launch Kit on the public /projects hub (registry public flag, hub row, test)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-11T07:35:29.535Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
planId: pl-mv3idm9q-d23f06
---
# Goal

behavior: make the Bilko Launch Kit (slug launch-kit, static-path /projects/launch-kit/) show on https://bilko.run/projects for signed-out visitors. Its entry in src/data/standalone-projects.json has no `public` field, so PUBLIC_CARDS in src/data/projectsView.ts filters it out and only the admin "show all" toggle reveals it. Set the public flag and hub display name, give it a hub-row enrichment like the other public projects, and update the public-cards test.

# Acceptance criteria

- [ ] src/data/standalone-projects.json: the launch-kit entry has "public": true and "displayName": "Launch Kit" (after "tags", matching the file's 2-space formatting); no other entry changes.
- [ ] src/data/projectsView.ts: ENRICH has a 'launch-kit' entry with metric '8 skills', metricLabel '$9 one-time', lang 'Markdown', and detail exactly 'Eight Claude skills that run your launch from one shared context file: page roast, headlines, pricing, launch emails, launch week, build-in-public posts, first 100 customers. Each writes one file and names the next skill to fire.'
- [ ] tests/projects-view.test.ts: EXPECTED gains ['launch-kit', 'Launch Kit'] as its last entry (launch-kit has no commit-counts.json entry yet, so it sorts last); the test was seen failing before the registry edit and passes after.
- [ ] The registry still validates: tests/registry-contract.test.ts and tests/mcp-publish-request.test.ts (parseRegistry on the real file) pass.
- [ ] pnpm typecheck exits 0.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/standalone-projects.json
- src/data/projectsView.ts
- tests/projects-view.test.ts

# Implementation notes

Read first:
- src/data/projectsView.ts lines 59-96 (ENRICH map) and 120-170 (projectCard: name = displayName ?? name, isPublic = public === true; HUB_CARDS sort; PUBLIC_CARDS filter).
- src/data/standalone-projects.json lines 515-532 (the launch-kit entry, last in the array).
- tests/projects-view.test.ts (whole file, 20 lines).
- Precedent: `git show 1df564f` made Escape Velocity public the same way, before `public`/`displayName` moved into the registry JSON (commit 435e630).

Steps:
1. tests/projects-view.test.ts: append ['launch-kit', 'Launch Kit'] to EXPECTED. Run `pnpm vitest run tests/projects-view.test.ts` and see it fail (red) — capture it early so the run ends green.
2. src/data/standalone-projects.json: in the launch-kit object, add `"public": true` and `"displayName": "Launch Kit"` after the "tags" array. Hand-editing is correct here: this is the host repo, and the bilko-host MCP register tool cannot set these two fields (a separate plan fixes that). Keep the trailing newline.
3. src/data/projectsView.ts: add the 'launch-kit' ENRICH entry right after 'escape-velocity', same shape and quoting style as its neighbours.
4. Re-run the test (green), then the gate.

Do not touch: src/data/commit-order.json and src/data/commit-counts.json (the next PRD refreshes them), mcp-host-server/ (another plan), public/projects/launch-kit/ (a published artifact), and the private /home/bilko/Projects/Bilko-Launch-Kit repo. Do not push; a later deploy PRD pushes.

# Out of scope

- Refreshing commit-order.json / commit-counts.json
- Pushing or deploying
- Changing the bilko-host MCP server
- Adding launch-kit to the home page portfolio list (src/data/portfolio.ts)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/projects-view.test.ts tests/registry-contract.test.ts tests/mcp-publish-request.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
