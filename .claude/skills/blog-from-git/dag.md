# Sub-skill: the six-step content DAG (phases 3, 4 and 5)

Borrowed from Burrow's research pipeline (`~/Projects/burrow/app/dashboard/routes/research.py`,
`_run_pipeline`): split an objective into questions, gather sourced snippets for each, group them
into themes, write each section only from its own snippets, add an intro and close, make a visual.
The old single "Draft" step had none of that structure. This file adds it. Phase numbers 1-7 do not
change (`scripts/blog-cadence-watchdog.sh` prompts reference them), so the steps are sub-steps.

| Step | Name | Phase | Consumes | Produces |
|---|---|---|---|---|
| 3a | Decompose | 3 Research | the story unit | `questions.json` |
| 3b | Gather | 3-4 Research + Ground | `questions.json`, diffs, README, live app, `ground.md` sources, community signal | `evidence.json` |
| 5a | Outline | 5 Draft | `evidence.json`, the tone | `outline.json` |
| 5b | Write | 5 Draft | one section's evidence at a time | the post body, `content/blog/<slug>.md` draft |
| 5c | Compose | 5 Draft | `outline.json`, the written sections | hook, close, `renditions/linkedin.md`, `renditions/x.md` |
| 5d | Illustrate | 5 Draft (after) | `outline.json` figure fields | figures per `images.md` |

## Artifacts live in `drafts/<slug>/`

Every step leaves a file in `drafts/<slug>/` (gitignored). The folder is kept after seed so anyone can
inspect how a post was built. Only `content/blog/<slug>.md` (and the ledger) is committed. Never
stage `drafts/`.

```
drafts/<slug>/
  questions.json   evidence.json   outline.json
  renditions/linkedin.md   renditions/x.md
```

## 3a Decompose

From the story unit, write 3-7 questions a reader would ask. Default kinds: `value` (what can I do
now that I couldn't before), `who` (who it helps), `start` (how to try it, with the correct link),
`proof` (the number that backs it), `how-it-works` (one level down), `next`. `value`, `who` and
`start` are required (`pipeline.required_question_kinds`).

```json
{ "story_unit": "short name of the project/theme",
  "questions": [ { "id": "q1", "question": "What can I do with it now?", "kind": "value" } ] }
```

`kind` is one of: value, who, how-it-works, proof, next, start, other. Ids are unique.

## 3b Gather

For every sourced fact, add one evidence item. Sources: diffs, README, the live app, scorecard /
MCP / DB reads (`ground.md`), and community signal from burrow-brain. Community items must clear
`pipeline.community`: at least 25 upvotes or quality 0.7. Below the floors, drop the item; never keep it.

```json
{ "items": [ { "id": "e1", "question_ids": ["q1"], "source_kind": "diff",
               "source": "commit abc1234 / https://bilko.run/projects/x/", "claim": "one plain sentence",
               "upvotes": 40, "quality": 0.8 } ] }
```

`source_kind` is one of: diff, readme, live-app, scorecard, mcp, db, doc, community. `upvotes` and
`quality` are for community items only. `source` and `claim` are never empty. Each item cites at least
one real question id.

## 5a Outline

Pick the tone, then group the evidence into sections. Each section needs at least
`pipeline.min_evidence_per_section` (2) evidence ids. The tone's `max_sections` caps the count
(changelog 2, shipped-note 3, problem-outcome 3, field-note 5, metric-update 3). A section that can't
reach 2 evidence ids is dropped, so a thin story becomes a short post on purpose. Every required
question must be covered by evidence cited in some section.

```json
{ "tone": "shipped-note", "title": "...", "hook": "the cool part, first",
  "sections": [ { "id": "s1", "heading": "Plain H2 text", "point": "what this section tells the reader",
                  "evidence_ids": ["e1", "e2"], "figure": "which page/screen would show this (optional)" } ],
  "next": "where the project goes from here" }
```

## 5b Write

One section at a time, under its `heading` as an H2, using only that section's evidence. A claim
with no evidence id does not go in. Headings must appear in the post as H2s in outline order.

## 5c Compose

Write the hook (cool part first), then the was → now → next spine and the one link
(`links.max_ctas_per_post: 1`). Then write two renditions from the same outline:

- `renditions/linkedin.md`: 120-250 words, stands alone, exactly one `https://` link.
- `renditions/x.md`: at most 280 characters.

Nothing posts these. They are ready-to-paste outputs.

## 5d Illustrate

Follow `images.md`. Figures come from the `figure` field of `outline.json` sections, so each figure
illustrates a specific section.

## Budget

`target = hook_words + n * section_words + close_words` (defaults 50 + n × 140 + 60), where `n` is
the number of sections in `outline.json`. The post must land within ± `tolerance` (20%) of the
target, clamped to `blog_min_words` (200) and `blog_max_words` (1000). Example: 3 sections →
target 530, allowed 424-636 words. All numbers live in `blog.config.yaml` under `pipeline:`.

## Gate

```
npx tsx scripts/blog-pipeline-check.ts drafts/<slug> <post.md>
```

It must exit 0. It checks question count and kinds (R1), evidence and community floors (R2), outline
size and coverage (R3), H2 headings match the outline (R4), post length against the budget (R5), and
both renditions (R6). Exit 1 prints the failing rules as JSON; fix the artifacts or the post and rerun.
It does not replace `blog-readability.ts`; run both.
