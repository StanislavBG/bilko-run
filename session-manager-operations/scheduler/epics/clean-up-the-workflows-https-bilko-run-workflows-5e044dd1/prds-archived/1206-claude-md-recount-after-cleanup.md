---
title: Recount tests in CLAUDE.md after the workflows/dead-code cleanup
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-10T16:37:22.227Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
agentType: dev-lead
dependsOn: [remove-workflows-page, host-kit-drop-workflows-section, remove-workflows-data-pipeline, trim-dead-portfolio-css, remove-dead-demo-endpoints, remove-orphan-script-and-exports]
planId: pl-mv2m49us-ae38eb
---
# Goal

doc: The cleanup PRDs deleted tests/workflows.test.ts and added tests/retired-demo-endpoints.test.ts, so the test count in CLAUDE.md's Testing section is now wrong. Recount and update that line. Also make sure no live doc still describes /workflows or the deleted scripts.

# Acceptance criteria

- [ ] CLAUDE.md's Testing line (`72 files, 872 tests ...`) states the file and test counts printed by a fresh `pnpm vitest run` on the current main.
- [ ] `git grep -n -i -E 'bilko.run/workflows|WorkflowsPage|refresh-workflows|render-deploy' -- CLAUDE.md README.md docs/host-contract.md docs/host-internals.md docs/deployment.md` returns nothing. Any hit found there before the edit is removed or reworded. docs/archive/ is left alone.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- CLAUDE.md
- README.md
- docs/host-internals.md
- docs/deployment.md
- docs/host-contract.md

# Implementation notes

Read first: CLAUDE.md, the `## Testing` section; `git log --oneline -10` to confirm the six cleanup PRDs have landed.
Steps:
1. Run `pnpm vitest run` and read the `Test Files` and `Tests` totals.
2. Update the count in CLAUDE.md.
3. Run the grep from the criteria and fix any hit in those live docs.
Do not touch: code files, docs/archive/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
