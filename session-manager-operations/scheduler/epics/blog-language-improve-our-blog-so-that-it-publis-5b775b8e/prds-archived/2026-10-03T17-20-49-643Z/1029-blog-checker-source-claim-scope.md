---
title: Blog checker: open-source claim is satisfied by a repo link anywhere in the post
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-03T17:04:07.446Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: bug
agentType: dev-lead
disposition: new-head
planId: pl-musn62hi-23d479
---
# Goal

behavior. Validator finding (Important) on scripts/blog-readability.ts:146-150. findLinkIssues requires the https://github.com/ link to sit in the same paragraph as an 'open source' or GitHub claim. A normal post that says "it's open source" in one paragraph and links the repo in the next fails the pre-publish gate, and that would block an automated publish. Change the rule to: the claim is fine if the post contains a github.com repo link anywhere; it is only reported when the post has no such link at all.

# Acceptance criteria

- [ ] scripts/blog-readability.ts findLinkIssues reports `unlinked-source-claim` only when the whole markdown has a source claim and no https://github.com/ link anywhere; it reports at most one such issue per post, quoting the first claiming paragraph
- [ ] The relative-link checks are unchanged
- [ ] tests/blog-readability.test.ts gains: a claim in paragraph 1 with the repo link in paragraph 3 passes; a claim with no repo link anywhere fails; the existing link tests still pass (update any test that encoded the old same-paragraph rule, and say which in the report)

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-readability.ts
- tests/blog-readability.test.ts

# Implementation notes

Read first: scripts/blog-readability.ts lines 120-170 (findLinkIssues, SOURCE_CLAIM_RE, GITHUB_LINK_RE) and tests/blog-readability.test.ts.

Steps: red tests first, then the change, then the gate last.

Do not touch: blog.config.yaml, tests/blog-plain-language.test.ts (a sibling PRD owns them), server/db.ts.

# Out of scope

- (none)

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
