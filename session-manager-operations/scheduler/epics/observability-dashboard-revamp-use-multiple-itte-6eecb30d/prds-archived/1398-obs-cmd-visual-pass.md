---
title: Observability Command: dev preview with design sample data + screenshot fidelity pass
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-19T05:25:47.259Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-retire-legacy]
planId: pl-mvepeuhy-686687
---
# Goal

behavior: Make the console verifiable without an admin login by adding a DEV-only preview that renders it with the prototype's sample data, then iterate: screenshot each module on stage and fix visual deviations from docs/design/observability-command/ until they match. This is the design-fidelity iteration loop for the Epic.

# Acceptance criteria

- [ ] src/pages/admin/command/PreviewPage.tsx renders the same console (CommandShell + KpiStrip + Ticker + 7 modules) fed by fixtures converted from the prototype's D block (docs/design/observability-command/Observability Command.dc.html lines 488-514) into the real API response shapes from types.ts; modules that self-fetch (sessions list/detail, visitor timeline, egress drilldown) accept an optional injected fetcher so the preview needs no network.
- [ ] src/App.tsx registers /admin/observability/preview only when import.meta.env.DEV is true (production bundle has no such route), outside <Layout />.
- [ ] Screenshots at 1440x900 of the preview with each of the 7 modules on stage (keys 1-7), plus DOCK and WING layouts and FOCUS mode, are saved under the job's own TMPDIR and reviewed against the README specs; every deviation found (colors, font sizes, spacing, header hints, overflow, clipped text) is fixed in the module files and listed in the run report.
- [ ] No horizontal overflow or clipped tables at 1280x760 with the 30D-sized fixture (30 byDay entries).
- [ ] `pnpm typecheck` and `pnpm test` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/
- src/App.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md and the prototype (whole file).
- src/pages/admin/ObservabilityPage.tsx (as wired by obs-cmd-page-wire) and src/pages/admin/command/*.
- src/App.tsx outside-Layout routes (~line 228).
Steps:
1. Build fixtures + PreviewPage.tsx; add the DEV-only route.
2. Start the dev server with a bounded timeout (see package.json 'dev' script; client-only vite is enough), drive it with Playwright (the repo already has @playwright/test; a throwaway script under TMPDIR is fine, do not add an e2e spec), take the screenshots, review them, fix, re-shoot. Cap at 3 iterations.
3. Stop the dev server; run the gate last.
Do not click any [data-buy] element. Work as the dev-lead persona.

# Out of scope

- Server changes.
- Adding a committed Playwright spec or screenshot files to the repo.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 600 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
