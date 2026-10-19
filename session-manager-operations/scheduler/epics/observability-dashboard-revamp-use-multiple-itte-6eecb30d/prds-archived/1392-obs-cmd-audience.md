---
title: Observability Command: 05 Audience module (device/browser donuts, visitors, visitor timeline)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T05:14:31.624Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

feature: Implement module 05 Audience per docs/design/observability-command/README.md section "05 Audience" and prototype lines 330-383: device and browser donuts plus the visitors table from /api/admin/traffic, with an in-place visitor timeline from /api/admin/traffic/visitor/:id.

# Acceptance criteria

- [ ] src/pages/admin/command/AudienceModule.tsx exports `AudienceModule({ stage, traffic, days })` and pure `donutSegments(rows, key)` returning the top 4 plus an 'other' bucket with the README palette and the top segment % for the center label.
- [ ] Stage: two 150px donut cards with legends and counts (prototype lines 336-358) and the visitors table VISITOR (short id, orange when email present), IP, CC, DEVICE, EMAIL, HITS, PAGES, LAST SEEN (prototype lines 359-366).
- [ ] Clicking a visitor row fetches GET /admin/traffic/visitor/:id?days via useAdminFetch and shows that visitor's hit/click timeline in place (time, kind, path/label, status) with a back control; stale responses for a previously clicked visitor are ignored.
- [ ] Compact: two 84px donuts with labels (prototype lines 370-381).
- [ ] Loading, error and empty states render inside the module.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/AudienceModule.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md (Tokens; 05 Audience).
- docs/design/observability-command/Observability Command.dc.html lines 330-383 and 717.
- src/pages/admin/TrafficPanel.tsx lines 190-215 and 372-438 (existing visitor timeline fetch + rendering).
- src/pages/admin/command/theme.tsx (Donut) and types.ts (from obs-cmd-theme-types).
Work as the dev-lead persona.

# Out of scope

- Server changes.
- Editing TrafficPanel.tsx.

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
