---
title: Dev server: stop Vite reloading the page on scheduler state writes
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-19T08:16:54.514Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: bug
agentType: dev-lead
disposition: new-head
planId: pl-mvezdp0y-287ae3
---
# Goal

behavior: While the session-manager scheduler runs, `pnpm dev` performs a full page reload every few seconds. The Vite log shows '[vite] (client) page reload session-manager-operations/scheduler/state/queue.json', so any page under dev, including /admin/observability/preview, keeps resetting to 'Loading…'. Make the dev server ignore the scheduler's operational state directory.

# Acceptance criteria

- [ ] vite.config.ts sets server.watch.ignored to include '**/session-manager-operations/**' while keeping the existing port 3002 and the /api and /og proxies unchanged.
- [ ] With the dev client running for 30 seconds while a file under session-manager-operations/ is touched every 3 seconds, the Vite log contains no 'page reload session-manager-operations' line (verified in the run with a bounded loop; the run report quotes the grep count).
- [ ] `pnpm typecheck` passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- vite.config.ts

# Implementation notes

Read first: vite.config.ts (whole file, ~50 lines).
Verification: start `pnpm exec vite --port <free port> --strictPort` under `timeout 60` in the background with its log redirected under TMPDIR; touch a throwaway file under session-manager-operations/ (e.g. session-manager-operations/.vite-watch-probe, then delete it; do not commit it) every 3s for 30s with a bounded for-loop; grep the log. Kill the server afterwards.
Work as the dev-lead persona.

# Out of scope

- Any src/ change.

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
