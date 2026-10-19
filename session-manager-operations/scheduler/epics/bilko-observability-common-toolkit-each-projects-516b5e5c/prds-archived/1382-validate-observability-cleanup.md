---
title: Validate: observability cleanup — minor issues fixed, code clearer and smaller
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T02:43:30.914Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
tag: build
agentType: validator
dependsOn: [cleanup-server-session-identity, cleanup-admin-sessions-api, cleanup-host-kit-telemetry, cleanup-host-telemetry-module, cleanup-session-player-format, cleanup-session-view-list, cleanup-click-tagging]
planId: pl-mvendohr-b6719f
---
# Goal

validate: verify the cleanup plan that came out of the independent clarity and minimalism review. PRDs: cleanup-server-session-identity; cleanup-admin-sessions-api; cleanup-host-kit-telemetry; cleanup-host-telemetry-module; cleanup-session-player-format; cleanup-session-view-list; cleanup-click-tagging.

# Acceptance criteria

- [ ] cleanup-server-session-identity: the PRD file under $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/bilko-observability-common-toolkit-each-projects-516b5e5c/prds/ (or prds-archived/), found by slug, is VERIFIED.
- [ ] cleanup-admin-sessions-api: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. SQL stays fully parameterized and requireAdmin stays on every route.
- [ ] cleanup-host-kit-telemetry: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] cleanup-host-telemetry-module: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED, with track/trackFlow payloads unchanged.
- [ ] cleanup-session-player-format: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] cleanup-session-view-list: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. There is no duplicate session list or inline timeline left.
- [ ] cleanup-click-tagging: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] Combined: the diff since Base is net-negative or near-neutral in lines for src/pages/admin/ (git diff --stat), the full pnpm vitest run and pnpm typecheck are green (a stale gitignored dist/ failure is environmental), and no duplicate TimelineItem or fmtTime/shortId/fmtMmSs definitions remain in src/ or server/.
- [ ] Write and commit session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-observability-cleanup.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-observability-cleanup.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: f11543f64c5ca98f934b9783e8af53f49c2ed112

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
