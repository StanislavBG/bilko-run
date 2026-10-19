---
title: Blog skill: rewrite research, ground and voice docs for the DAG, high-quality burrow-brain signal and dynamic budgets
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T05:48:40.103Z
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: feature
agentType: dev-lead
dependsOn: [blog-pipeline-check-script]
planId: pl-mv1z38j8-0e0445
---
# Goal

doc: rewrite three blog-from-git sub-skill docs so they produce the artifacts that `scripts/blog-pipeline-check.ts` validates.
- `research.md` becomes steps 3a Decompose (`questions.json`) and 3b Gather (`evidence.json`).
- `ground.md` adds high-quality-only community grounding from Burrow's `burrow-brain` MCP, used only to strengthen a value or who claim.
- `voice.md` swaps the fixed per-tone word ranges for dynamic, per-channel budgets.

# Acceptance criteria

- [ ] `.claude/skills/blog-from-git/research.md` documents step 3a: write `drafts/<slug>/questions.json`, mapping its existing 6-item template onto question kinds (value, who, start, proof, how-it-works, next). It documents step 3b: each research agent returns evidence items in the exact `evidence.json` item shape from `scripts/blog-pipeline-check.ts`. Its existing 'Traps' section and push-status requirement are kept.
- [ ] `.claude/skills/blog-from-git/ground.md` gains a 'Community signal (burrow-brain), high-quality only' section. It says to use `search_distilled` with `filters.min_upvotes` set to `pipeline.community.min_upvotes` and `search_adhoc` with `min_quality` set to `pipeline.community.min_quality`, and to record `upvotes` or `quality` on the evidence item.
- [ ] That ground.md section also states three rules: below-floor results are discarded, never cited; community evidence is used only to back a value or who claim; and if the MCP is not connected, the post skips community evidence and does not substitute anything for it.
- [ ] `.claude/skills/blog-from-git/voice.md` replaces its 'Length: shorter by default' section with a dynamic-budget section. It covers the blog budget computed from the outline's section count (formula and defaults from `DEFAULT_PIPELINE_CONFIG`, blog max 1000 words), the LinkedIn rendition at 120-250 words and the X rendition at no more than 280 chars. The tone table's Length column becomes 'Max sections' (2, 3, 3, 5, 3).
- [ ] Every assertion in `tests/blog-plain-language.test.ts` about voice.md still passes, and every voice.md tone micro-example still passes the readability checker that test runs.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/research.md
- .claude/skills/blog-from-git/ground.md
- .claude/skills/blog-from-git/voice.md

# Implementation notes

Work in /home/bilko/Projects/Bilko. A prior PRD landed `scripts/blog-pipeline-check.ts`. Read it first for the exact artifact shapes, the config key names (`pipeline.community.min_upvotes`, `pipeline.community.min_quality`, `pipeline.channels.linkedin.min_words/max_words`, `pipeline.channels.x.max_chars`) and the defaults: min_upvotes 25, min_quality 0.7, hook 50 + 140 per section + close 60 with ±20%, blog 200-1000.

A sibling PRD running in parallel creates `.claude/skills/blog-from-git/dag.md`, which defines all six DAG steps, and adds the `pipeline:` block to blog.config.yaml. Refer to `dag.md` by path. Do not create or edit it.

Read first:
- `scripts/blog-pipeline-check.ts` (whole file).
- `.claude/skills/blog-from-git/research.md` (61 lines).
- `.claude/skills/blog-from-git/ground.md` (54 lines).
- `.claude/skills/blog-from-git/voice.md` lines 1-40 and 110-140 (plain-language rules, tone table, Length section).
- `tests/blog-plain-language.test.ts` lines 1-60 and 150-250 (what is asserted on voice.md).

burrow-brain facts:
- The MCP config lives at `~/Projects/burrow/data/mcp/burrow-brain.mcp.json` (HTTP, `http://127.0.0.1:8767/mcp`).
- `search_distilled` takes a `filters` dict that supports `min_upvotes`, `platform` and `author` (`~/Projects/burrow/app/mcp/endpoints/read.py` around line 1336).
- `search_adhoc` supports `min_quality` 0-1 (`~/Projects/burrow/app/mcp/endpoints/research.py` around line 314).
- Use the MCP to find real reader pain or real praise that backs who the project helps. Never use it to supply the post's subject.

Steps:
1. Edit research.md.
2. Edit ground.md.
3. Edit voice.md, keeping the plain-language and link sections intact.
4. Run the gate last.

Do not touch: blog.config.yaml, SKILL.md, images.md, dag.md (sibling PRD), seed.md, scripts/blog-cadence-watchdog.sh (another sibling PRD).

# Out of scope

- Changing burrow code or its MCP
- Editing blog.config.yaml, SKILL.md, images.md, dag.md, seed.md
- Adding tests that grep docs

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-plain-language.test.ts tests/blog-readability.test.ts tests/blog-pipeline-check.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
