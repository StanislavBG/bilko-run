---
title: Validate: blog pipeline borrows Burrow's 6-step research DAG with dynamic per-channel budgets
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T05:51:28.249Z
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: build
agentType: validator
dependsOn: [blog-dag-config-and-skill, blog-dag-research-ground-voice, blog-watchdog-pipeline-gate]
planId: pl-mv1z38j8-0e0445
---
# Goal

validate: verify this plan's four PRDs:
- `1190-blog-pipeline-check-script`: blog pipeline checker that validates the DAG artifacts and dynamic word budgets
- `1191-blog-dag-config-and-skill`: pipeline config block, dag.md sub-skill and the DAG sub-steps in SKILL.md
- `1192-blog-dag-research-ground-voice`: research, ground and voice docs for the DAG, high-quality burrow-brain signal and dynamic budgets
- `1193-blog-watchdog-pipeline-gate`: watchdog requires the DAG check before seeding and audits it after publish

# Acceptance criteria

- [ ] blog-pipeline-check-script: every AC line in `/home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/compare-the-research-pipeline-from-burrow-projec-cacabcec/prds-archived/` (find `1190-blog-pipeline-check-script.md` by slug, possibly in a timestamped subfolder) is verified against the tree, and its gate re-runs green.
- [ ] blog-dag-config-and-skill: every AC line in `.../prds/1191-blog-dag-config-and-skill.md` (or prds-archived/) is verified. Check also that loading the real blog.config.yaml with `loadPipelineConfigFromConfig()` yields values equal to `DEFAULT_PIPELINE_CONFIG`.
- [ ] blog-dag-research-ground-voice: every AC line in `.../prds/1192-blog-dag-research-ground-voice.md` (or prds-archived/) is verified. Check also that dag.md, research.md, ground.md, voice.md and blog.config.yaml agree on the question kinds, the community quality floors and the channel budgets.
- [ ] blog-watchdog-pipeline-gate: every AC line in `.../prds/1193-blog-watchdog-pipeline-gate.md` (or prds-archived/) is verified, and its gate re-runs green.
- [ ] Write and commit `session-manager-operations/reviews/validation/compare-the-research-pipeline-from-burrow-projec-cacabcec/validate-blog-research-dag.md` containing one VERIFIED/REFUTED verdict per PRD and any combined-diff findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/compare-the-research-pipeline-from-burrow-projec-cacabcec/validate-blog-research-dag.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 8fe9c8c3dd26ece247f2ad405e3256b73e819391

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
