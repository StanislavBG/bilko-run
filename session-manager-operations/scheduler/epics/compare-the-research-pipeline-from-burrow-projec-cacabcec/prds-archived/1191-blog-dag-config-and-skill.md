---
title: Blog skill: add the pipeline config block, dag.md sub-skill, and DAG sub-steps in SKILL.md
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T05:48:18.349Z
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: feature
agentType: dev-lead
dependsOn: [blog-pipeline-check-script]
planId: pl-mv1z38j8-0e0445
---
# Goal

doc: give the blog-from-git skill Burrow's six-step content DAG as its drafting method. The steps are decompose → gather → outline → write → compose → illustrate, and they replace the single monolithic "Draft" step. Post length becomes dynamic: it is computed from the number of evidenced sections and capped per channel, instead of fixed per-tone word ranges. Every step leaves an inspectable artifact in the gitignored `drafts/<slug>/` folder, and `scripts/blog-pipeline-check.ts` (already landed) is the gate that proves the DAG ran. Phase numbers 1–7 stay stable because `scripts/blog-cadence-watchdog.sh` prompts reference them, so the DAG is expressed as sub-steps 3a/3b, 5a/5b/5c and 5d.

# Acceptance criteria

- [ ] `.claude/skills/blog-from-git/blog.config.yaml` gains a top-level `pipeline:` block. Its keys and values exactly match what `loadPipelineConfigFromConfig()` in `scripts/blog-pipeline-check.ts` reads, set to the code defaults (including `community.min_upvotes: 25`, `community.min_quality: 0.7`, `budget.blog_max_words: 1000`, `channels.linkedin`, `channels.x`), with comments explaining each.
- [ ] In `blog.config.yaml`, every entry under `tones:` drops its `words:` range and gains `max_sections:` (changelog 2, shipped-note 3, problem-outcome 3, field-note 5, metric-update 3). Its `shape` and `payload` are kept. `gates.3_research`, `gates.4_ground` and `gates.5_draft` name the dag.md artifacts, and `5_draft` requires `npx tsx scripts/blog-pipeline-check.ts <drafts/slug dir> <post.md>` to exit 0.
- [ ] New file `.claude/skills/blog-from-git/dag.md` documents the six steps (3a Decompose, 3b Gather, 5a Outline, 5b Write, 5c Compose + channel renditions, 5d Illustrate), what each one consumes and produces, and the exact JSON artifact schemas. It also gives the budget formula and states that artifacts stay in `drafts/<slug>/` (gitignored, kept after seed for inspection) while only `content/blog/<slug>.md` is committed.
- [ ] In `.claude/skills/blog-from-git/SKILL.md`, the pipeline table shows the sub-steps under phases 3, 4 and 5 with their gates and points to dag.md. The final self-check replaces the tone-length line with a pipeline-check exit-0 line, and the folder map lists dag.md. Every item that `tests/blog-plain-language.test.ts` asserts on SKILL.md is preserved.
- [ ] `.claude/skills/blog-from-git/images.md` is renamed in prose from phase 5b to 5d, and it says figures are chosen from the `figure` field of `outline.json` sections, so each figure illustrates a specific section.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/blog.config.yaml
- .claude/skills/blog-from-git/SKILL.md
- .claude/skills/blog-from-git/images.md
- .claude/skills/blog-from-git/dag.md

# Implementation notes

Work in /home/bilko/Projects/Bilko. A prior PRD landed `scripts/blog-pipeline-check.ts`. Read it FIRST and copy its YAML key names and defaults exactly; the code is the contract.

Read first:
- `scripts/blog-pipeline-check.ts` (whole file: `PipelineConfig`, `DEFAULT_PIPELINE_CONFIG`, `loadPipelineConfigFromConfig`, rules R1-R6).
- `.claude/skills/blog-from-git/blog.config.yaml` lines 155-176 (tones) and 262-277 (gates).
- `.claude/skills/blog-from-git/SKILL.md` (whole file, 132 lines).
- `tests/blog-plain-language.test.ts` lines 240-300 (the SKILL.md assertions that must keep passing).

Why this design, for the comments: Burrow's research pipeline (`~/Projects/burrow/app/dashboard/routes/research.py`, `_run_pipeline`) builds a document in steps:
1. Decompose an objective into sub-questions.
2. Gather sourced snippets for each one.
3. Cluster the snippets into themes.
4. Write each section only from its own snippets.
5. Compose an intro and conclusion.
6. Make an infographic.
The blog skill had only one prose-producing step. The DAG adds that structure while keeping every existing gate (rotation, scan, grounding, readability, seed).

dag.md content outline:
- Step 3a Decompose: from the story unit, write `questions.json` with 3-7 reader questions. The default kinds are value (what can I do now that I couldn't before), who (who it helps), start (how to try it, with the correct link), proof (the number that backs it), how-it-works (one level down) and next.
- Step 3b Gather: one evidence item for each sourced fact, in `evidence.json`. The sources are the diffs, README, live app, scorecard/MCP/DB (ground.md), and high-quality-only community signal from burrow-brain. Below-floor items are dropped, never kept.
- Step 5a Outline: group the evidence into sections in `outline.json`. Each section has at least 2 evidence ids, and the tone sets the maximum section count. A section that can't reach 2 evidence ids is dropped, so a thin story automatically becomes a short post.
- Step 5b Write: one section at a time, using only that section's evidence, under the H2 `heading`.
- Step 5c Compose: hook (cool part first) + was → now → next + the one link. Write `renditions/linkedin.md` (120-250 words, stands alone, one https link) and `renditions/x.md` (at most 280 chars) from the same outline. Nothing posts these; they are ready-to-paste outputs.
- Step 5d Illustrate: images.md.
- Gate: the pipeline-check command.
- Budget formula: `target = hook + n*section + close`, with ±tolerance, clamped to the blog min/max.
Write the prose in plain English.

Steps:
1. Edit blog.config.yaml (pipeline block + tones + gates).
2. Create dag.md.
3. Edit SKILL.md.
4. Edit images.md.
5. Run the gate last.

Do not touch: `research.md`, `ground.md`, `voice.md` (a sibling PRD owns them), `seed.md` and `scripts/blog-cadence-watchdog.sh` (another sibling PRD owns them). Do not rename phases 1-7 or change `autonomy:`/`cadence:` keys: the watchdog parses them.

# Out of scope

- Changing the watchdog or its prompt text
- Posting to LinkedIn or X
- Editing research.md, ground.md, voice.md, seed.md

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-pipeline-check.test.ts tests/blog-plain-language.test.ts tests/blog-readability.test.ts tests/blog-cadence-watchdog.test.ts tests/blog-rewrites.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
