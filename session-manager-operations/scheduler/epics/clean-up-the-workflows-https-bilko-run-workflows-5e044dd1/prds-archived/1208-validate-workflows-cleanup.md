---
title: Validate: Remove /workflows from bilko.run and trim dead code, live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T16:38:00.216Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
tag: build
agentType: validator
dependsOn: [remove-workflows-page, host-kit-drop-workflows-section, remove-workflows-data-pipeline, trim-dead-portfolio-css, remove-dead-demo-endpoints, remove-orphan-script-and-exports, claude-md-recount-after-cleanup, publish-workflows-cleanup]
planId: pl-mv2m49us-ae38eb
---
# Goal

validate: Validate the plan that removes bilko.run/workflows and trims dead host code: 1200 remove-workflows-page, 1201 host-kit-drop-workflows-section, 1202 remove-workflows-data-pipeline, 1203 trim-dead-portfolio-css, 1204 remove-dead-demo-endpoints, 1205 remove-orphan-script-and-exports, 1206 claude-md-recount-after-cleanup, 1207 publish-workflows-cleanup.

# Acceptance criteria

- [ ] 1200 remove-workflows-page: every criterion in $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/clean-up-the-workflows-https-bilko-run-workflows-5e044dd1/prds/1200-remove-workflows-page.md (or prds-archived/, found by slug) holds against the real tree.
- [ ] 1201 host-kit-drop-workflows-section: every criterion in its PRD file (same folder, by slug) holds.
- [ ] 1202 remove-workflows-data-pipeline: every criterion in its PRD file holds.
- [ ] 1203 trim-dead-portfolio-css: every criterion in its PRD file holds; no still-used pf- class lost its rule.
- [ ] 1204 remove-dead-demo-endpoints: every criterion in its PRD file holds; the headline-grader scoring route still works in tests.
- [ ] 1205 remove-orphan-script-and-exports: every criterion in its PRD file holds.
- [ ] 1206 claude-md-recount-after-cleanup: every criterion in its PRD file holds.
- [ ] 1207 publish-workflows-cleanup: every criterion in its PRD file holds, re-checked live against https://bilko.run.
- [ ] Write and commit session-manager-operations/reviews/validation/clean-up-the-workflows-https-bilko-run-workflows-5e044dd1/validate-workflows-cleanup.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/clean-up-the-workflows-https-bilko-run-workflows-5e044dd1/validate-workflows-cleanup.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 3f50c16643dba1483180c6488fdf098de10aed03

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
