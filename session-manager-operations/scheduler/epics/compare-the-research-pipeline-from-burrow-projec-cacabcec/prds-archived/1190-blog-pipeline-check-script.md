---
title: Blog pipeline checker: validate the Burrow-style DAG artifacts and dynamic word budgets
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T05:47:46.292Z
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: feature
agentType: dev-lead
planId: pl-mv1z38j8-0e0445
---
# Goal

primitive: add a deterministic checker, `scripts/blog-pipeline-check.ts`, plus its test. It proves a bilko.run blog post went through the new six-step content DAG: decompose → gather → outline → write → compose → illustrate. This is modelled on Burrow's research pipeline. Every step leaves a JSON artifact in the gitignored `.claude/skills/blog-from-git/drafts/<slug>/` folder. The checker validates those artifacts and enforces word budgets that depend on the channel and on how much evidence the post has: a post earns length through its evidenced sections instead of a fixed per-tone word range.

# Acceptance criteria

- [ ] `scripts/blog-pipeline-check.ts` exports `DEFAULT_PIPELINE_CONFIG`, `computeBlogBudget(sectionCount, cfg)`, `checkPipeline(artifacts, postMarkdown, cfg)` and `loadPipelineConfigFromConfig()`, with the exact shapes, defaults and key names given in the Implementation notes.
- [ ] `computeBlogBudget(3, DEFAULT_PIPELINE_CONFIG)` returns `{ target: 530, min: 424, max: 636 }`. For any count, `min` is never below `blogMin` (200) and `max` is never above `blogMax` (1000).
- [ ] `checkPipeline` returns `pass: false` with a specific error string for each rule violation in the notes (rules R1–R6). It returns `pass: true` with an empty `errors` array on a fully valid fixture. Its `summary` field lists the question count, the evidence count, the kept community-item count, each section's heading and evidence count, the budget, the post word count, the LinkedIn word count and the X character count.
- [ ] The CLI `npx tsx scripts/blog-pipeline-check.ts <artifact-dir> <post.md>` prints the report as JSON. It exits 0 when the report passes, 1 when it fails, and 2 on bad usage or a missing or unparsable artifact file, with a one-line stderr message.
- [ ] `tests/blog-pipeline-check.test.ts` covers these cases:
  - the valid fixture passes
  - a missing required question kind fails
  - a community evidence item below both quality floors fails
  - a section with only 1 evidence id fails
  - a post over its budget fails
  - an X rendition over 280 characters fails
  - a tone with more sections than `toneMaxSections` allows fails
  - the `computeBlogBudget` numbers above
  - the CLI exits 0 on a valid temp dir and 1 on an invalid one, via `execFileSync`, following the pattern in `tests/blog-readability.test.ts`
- [ ] The config loader reads the `pipeline:` block and `tones.<name>.max_sections` from `.claude/skills/blog-from-git/blog.config.yaml` when present. It falls back to `DEFAULT_PIPELINE_CONFIG` quietly when the block is absent, and with a stderr warning when the YAML fails to parse, mirroring `loadThresholdsFromConfig` in `scripts/blog-readability.ts`.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-pipeline-check.ts
- tests/blog-pipeline-check.test.ts

# Implementation notes

Work in /home/bilko/Projects/Bilko. This PRD only creates the checker. Sibling PRDs will add the `pipeline:` block to blog.config.yaml, write the skill docs, and wire the checker into the watchdog. So the defaults below must live in code, and the YAML key names below are the contract those PRDs will copy exactly.

Read first:
- `scripts/blog-readability.ts` lines 1-60 (imports, js-yaml, DEFAULT_THRESHOLDS style), 267-320 (`analyzeReadability`, which returns `wordCount`), 345-424 (config loader + CLI main + the `process.argv[1] === fileURLToPath(import.meta.url)` guard).
- `tests/blog-readability.test.ts` lines 1-60 (how the CLI is exercised with execFileSync + temp files).

Artifact contract. Files live in `<artifact-dir>`:
- `questions.json`: `{ "story_unit": string, "questions": [ { "id": string, "question": string, "kind": "value"|"who"|"how-it-works"|"proof"|"next"|"start"|"other" } ] }`
- `evidence.json`: `{ "items": [ { "id": string, "question_ids": string[], "source_kind": "diff"|"readme"|"live-app"|"scorecard"|"mcp"|"db"|"doc"|"community", "source": string, "claim": string, "upvotes"?: number, "quality"?: number } ] }`. Here `source` is a sha, path, URL or query.
- `outline.json`: `{ "tone": string, "title": string, "hook": string, "sections": [ { "id": string, "heading": string, "point": string, "evidence_ids": string[], "figure"?: string } ], "next": string }`
- `renditions/linkedin.md` and `renditions/x.md`: plain text or markdown.
The CLI reads these into `artifacts = { questions, evidence, outline, linkedin, x }` and calls `checkPipeline`.

