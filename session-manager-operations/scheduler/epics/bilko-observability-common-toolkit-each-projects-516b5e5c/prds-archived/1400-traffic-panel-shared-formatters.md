---
title: TrafficPanel uses shared admin formatters (last duplicate fmtTime/shortId)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-19T05:48:37.319Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
disposition: new-head
planId: pl-mveu2zwn-4c8b99
---
# Goal

migration: src/pages/admin/TrafficPanel.tsx (lines 76-77) still defines a local shortId identical to src/lib/format.ts, and a local fmtTime that differs from the shared one only by appending the time-zone abbreviation. That is the last duplicate the observability cleanup validator found. Move the zoned variant into src/lib/format.ts under its own name and have TrafficPanel import both helpers.

# Acceptance criteria

- [ ] src/lib/format.ts exports fmtTimeZoned(ts: number), which returns new Date(ts).toLocaleString(undefined, { timeZoneName: 'short' }), exactly what TrafficPanel shows today. The existing fmtTime is unchanged.
- [ ] src/pages/admin/TrafficPanel.tsx imports shortId and fmtTimeZoned from '../../lib/format.js' and defines no local fmtTime or shortId: rg -n 'const (fmtTime|shortId)' src/pages/admin returns nothing.
- [ ] TrafficPanel's rendered text is unchanged: every former fmtTime call site now calls fmtTimeZoned.
- [ ] pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/lib/format.ts
- src/pages/admin/TrafficPanel.tsx

# Implementation notes

Read first: src/lib/format.ts (whole file); src/pages/admin/TrafficPanel.tsx lines 1-10 (imports) and 70-80; rg -n 'fmtTime\\(' src/pages/admin/TrafficPanel.tsx (the call sites).

Do not touch any other file.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-trafficfmt --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
