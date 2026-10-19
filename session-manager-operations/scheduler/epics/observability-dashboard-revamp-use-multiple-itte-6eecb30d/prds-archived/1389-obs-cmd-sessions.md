---
title: Observability Command: 02 Sessions module (journey player)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-19T05:11:32.740Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

feature: Implement module 02 Sessions per docs/design/observability-command/README.md section "02 Sessions" and prototype lines 145-224 and 629-681: a filterable session list and a step-by-step journey player over the real /api/admin/sessions list and /api/admin/sessions/:id timeline, reusing buildSessionSteps.

# Acceptance criteria

- [ ] src/pages/admin/command/SessionsModule.tsx exports `SessionsModule({ stage, days })`; it fetches GET /admin/sessions?days (plus email|visitor|app from the filter: value with '@' -> email, UUID -> visitor, otherwise app slug; debounced 300ms) and GET /admin/sessions/:id for the selected row, via useAdminFetch.
- [ ] Stage left column: filter input, 'shown / total' count, rows laid out as prototype lines 157-166 (HH:MM, user or short visitor id, YOU chip when the session email equals the signed-in Clerk user's primary email, m:ss duration, MM/DD, 'landing → exit · app', 'P C E' counts), selected-row styling; first row auto-selected.
- [ ] Stage right column: facts grid (USER, STARTED, DURATION, LANDING, EXIT, APP), step rail with progress line, current-step card, PREV / PLAY-PAUSE / NEXT, 1x/2x/4x speed, step list, and an OPEN IN SESSION VIEW link to /admin/sessions/:id; steps come from buildSessionSteps(timeline, session.started_at) in src/lib/sessionSteps.ts.
- [ ] Playback advances one step per 1000ms/speed and stops at the last step; Space toggles play only while stage is true and focus is not in an input; kind chips: view amber, click orange, event green, error red.
- [ ] Compact view: session count, 'last HH:MM', top 7 rows (time, flow, duration); loading, error and empty ('no sessions in window') states render inside the module.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/SessionsModule.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md (Tokens; 02 Sessions).
- docs/design/observability-command/Observability Command.dc.html lines 145-224 and 629-681.
- src/lib/sessionSteps.ts lines 1-40 (TimelineItem, Step, buildSessionSteps signature) and src/pages/admin/SessionPlayer.tsx (existing playback for reference only; do not import its UI).
- src/pages/admin/SessionsPanel.tsx lines 80-130 (existing fetch + debounce pattern) and src/hooks/useAdmin.ts.
Steps: create SessionsModule.tsx using C/FONT/Seg from theme.tsx and types from types.ts (both from obs-cmd-theme-types). Use useUser() from @clerk/clerk-react for the YOU chip.
Work as the dev-lead persona.

# Out of scope

- Server changes to the sessions endpoints.
- Changing sessionSteps.ts or SessionPlayer.tsx.

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
