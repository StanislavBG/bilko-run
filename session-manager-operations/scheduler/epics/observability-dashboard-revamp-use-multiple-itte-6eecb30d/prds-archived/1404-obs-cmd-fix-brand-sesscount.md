---
title: Observability Command: brand bar holds at 1280px and Sessions shows a true shown / total
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-19T08:15:33.974Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: bug
agentType: dev-lead
disposition: new-head
planId: pl-mvezbyvq-761b17
---
# Goal

behavior: A live screenshot review found two deviations from docs/design/observability-command/. At 1280x760 the top-bar brand wraps 'Bilko / Bibitkov' onto two lines and the '// COMMAND' tag truncates, but the design keeps the brand on one line (prototype lines 29-35). Separately, the Sessions stage count always reads '{n} / {n}' (SessionsModule.tsx line ~229) instead of shown vs total as the design specifies (prototype line 154, 715).

# Acceptance criteria

- [ ] src/pages/admin/command/CommandShell.tsx: the brand name never wraps (whiteSpace nowrap, flex none), and below 1360px viewport width the '// COMMAND' tag is hidden rather than truncated; the top bar fits one 38px row at 1280x760 with every control visible.
- [ ] src/pages/admin/command/SessionsModule.tsx: the count reads '{shown} / {total}', where total is the size of the most recent unfiltered list for the current window and shown is the current filtered list; with an empty filter both numbers are equal; total resets when the window changes.
- [ ] A 1280x760 Playwright screenshot of /admin/observability/preview (DEV server, throwaway script under TMPDIR, not committed) shows the brand on one line; the run report says so.
- [ ] `pnpm typecheck` passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/CommandShell.tsx
- src/pages/admin/command/SessionsModule.tsx

# Implementation notes

Read first:
- src/pages/admin/command/CommandShell.tsx lines 180-230 (top bar).
- src/pages/admin/command/SessionsModule.tsx lines 80-140 (list fetch + filter) and ~229 (count).
- docs/design/observability-command/Observability Command.dc.html lines 27-61, 150-155.
Dev-server note: Vite watches session-manager-operations/ and reloads the page every few seconds while the scheduler runs. For the screenshot, start vite with a throwaway config under TMPDIR that imports the repo vite.config.ts and adds server.watch.ignored for '**/session-manager-operations/**' (PRD obs-cmd-vite-ignore-scheduler fixes this in the repo separately; do not edit vite.config.ts here). Clerk 400s on localhost are expected.
Work as the dev-lead persona.

# Out of scope

- vite.config.ts
- Other modules.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
