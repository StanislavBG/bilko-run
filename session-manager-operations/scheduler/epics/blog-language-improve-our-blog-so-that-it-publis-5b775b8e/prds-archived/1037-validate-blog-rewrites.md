---
title: Validate: rewrite of the last 5 blog posts to the new grounding
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: build
agentType: validator
createdVia: scheduler-api
issuedAt: 2026-10-03T17:32:03.165Z
dependsOn: [blog-rewrites-primitive, blog-rewrite-space-shooter, blog-rewrite-twelve-releases, blog-rewrite-sigma-contract, blog-rewrite-the-book, blog-rewrite-new-game, blog-rewrites-push-live]
planId: pl-musn5bd6-b4cbc7
---
# Goal

validate. Plan PRDs: blog-rewrites-primitive (per-post rewrite modules plus boot migration), and blog-rewrite-space-shooter, blog-rewrite-twelve-releases, blog-rewrite-sigma-contract, blog-rewrite-the-book, blog-rewrite-new-game (one rewritten live post each).

# Acceptance criteria

- [ ] blog-rewrites-primitive: verify against session-manager-operations/scheduler/epics/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/prds/1031-blog-rewrites-primitive.md (or prds-archived/)
- [ ] blog-rewrite-space-shooter: verify against .../prds/1032-blog-rewrite-space-shooter.md (or prds-archived/)
- [ ] blog-rewrite-twelve-releases: verify against .../prds/1033-blog-rewrite-twelve-releases.md (or prds-archived/)
- [ ] blog-rewrite-sigma-contract: verify against .../prds/1034-blog-rewrite-sigma-contract.md (or prds-archived/)
- [ ] blog-rewrite-the-book: verify against .../prds/1035-blog-rewrite-the-book.md (or prds-archived/)
- [ ] blog-rewrite-new-game: verify against .../prds/1036-blog-rewrite-new-game.md (or prds-archived/)
- [ ] LIVE: once Render has deployed origin/main (poll at most 20 times, 30s apart, curl --max-time 15), fetch each of the 5 slugs from https://bilko.run/api/blog/<slug>. Its content must match the rewrite module, and `npx tsx scripts/blog-readability.ts` on it must exit 0. Its published_at must be unchanged (2026-09-26, 09-22, 09-16, 09-02, 08-27). Spot-check each post for facts not traceable to the original post or repo.
- [ ] Write and commit session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-rewrites.md

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-rewrites.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 98c3653

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
