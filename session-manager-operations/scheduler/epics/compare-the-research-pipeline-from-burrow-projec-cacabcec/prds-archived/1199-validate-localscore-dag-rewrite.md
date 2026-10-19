---
title: Validate: the LocalScore post is rebuilt through the new blog DAG, with figures and a video, live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: build
agentType: validator
createdVia: scheduler-api
issuedAt: 2026-10-10T16:32:25.699Z
dependsOn: [rewrite-localscore-post-dag, ship-localscore-rewrite, video-localscore-post, blog-video-skill-dag-aware]
planId: pl-mv2m10pj-73f010
---
# Goal

validate: verify the four PRDs of this plan:
- `1196-rewrite-localscore-post-dag`: rewrite the LocalScore post through the six-step DAG, with figures
- `1197-ship-localscore-rewrite`: ship the rewrite to the live database
- `1209-blog-video-skill-dag-aware`: make the Blog Video skill the macro's system of record and feed it the DAG outputs
- `1198-video-localscore-post`: build the 30-second blog video

# Acceptance criteria

- [ ] rewrite-localscore-post-dag: every acceptance criterion in `/home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/compare-the-research-pipeline-from-burrow-projec-cacabcec/prds/1196-rewrite-localscore-post-dag.md` (or under `prds-archived/`, found by slug) is checked against the tree, and its gate re-runs green. This includes the pipeline-check against the absolute main-checkout drafts folder.
- [ ] ship-localscore-rewrite: every acceptance criterion in `.../1197-ship-localscore-rewrite.md` is checked. The rewrite entry must be byte-identical to the md file, and https://bilko.run/api/blog/localscore-browser-ai-that-never-sees-your-data must return the new title (`curl --max-time 15`).
- [ ] blog-video-skill-dag-aware: every acceptance criterion in `.../1209-blog-video-skill-dag-aware.md` (or prds-archived/) is checked against `.claude/skills/blog-video/SKILL.md`, and its gate re-runs green.
- [ ] video-localscore-post: every acceptance criterion in `.../1198-video-localscore-post.md` is checked, its gate re-runs green, and https://bilko.run/blog-videos/localscore-browser-ai-that-never-sees-your-data/index.html returns 200.
- [ ] Write and commit `session-manager-operations/reviews/validation/compare-the-research-pipeline-from-burrow-projec-cacabcec/validate-localscore-dag-rewrite.md`, with one VERIFIED or REFUTED verdict per PRD and any combined-diff findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/compare-the-research-pipeline-from-burrow-projec-cacabcec/validate-localscore-dag-rewrite.md

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