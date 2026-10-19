---
title: Teach blog-readability to accept captioned figure blocks
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-10T04:29:17.083Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
agentType: dev-lead
planId: pl-mv1waavv-83d93c
---
# Goal

behavior: scripts/blog-readability.ts currently fails any post containing a figure block `![alt](/blog-images/<slug>/<file>.jpg "caption")` with a `relative-link` linkIssue, even though the post page renders exactly that syntax via `parseFigure` in src/lib/blogMarkdown.ts. Make readability recognise a paragraph block that `parseFigure` accepts as a figure: exclude it from link checks (including --check-live) and from sentence/grade stats, so posts can carry real screenshots.

# Acceptance criteria

- [ ] scripts/blog-readability.ts imports `parseFigure` from src/lib/blogMarkdown.ts (no duplicated regex) and drops every blank-line-separated block for which `parseFigure(block)` returns non-null before computing linkIssues, sentence stats, jargon and marketing hits
- [ ] A block that looks like a figure but fails `parseFigure` (e.g. src `/images/x.jpg`, `https://evil.test/x.png`, or containing `..`) is NOT skipped and still reports a link issue
- [ ] --check-live never fetches a figure src
- [ ] tests/blog-readability.test.ts gains tests: (1) a passing post plus one valid figure block still passes with no linkIssues; (2) a post with an unsafe figure src still reports a linkIssue; (3) wordCount does not count figure alt/caption words
- [ ] Existing tests in tests/blog-readability.test.ts and tests/blog-rewrites.test.ts still pass unchanged

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-readability.ts
- tests/blog-readability.test.ts
- tsconfig.scripts.json

# Implementation notes

Read first: scripts/blog-readability.ts (whole file, ~415 lines; link extraction near line 211, CLI at 375), src/lib/blogMarkdown.ts lines 1-25 (`parseFigure(block: string): Figure | null`), tests/blog-readability.test.ts (existing shape).
Steps:
1. Write the three failing tests in tests/blog-readability.test.ts first (red), using the exported analysis function the existing tests already call.
2. In scripts/blog-readability.ts, add a small `stripFigures(body: string): string` that splits on /\n\s*\n/, filters out blocks where `parseFigure(b.trim())` is non-null, and rejoins with '\n\n'. Apply it at the single entry point where the body text is analysed, so both stats and link checks (incl. --check-live) see the stripped body.
3. Import path: scripts already compile under tsconfig.scripts.json; use the same relative import style as other scripts importing from src/ (check with grep for "../src/" in scripts/). If src/lib/blogMarkdown.ts is not includable from tsconfig.scripts.json, add it to that tsconfig's include list rather than copying the regex.
Repro of the bug: append `![A chart](/blog-images/x-y/a.jpg "Caption here.")` to any passing post in content/blog/ and run `npx tsx scripts/blog-readability.ts <file>` → `relative-link` issue, pass:false.

# Out of scope

- Changing parseFigure or the post renderer
- Editing any blog post content

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-readability.test.ts tests/blog-rewrites.test.ts tests/blog-markdown.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
