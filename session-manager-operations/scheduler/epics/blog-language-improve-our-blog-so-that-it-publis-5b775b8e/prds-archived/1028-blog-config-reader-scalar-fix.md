---
title: Blog config: identity.reader folded scalar swallowed comment lines
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-03T17:03:32.298Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: bug
agentType: dev-lead
disposition: new-head
planId: pl-musn5bd6-b4cbc7
---
# Goal

behavior. Validator finding (Critical), recorded in session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-absolute-links.md. In .claude/skills/blog-from-git/blog.config.yaml, `identity.reader` is a `>-` folded scalar (~line 14). The `#` rationale lines indented beneath it (~lines 17-19) parse as part of the value, not as comments, so the reader persona every post is written for contains stray '# owner direction 2026-10-03...' text. Make the parsed value clean, and audit every other block scalar in the file for the same problem.

# Acceptance criteria

- [ ] Parsed with js-yaml, config.identity.reader equals exactly one clean sentence describing an early-college student new to these tools who should be able to click straight through to try each project; it contains no '#' and no newline
- [ ] The owner-direction rationale is kept as real YAML comments placed outside the scalar (above the `reader:` key)
- [ ] Every block scalar (`>`, `>-`, `|`, `|-`) in blog.config.yaml is checked; no parsed string value in the whole config contains a line starting with optional whitespace then '# '
- [ ] tests/blog-plain-language.test.ts gains: identity.reader does not contain '#' or a newline; and a walker over the whole parsed config asserts no string value contains /\n\s*# / (the guard that would have caught this)

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/blog.config.yaml
- tests/blog-plain-language.test.ts

# Implementation notes

Read first: .claude/skills/blog-from-git/blog.config.yaml lines 1-40 and every other `>-`/`|` block in the file; tests/blog-plain-language.test.ts.

Steps: write the red tests (walker plus reader); fix the YAML; run the gate last.

Do not touch: scripts/, voice.md, server/db.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-plain-language.test.ts tests/blog-editorial-focus-not-content.test.ts tests/blog-spotlight-mode.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
