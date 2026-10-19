---
title: Validate: vitest suite is reliably green again (no SQLITE_BUSY), so CI on main can pass
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
tag: build
agentType: validator
createdVia: scheduler-api
issuedAt: 2026-10-10T21:04:38.535Z
dependsOn: [repair-vitest-sqlite-busy]
planId: pl-mv2utb6r-b533e1
---
# Goal

validate. Validates the plan: repair-vitest-sqlite-busy (root-cause fix for intermittent SQLITE_BUSY at initDb in the vitest suite).

# Acceptance criteria

- [ ] repair-vitest-sqlite-busy VERIFIED against $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/session-manager-page-add-back-the-npx-install-as-cfc175af/prds/1216-repair-vitest-sqlite-busy.md (or its prds-archived/ copy, found by slug).
- [ ] Write and commit session-manager-operations/reviews/validation/session-manager-page-add-back-the-npx-install-as-cfc175af/validate-vitest-sqlite-busy.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/session-manager-page-add-back-the-npx-install-as-cfc175af/validate-vitest-sqlite-busy.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 10b0deabd6bc95d763024e3fc07f5bf2bbf27cd8
Note: the fix must address a real cause (no skipped/retried/deleted tests); the full `pnpm vitest run` must pass repeatedly.

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
