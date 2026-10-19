---
title: Observability Command: 07 Bandwidth module (egress share, projects, routes, file drilldown)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T05:20:55.145Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

feature: Implement module 07 Bandwidth per docs/design/observability-command/README.md section "07 Bandwidth" and prototype lines 417-464 from /api/admin/egress, keeping the existing per-project top-files drilldown and empty states.

# Acceptance criteria

- [ ] src/pages/admin/command/BandwidthModule.tsx exports `BandwidthModule({ stage, egress, days })` and pure `egressInsight(egress)` returning {topSlug, byteShare, reqShare, perReq, segments:[top1, top2, rest]} or null when there are no bytes.
- [ ] Stage: total MB, amber insight sentence '{top} serves X% of all bytes from Y% of requests — Z per request.', 46px share bar (top1 orange, top2 amber, rest #5d5648 with title tooltip), PROJECT table (REQ, BYTES, /REQ amber when >= 1 MB) and VERB/ROUTE table (POST amber), per prototype lines 421-451.
- [ ] Clicking a project row fetches GET /admin/egress?days&slug via useAdminFetch and shows its top files ('_rest' reads 'everything else') with a back control, ignoring stale responses.
- [ ] Empty states preserved: earliestDate === null -> 'metering never ran'; zero bytes -> 'no traffic in window'.
- [ ] Compact: total, 8px share bar, top 5 projects (prototype lines 452-462).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/BandwidthModule.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md (Tokens; 07 Bandwidth).
- docs/design/observability-command/Observability Command.dc.html lines 417-464 and 690-691.
- src/pages/admin/BandwidthPanel.tsx (existing drilldown, stale guard lines 59-69, empty states 82-134).
- src/pages/admin/command/theme.tsx and types.ts (from obs-cmd-theme-types).
Work as the dev-lead persona.

# Out of scope

- Server changes.
- Editing BandwidthPanel.tsx.

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
