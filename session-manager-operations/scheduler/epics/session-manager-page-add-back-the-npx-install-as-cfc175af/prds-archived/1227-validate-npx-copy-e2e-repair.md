---
title: Validate: the price-tag keyboard Copy test is green and the repairs are pushed and live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T21:59:54.640Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
tag: build
agentType: validator
dependsOn: [repair-npx-copy-e2e, push-npx-and-vitest-repairs]
planId: pl-mv2xsq1x-5e7a1a
---
# Goal

validate. Fix wave for the REFUTED npx-price-tag-e2e: repair-npx-copy-e2e (keyboard Copy e2e test root-caused and green, non-vacuous label assertion) and push-npx-and-vitest-repairs (pushed to origin main, CI recorded, live check).

# Acceptance criteria

- [ ] repair-npx-copy-e2e VERIFIED against $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/session-manager-page-add-back-the-npx-install-as-cfc175af/prds/1225-repair-npx-copy-e2e.md (or its prds-archived/ copy, found by slug).
- [ ] push-npx-and-vitest-repairs VERIFIED against .../prds/1226-push-npx-and-vitest-repairs.md (or archived copy).
- [ ] Write and commit session-manager-operations/reviews/validation/session-manager-page-add-back-the-npx-install-as-cfc175af/validate-npx-copy-e2e-repair.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/session-manager-page-add-back-the-npx-install-as-cfc175af/validate-npx-copy-e2e-repair.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 04564be4e910d5233a18203f49a50b6543826ba3
Prior record: session-manager-operations/reviews/validation/session-manager-page-add-back-the-npx-install-as-cfc175af/validate-npx-price-tag.md (REFUTED npx-price-tag-e2e; Important findings at spec :191 and :192). Confirm both findings are closed. The job worktree may lack node_modules; run gates in the main checkout if needed, as the prior validator did.

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
