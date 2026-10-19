---
title: Observability Command: 04 Traffic module (hits per day, pages, referrers, projects)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T05:13:32.372Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

feature: Implement module 04 Traffic per docs/design/observability-command/README.md section "04 Traffic" and prototype lines 261-328: hits-per-day columns with a unique-visitor marker and three ranked tables, all from /api/admin/traffic.

# Acceptance criteria

- [ ] src/pages/admin/command/TrafficModule.tsx exports `TrafficModule({ stage, traffic })` rendering, on stage, the HITS PER DAY header with legend and 'PEAK MM-DD · n', one column per byDay entry scaled to the peak with the amber visitors marker and hits/uv labels (prototype lines 266-281).
- [ ] Stage tables TOP PAGES (hits, uv), REFERRERS (hits), PROJECTS (hits, uv) with 2px underline bars proportional to each table's max, colors orange/amber/green as in prototype lines 282-310; probe paths matching /wp-admin|\.php|\.env|xmlrpc/ tinted #ff8a7a.
- [ ] With more than 14 days the columns narrow and only every Nth date label is shown so 30 days stays readable without overflow.
- [ ] Compact: total hits, top referrer host, mini columns (prototype lines 314-326); exports `trafficSubtitle()` default 'pages · referrers'.
- [ ] Loading, error and empty ('no traffic in window') states render inside the module.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/TrafficModule.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md (Tokens; 04 Traffic).
- docs/design/observability-command/Observability Command.dc.html lines 261-328 and 653, 712-714.
- src/pages/admin/command/theme.tsx and types.ts (from obs-cmd-theme-types).
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
