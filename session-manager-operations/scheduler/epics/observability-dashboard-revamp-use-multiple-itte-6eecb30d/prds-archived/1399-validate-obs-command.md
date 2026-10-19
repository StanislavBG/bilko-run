---
title: Validate: /admin/observability rebuilt as the Observability Command console
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T05:26:19.906Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: build
agentType: validator
dependsOn: [obs-cmd-theme-types, obs-cmd-shell, obs-cmd-data-kpis, obs-cmd-globe, obs-cmd-sessions, obs-cmd-apps, obs-cmd-traffic, obs-cmd-audience, obs-cmd-clicks, obs-cmd-bandwidth, obs-cmd-kpis-ticker, obs-cmd-page-wire, obs-cmd-retire-legacy, obs-cmd-visual-pass, observability-global-alerts-once]
planId: pl-mvepeuhy-686687
---
# Goal

validate: Verify the Observability Command plan. PRDs: 1383 observability-global-alerts-once, 1385 obs-cmd-theme-types, 1386 obs-cmd-shell, 1387 obs-cmd-data-kpis, 1388 obs-cmd-globe, 1389 obs-cmd-sessions, 1390 obs-cmd-apps, 1391 obs-cmd-traffic, 1392 obs-cmd-audience, 1393 obs-cmd-clicks, 1394 obs-cmd-bandwidth, 1395 obs-cmd-kpis-ticker, 1396 obs-cmd-page-wire, 1397 obs-cmd-retire-legacy, 1398 obs-cmd-visual-pass. Design source: docs/design/observability-command/.

# Acceptance criteria

- [ ] Each PRD file lives under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/observability-dashboard-revamp-use-multiple-itte-6eecb30d/prds/ while queued, or prds-archived/ (possibly a timestamped subfolder) once done; find each by slug.
- [ ] observability-global-alerts-once VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-theme-types VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-shell VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-data-kpis VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-globe VERIFIED or REFUTED against its PRD (incl. no simulated pings, no CDN fetch).
- [ ] obs-cmd-sessions VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-apps VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-traffic VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-audience VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-clicks VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-bandwidth VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-kpis-ticker VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-page-wire VERIFIED or REFUTED against its PRD (admin guard intact, route outside Layout, only existing endpoints used, no hard-coded sample numbers outside PreviewPage fixtures).
- [ ] obs-cmd-retire-legacy VERIFIED or REFUTED against its PRD.
- [ ] obs-cmd-visual-pass VERIFIED or REFUTED against its PRD (preview route absent from a production build).
- [ ] Write and commit session-manager-operations/reviews/validation/observability-dashboard-revamp-use-multiple-itte-6eecb30d/validate-obs-command.md with one verdict per PRD and findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/observability-dashboard-revamp-use-multiple-itte-6eecb30d/validate-obs-command.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 22d848b4f959ce9abc9994a6830d53cb1e913efa

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
