---
title: Blog: plain-language readability checker (Flesch-Kincaid grade, sentence length, jargon) for blog drafts
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T06:43:09.803Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
planId: pl-mus0ziaz-37bb07
---
# Goal

primitive. The owner wants every bilko.run blog post written in plain English — the US Federal Plain Language Guidelines (plainlanguage.gov) standard, readable by someone with a GED (about 8th-grade reading level). Today nothing measures that, so the blog-from-git pipeline's phase-5 self-check can't enforce it. Build a deterministic, dependency-light checker (`scripts/blog-readability.ts`) that scores a draft's prose and exits non-zero when it is too hard to read, plus its test.

# Acceptance criteria

- [ ] scripts/blog-readability.ts exports `analyzeReadability(markdown: string, opts?: Partial<ReadabilityThresholds>): ReadabilityReport` where the report includes fkGrade (Flesch-Kincaid grade, 1 decimal), avgSentenceWords, longSentences (array of sentences over opts.longSentenceWords), jargonHits (array of {term, suggestion}), wordCount, and pass: boolean
- [ ] analyzeReadability strips non-prose before scoring: YAML front matter, fenced code blocks, inline code, URLs, markdown link targets (keeps link text), headings markers, and HTML tags — so a code sample or URL never inflates the grade
- [ ] Default thresholds (exported as DEFAULT_THRESHOLDS): maxFkGrade 8, maxAvgSentenceWords 18, longSentenceWords 25, maxLongSentences 2, and a default jargonBlocklist of at least 15 {term, suggestion} pairs of common tech/corporate jargon (e.g. leverage→use, utilize→use, robust→strong, seamless→smooth, orchestrate→run, idempotent→safe to repeat, latency→delay, deprecate→retire)
- [ ] Run as a CLI (`npx tsx scripts/blog-readability.ts <file.md>`), it reads thresholds from the `readability:` block of .claude/skills/blog-from-git/blog.config.yaml when that block exists (snake_case keys: max_fk_grade, max_avg_sentence_words, long_sentence_words, max_long_sentences, jargon_blocklist as list of {term, suggestion}), else falls back to DEFAULT_THRESHOLDS; prints the report as JSON to stdout; exits 0 on pass, 1 on fail, 2 on a missing/unreadable file with a one-line stderr message
- [ ] tests/blog-readability.test.ts proves: a short plain paragraph passes; a dense jargon-heavy paragraph with long sentences fails with fkGrade over 8 and non-empty jargonHits; fenced code and URLs do not change the score; jargon matching is case-insensitive and whole-word ("leveraged" counts, "cleverage" does not); the CLI exits 1 on a failing fixture file and 0 on a passing one (write fixtures to os.tmpdir)
- [ ] The syllable counter is a documented heuristic in the file (vowel-group count with silent-e and -le adjustments, minimum 1 per word); no new npm dependency is added (js-yaml and tsx are already in package.json)

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-readability.ts
- tests/blog-readability.test.ts

# Implementation notes

Read first: package.json (scripts block, devDependencies — tsx ^4.16 and js-yaml ^4.1.1 are present), tests/blog-editorial-focus-not-content.test.ts lines 1-30 (how blog tests load blog.config.yaml with js-yaml), .claude/skills/blog-from-git/blog.config.yaml lines 1-60 (config style), vitest.config.ts (tests/**/*.test.ts is the include glob).

Steps:
1. Write tests/blog-readability.test.ts first (red), importing { analyzeReadability, DEFAULT_THRESHOLDS } from '../scripts/blog-readability'.
2. Create scripts/blog-readability.ts. Flesch-Kincaid grade = 0.39*(words/sentences) + 11.8*(syllables/words) - 15.59. Sentence split on . ! ? followed by whitespace/end (treat list items / lines without terminal punctuation as their own sentence). Words = tokens containing a letter.
3. CLI guard: run main only when the module is the entry point (compare import.meta.url / process.argv[1] the way tsx supports; the repo is ESM — check package.json "type"). For CLI test, invoke via execFileSync('npx', ['tsx', 'scripts/blog-readability.ts', file]) with a timeout, catching the non-zero exit and asserting err.status.
4. Do NOT add the `readability:` block to blog.config.yaml — a later PRD (blog-plain-language-voice) owns that file. The CLI must work with the block absent.

Do not touch: .claude/skills/blog-from-git/* (owned by the next PRD in this chain), scripts/blog-cadence-watchdog.sh.

# Out of scope

- Editing blog.config.yaml, voice.md, SKILL.md
- Rewriting any existing blog post
- Wiring the checker into the watchdog

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-readability.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
