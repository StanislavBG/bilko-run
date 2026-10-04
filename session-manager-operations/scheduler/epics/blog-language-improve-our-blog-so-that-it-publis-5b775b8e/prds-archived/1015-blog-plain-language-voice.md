---
title: Blog: plain-language, cool-side-first voice in blog.config.yaml, voice.md and the SKILL.md self-check
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-03T06:43:46.675Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-readability-checker]
planId: pl-mus0ziaz-37bb07
---
# Goal

behavior. Owner direction, 2026-10-02, verbatim: "it used GED language or langeu that the govement uses - simple english; Focus on cool side of the project and the features you are blogging about." Encode that as editorial policy: blog.config.yaml (the declared authority) gains a `readability:` block (US Federal Plain Language Guidelines, ~8th-grade / GED reading level, enforced by scripts/blog-readability.ts from the previous PRD) and an `angle:` block that makes every post lead with the coolest thing a reader can do or see; voice.md and the SKILL.md phase-5 self-check are rewritten to match.

# Acceptance criteria

- [ ] blog.config.yaml has a top-level `readability:` block with standard: 'US Federal Plain Language Guidelines (plainlanguage.gov)', reading_level: 'GED / about 8th grade', max_fk_grade: 8, max_avg_sentence_words: 18, long_sentence_words: 25, max_long_sentences: 2, a jargon_blocklist of {term, suggestion} pairs (at least the defaults in scripts/blog-readability.ts DEFAULT_THRESHOLDS), and checker: 'npx tsx scripts/blog-readability.ts <draft.md>'
- [ ] blog.config.yaml has a top-level `angle:` block stating posts lead with the coolest thing a reader can do, see, or play with in the project (the fun/impressive part), told as what it feels like to use it; bugs, refactors and internal plumbing are left out unless one sentence of it makes the cool part more believable; `truth.show_the_mistake` is changed to false with a comment pointing at angle:
- [ ] blog.config.yaml `gates.5_draft` names the readability checker passing as part of the gate; identity.stance mentions plain, simple English; all existing truth rules (every_number_needs_a_source, no_invented_metrics, cadence.backdating honest-only), the five tone names and the field-note shape text stay as they are so tests/blog-editorial-focus-not-content.test.ts still passes
- [ ] voice.md gains a 'Plain language (GED level)' section near the top with the Federal Plain Language rules in short form (use 'you'; active voice; short sentences; common words; one idea per paragraph; explain any needed technical term in plain words the first time) and two before/after rewrite examples taken from real phrases in voice.md's tone micro-examples; voice.md 'Show the mistake' guidance is replaced by the cool-side-first angle, and the tone micro-examples themselves are rewritten to pass the checker
- [ ] SKILL.md's 'Final self-check' gains two YES/NO items: (1) `npx tsx scripts/blog-readability.ts <draft>` exits 0, and (2) the opening paragraph names the coolest thing a reader can do with the project; the field-note-only 'a real mistake/surprise' item is softened to optional
- [ ] New tests/blog-plain-language.test.ts asserts the readability and angle blocks exist with the values above, that the thresholds in config load into analyzeReadability (import from ../scripts/blog-readability) and that each voice.md tone micro-example passes analyzeReadability with the config thresholds

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/blog.config.yaml
- .claude/skills/blog-from-git/voice.md
- .claude/skills/blog-from-git/SKILL.md
- tests/blog-plain-language.test.ts

# Implementation notes

Read first: .claude/skills/blog-from-git/blog.config.yaml (whole file, ~165 lines; header says it is THE AUTHORITY — prose follows config), .claude/skills/blog-from-git/voice.md (whole, 127 lines), .claude/skills/blog-from-git/SKILL.md lines 33-98, scripts/blog-readability.ts (landed by PRD blog-readability-checker — read its DEFAULT_THRESHOLDS and CLI config-key names; the config keys you write MUST match what that CLI reads), tests/blog-editorial-focus-not-content.test.ts (must keep passing unchanged).

Steps:
1. Write tests/blog-plain-language.test.ts first (red), loading the config with js-yaml as the existing blog test does.
2. Edit blog.config.yaml: add readability: and angle: blocks after tones:/before categories:; flip truth.show_the_mistake to false with comment; extend gates.5_draft; adjust identity.stance.
3. Edit voice.md: add the Plain language section right after the H1; replace show-the-mistake guidance; rewrite the 5 tone micro-examples in plain language with the cool part first (keep them grounded — reuse the same products and facts, just simpler words, shorter sentences). Keep the bot-tell blocklist. The rule 'Bilko is an AI agent, not a human' stays.
4. Edit SKILL.md Final self-check list.
5. Run `npx tsx scripts/blog-readability.ts` against a temp file containing each micro-example to confirm they pass before finishing.

Do not touch: scripts/blog-readability.ts (if a real bug blocks you, report it rather than editing), scripts/blog-cadence-watchdog.sh, seed.md, rotation.md, research.md (later PRDs in this chain own them), server/db.ts (no existing post is rewritten).

# Out of scope

- Rewriting already-published posts
- Cadence or watchdog changes
- Changing rotation rules

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-plain-language.test.ts tests/blog-editorial-focus-not-content.test.ts tests/blog-readability.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