Types and defaults (export both):
```ts
export interface PipelineConfig {
  minQuestions: number; maxQuestions: number; requiredQuestionKinds: string[];
  minEvidencePerSection: number;
  community: { minUpvotes: number; minQuality: number };
  budget: { hookWords: number; sectionWords: number; closeWords: number; tolerance: number; blogMin: number; blogMax: number };
  channels: { linkedin: { minWords: number; maxWords: number }; x: { maxChars: number } };
  toneMaxSections: Record<string, number>;
}
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  minQuestions: 3, maxQuestions: 7, requiredQuestionKinds: ['value', 'who', 'start'],
  minEvidencePerSection: 2,
  community: { minUpvotes: 25, minQuality: 0.7 },
  budget: { hookWords: 50, sectionWords: 140, closeWords: 60, tolerance: 0.2, blogMin: 200, blogMax: 1000 },
  channels: { linkedin: { minWords: 120, maxWords: 250 }, x: { maxChars: 280 } },
  toneMaxSections: { changelog: 2, 'shipped-note': 3, 'problem-outcome': 3, 'field-note': 5, 'metric-update': 3 },
};
```

`computeBlogBudget(n, cfg)` computes three numbers:
- `target = hookWords + n * sectionWords + closeWords`
- `min = max(blogMin, round(target * (1 - tolerance)))`
- `max = min(blogMax, round(target * (1 + tolerance)))`

YAML mapping for `loadPipelineConfigFromConfig()`. It reads `.claude/skills/blog-from-git/blog.config.yaml` relative to the script dir, the same way as `loadThresholdsFromConfig`. Each key falls back to its default individually:
- `pipeline.min_questions`
- `pipeline.max_questions`
- `pipeline.required_question_kinds`
- `pipeline.min_evidence_per_section`
- `pipeline.community.min_upvotes`
- `pipeline.community.min_quality`
- `pipeline.budget.hook_words`
- `pipeline.budget.section_words`
- `pipeline.budget.close_words`
- `pipeline.budget.tolerance`
- `pipeline.budget.blog_min_words`
- `pipeline.budget.blog_max_words`
- `pipeline.channels.linkedin.min_words`
- `pipeline.channels.linkedin.max_words`
- `pipeline.channels.x.max_chars`
- `toneMaxSections`: built from every `tones.<name>.max_sections` number, merged over the defaults.

Rules `checkPipeline` enforces. Each violation pushes one human-readable error naming the offending id:
- R1 questions:
  - the count is within [minQuestions, maxQuestions]
  - ids are unique
  - every `requiredQuestionKinds` entry appears as some question's `kind`
- R2 evidence:
  - ids are unique
  - `question_ids` is non-empty and every id exists in questions
  - `source` and `claim` are non-empty
  - `source_kind` is in the enum
  - a `community` item must satisfy `(quality ?? 0) >= minQuality || (upvotes ?? 0) >= minUpvotes`; otherwise it is an error, because below-floor community signal must be dropped at gather time and never kept
- R3 outline:
  - `tone` is a key of `toneMaxSections`
  - the sections count is within [1, toneMaxSections[tone]]
  - each section has at least `minEvidencePerSection` evidence_ids, all existing
  - every question whose kind is in `requiredQuestionKinds` is referenced by at least one evidence item that some section cites
- R4 post structure: strip a leading YAML frontmatter block (`---` … `---`) from the post. Every outline section `heading` must appear as an H2 line (`## <heading>`, compared trimmed), in outline order. Extra H2s are allowed.
- R5 post length: `wordCount = analyzeReadability(postBody).wordCount` (import from `./blog-readability`). It must be within `computeBlogBudget(sections.length, cfg)` [min, max].
- R6 renditions:
  - LinkedIn: words, counted the same way, within [linkedin.minWords, linkedin.maxWords], and it contains at least one `https://` URL
  - X: `x.trim().length <= x.maxChars`
  - a missing rendition is an error

Steps:
1. Write the failing tests in `tests/blog-pipeline-check.test.ts` with an inline valid fixture: 4 questions covering value/who/start/proof, 5 evidence items including one community item with `upvotes: 40`, outline tone `shipped-note` with 2 sections of 2 evidence each, and a post of about 340 words with both H2s. Budget for 2 sections: target 390, range 312-468. Run them red early, capturing the output with `2>&1 | tail -5`.
2. Implement `scripts/blog-pipeline-check.ts`: exports + `main()` + the argv guard, exactly like blog-readability.ts.
3. Run the gate last.

# Out of scope

- Editing blog.config.yaml, any .claude/skills/blog-from-git/*.md file, or scripts/blog-cadence-watchdog.sh: sibling PRDs own those
- Any network or MCP call from the checker
- Checking claim-to-evidence semantics with a model

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-pipeline-check.test.ts tests/blog-readability.test.ts
timeout 300 pnpm exec tsc -p tsconfig.scripts.json
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
