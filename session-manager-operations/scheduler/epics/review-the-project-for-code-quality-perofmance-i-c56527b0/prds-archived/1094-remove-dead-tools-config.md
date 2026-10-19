---
title: Simplify routing: delete the leftover src/config/tools.ts and its broken agent-trace link
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T19:46:29.834Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [app-shell-lazy-routes]
planId: pl-mv1djnvm-ce23da
---
# Goal

migration. src/config/tools.ts (238 lines) is the remnant of the old in-repo AI-tool family. It now holds two entries: `agent-trace` (no page, yet listed in the Cmd-K palette as /products/agent-trace, which 404s) and `session-manager` (its page loader). Its ROUTABLE_TOOLS/toolRoutes machinery in App.tsx and LISTING_TOOLS merge in projectsRegistry.ts only serve that one page. Replace it with one explicit route and let the JSON registry be the single source of project listings. Read the landed App.tsx from app-shell-lazy-routes first.

# Acceptance criteria

- [ ] src/config/tools.ts is deleted; no file imports it.
- [ ] src/App.tsx routes /products/session-manager to a lazily loaded SessionManagerPage directly (same element/props it renders today); the toolRoutes/ROUTABLE_TOOLS code is gone.
- [ ] src/data/projectsRegistry.ts builds the project list only from src/data/standalone-projects.json (plus any non-tools sources it already uses); the session-manager entry still links to /products/session-manager in the Cmd-K palette and /projects (verify the JSON entry's kind/url; if it would resolve elsewhere, map it explicitly in projectsRegistry.ts and say so).
- [ ] agent-trace no longer appears in any project list or palette.
- [ ] tests/open-core-positioning.test.ts no longer reads tools.ts and keeps asserting the same product facts against the files that now hold them; full `pnpm test` green.
- [ ] The stale header comment at the top of projectsRegistry.ts is replaced with a short 'where to edit what' note: projects are added via the bilko-host MCP into standalone-projects.json; name which other files adjust display (projectsView.ts PUBLIC_SLUGS/DISPLAY_NAME/ENRICH).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/config/tools.ts
- src/App.tsx
- src/data/projectsRegistry.ts
- tests/open-core-positioning.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko.

Read first: src/config/tools.ts (session-manager entry ~170-205, ROUTABLE_TOOLS/LISTING_TOOLS exports); src/App.tsx (as landed by app-shell-lazy-routes); src/data/projectsRegistry.ts lines 1-110; tests/open-core-positioning.test.ts lines 40-70; the session-manager object in src/data/standalone-projects.json (~line 97).

Do not touch: src/pages/SessionManagerPage.tsx, src/data/standalone-projects.json, src/data/projectsView.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
timeout 400 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
