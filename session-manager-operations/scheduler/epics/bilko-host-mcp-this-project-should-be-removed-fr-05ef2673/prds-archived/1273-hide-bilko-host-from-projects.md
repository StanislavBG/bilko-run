---
title: Hide Bilko Host MCP from the public /projects listing
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-12T05:21:53.170Z
sourcePromptId: bilko-host-mcp-this-project-should-be-removed-fr-05ef2673
agentType: dev-lead
planId: pl-mv4t1ngy-6164e0
---
# Goal

migration: Remove the `bilko-host` ("Bilko Host MCP") entry from the public project listing on bilko.run (/projects hub and homepage recent builds), by removing its `public: true` flag in the registry. The entry itself stays registered so the bilko-host MCP, admin-only /projects view, and enrichment keep working; only public visibility changes.

# Acceptance criteria

- [ ] src/data/standalone-projects.json: the entry with slug `bilko-host` no longer has `"public": true` (key removed); all other fields and all other entries are byte-for-byte unchanged.
- [ ] tests/projects-view.test.ts: the `['bilko-host', 'Bilko Host MCP']` row is removed from EXPECTED, and the test passes — PUBLIC_CARDS from src/data/projectsView.ts no longer contains slug `bilko-host`.
- [ ] src/data/projectsView.ts ENRICH['bilko-host'] is left in place (admin view still shows the card).
- [ ] `pnpm test` and `pnpm typecheck` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/standalone-projects.json
- tests/projects-view.test.ts

# Implementation notes

Read first: src/data/standalone-projects.json lines 475-495 (the bilko-host entry); src/data/projectsView.ts lines 120-190 (isPublic = p.public === true; PUBLIC_CARDS/PUBLIC_SLUGS derive from it); tests/projects-view.test.ts (whole file, ~20 lines).
Steps:
1. tests/projects-view.test.ts: delete the line `['bilko-host', 'Bilko Host MCP'],` from EXPECTED. Run `pnpm vitest run tests/projects-view.test.ts` — it should fail (red).
2. src/data/standalone-projects.json: in the `bilko-host` entry, delete the `"public": true` line and fix the trailing comma on the preceding `"tags": [...]` closing bracket so the JSON stays valid. Preserve the file's existing 2-space indentation and trailing newline. Do not reorder entries.
3. Re-run the test (green), then the full gate.
Notes: do NOT unregister the project via the bilko-host MCP — the user wants it off the listing, not deleted. Do NOT touch mcp-host-server/ (no dist rebuild needed; no src change there). HomePage.tsx filters by PUBLIC_SLUGS so it follows automatically.
Do not touch: mcp-host-server/, src/pages/, public/.

# Out of scope

- Unregistering bilko-host from the registry
- Removing ENRICH['bilko-host'] or any MCP server code
- Editing blog posts or blog-from-git rotation ledgers that mention bilko-host

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/projects-view.test.ts
timeout 600 pnpm test && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
