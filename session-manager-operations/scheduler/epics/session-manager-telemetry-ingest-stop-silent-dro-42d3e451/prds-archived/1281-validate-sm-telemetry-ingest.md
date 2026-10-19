---
title: Validate: Session Manager telemetry is stored without silent drops, split by env, pruned, and readable by the owner
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-12T15:59:58.485Z
sourcePromptId: session-manager-telemetry-ingest-stop-silent-dro-42d3e451
tag: build
agentType: validator
dependsOn: [telemetry-quota-429, admin-session-manager-tab, telemetry-persist-env, telemetry-scheduled-retention, telemetry-env-read-filter, telemetry-usage-read-token]
planId: pl-mv5fnakk-fbfa8e
---
# Goal

validate: verify the plan's six PRDs — telemetry-quota-429 (quota throttling answers 429 + Retry-After), admin-session-manager-tab (admin Session Manager tab), telemetry-persist-env (env persisted on four tables), telemetry-scheduled-retention (daily prune of telemetry events and stale installs), telemetry-env-read-filter (summaries default to prod), telemetry-usage-read-token (headless Bearer read of the usage endpoint).

# Acceptance criteria

- [ ] telemetry-quota-429 VERIFIED against /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/session-manager-telemetry-ingest-stop-silent-dro-42d3e451/prds/1275-telemetry-quota-429.md (or prds-archived/ beside it; find by slug)
- [ ] admin-session-manager-tab VERIFIED against .../prds/1276-admin-session-manager-tab.md (same epic folder, or prds-archived/)
- [ ] telemetry-persist-env VERIFIED against .../prds/1277-telemetry-persist-env.md (same epic folder, or prds-archived/)
- [ ] telemetry-scheduled-retention VERIFIED against .../prds/1278-telemetry-scheduled-retention.md (same epic folder, or prds-archived/)
- [ ] telemetry-env-read-filter VERIFIED against .../prds/1279-telemetry-env-read-filter.md (same epic folder, or prds-archived/)
- [ ] telemetry-usage-read-token VERIFIED against .../prds/1280-telemetry-usage-read-token.md (same epic folder, or prds-archived/)
- [ ] Record written and committed at session-manager-operations/reviews/validation/session-manager-telemetry-ingest-stop-silent-dro-42d3e451/validate-sm-telemetry-ingest.md

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/session-manager-telemetry-ingest-stop-silent-dro-42d3e451/validate-sm-telemetry-ingest.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: cb1889e0395902470a582c7f152d05b59cef35a1
PRD folder: /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/session-manager-telemetry-ingest-stop-silent-dro-42d3e451/
Combined-diff checks worth making: funnel_events retention must not delete rows with both env and version NULL (web analytics / checkout metrics); every SQL change stays parameterized; quota refusal never inserts rows.

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
