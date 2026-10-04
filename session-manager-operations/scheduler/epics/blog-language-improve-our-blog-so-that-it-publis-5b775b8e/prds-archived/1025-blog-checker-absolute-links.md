---
title: Blog checker: fail drafts with relative links or an unlinked 'open source'/GitHub mention
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T16:26:34.969Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
disposition: new-head
planId: pl-musltsgp-a1757b
---
# Goal

behavior. Owner rule 2026-10-03: blog readers are early college students, so every link must be a full clickable URL, and any claim that a project is open source or on GitHub must link the actual repo. scripts/blog-readability.ts is already the hard pre-seed gate run by the watchdog. Add link checks to it so a draft like the one that shipped today (`[the project page](/projects/git-viewer/)`, plus "the project is open source" with no link) fails.

# Acceptance criteria

- [ ] scripts/blog-readability.ts: ReadabilityReport gains `linkIssues: {kind: 'relative-link' | 'unlinked-source-claim', text: string}[]`, and `pass` is false when linkIssues is non-empty
- [ ] relative-link: any markdown link whose target does not start with http:// or https:// (e.g. `](/projects/x/)`, `](projects/x)`), or any bare `/projects/...` path, is reported. mailto: links are allowed.
- [ ] unlinked-source-claim: a paragraph that mentions 'open source', 'open-source', 'source code', 'on GitHub' or 'fork it' (case-insensitive) but has no https://github.com/ link in that same paragraph is reported
- [ ] Link checks run on the raw markdown, before the existing prose stripping (which removes link targets), so they see the targets
- [ ] tests/blog-readability.test.ts gains tests: today's failing paragraph (relative link + 'the project is open source') yields both issue kinds and pass=false; the corrected paragraph with https://bilko.run/projects/git-viewer/ and https://github.com/StanislavBG/git-viewer passes; a mailto link passes; existing tests still pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-readability.ts
- tests/blog-readability.test.ts

# Implementation notes

Read first: scripts/blog-readability.ts (whole — analyzeReadability, the stripping step, the CLI JSON output) and tests/blog-readability.test.ts.

Steps: red tests first; add a `findLinkIssues(markdown)` helper called from analyzeReadability on the unstripped input; include linkIssues in the report and in pass. The CLI already exits 1 when pass is false, and the watchdog already requires exit 0 before seeding, so no watchdog change is needed.

Do not touch: server/db.ts, tests/db.test.ts (a sibling PRD owns them), or .claude/skills/blog-from-git/* (the next PRD in this chain).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-readability.test.ts tests/blog-plain-language.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
