---
title: Privacy + size: don't ship local repo paths from the project registry to every browser
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:09:22.911Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kuwkf-fa0299
---
# Goal

behavior. src/data/projectsRegistry.ts imports all of src/data/standalone-projects.json into the main bundle, including `sourceRepo` and `localPath` (e.g. `~/Projects/git-viewer`), which no src/ file reads. These fields leak the owner's machine layout to every visitor and add weight. Strip the unused fields at build time with a small Vite plugin.

# Acceptance criteria

- [ ] vite.config.ts gains a tiny inline plugin that transforms the import of src/data/standalone-projects.json for the client build, removing `localPath` and `sourceRepo` (and any other field the report shows no src/ file reads, verified with git grep) from every entry.
- [ ] After `pnpm build`, `git grep`-style search of dist/assets/*.js finds no `localPath` key and no `~/Projects/` string (report the command and result).
- [ ] Server code and mcp-host-server still read the full JSON from disk (unaffected); `pnpm test` stays green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- vite.config.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Vite 6. Read first: vite.config.ts; src/data/projectsRegistry.ts lines 60-110; `git grep -n -e sourceRepo -e localPath -- src`. Do not touch: src/data/standalone-projects.json, src/data/projectsRegistry.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm build
timeout 300 pnpm typecheck
timeout 400 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
