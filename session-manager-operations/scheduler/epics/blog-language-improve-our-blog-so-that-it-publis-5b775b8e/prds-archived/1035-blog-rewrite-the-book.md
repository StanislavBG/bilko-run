---
title: Rewrite post: the-book-didnt-know-what-it-already-held (plain language, cool side first)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T17:31:46.037Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-rewrites-primitive]
planId: pl-musn5bd6-b4cbc7
---
# Goal

behavior. Rewrite the live post 'the-book-didnt-know-what-it-already-held' (2026-09-02, project social-signals-trader, a field-note) to the new blog rules. It currently fails scripts/blog-readability.ts: FK grade 13.5, 30.1 words per sentence, 10 long sentences. Under the new angle: rule, the bug story is no longer the subject. Lead with what a reader can see on the live trading dashboard. Fill in server/blog-rewrites/the-book-didnt-know-what-it-already-held.ts. The URL and date stay the same.

# Acceptance criteria

- [ ] server/blog-rewrites/the-book-didnt-know-what-it-already-held.ts exports a non-null `rewrite` with slug 'the-book-didnt-know-what-it-already-held', migrationId '2026-10-03-rewrite-the-book-didnt-know-what-it-already-held', a title under 60 chars, a plain one-or-two-sentence excerpt, and markdown content
- [ ] The content passes analyzeReadability with the blog.config.yaml readability thresholds (FK grade <= 8, avg sentence <= 18 words, <= 2 long sentences, zero jargonHits, zero linkIssues). The executor runs `npx tsx scripts/blog-readability.ts` on it and quotes the JSON in the report.
- [ ] The content opens with the coolest thing an early-college reader can see: the public 'trade in public' dashboard. It links https://bilko.run/projects/social-signals-trader/ as a full URL. The repo StanislavBG/social-signals-trader is PRIVATE, so there is no repo link and no 'open source' claim.
- [ ] Every fact and number comes from the current live post (https://bilko.run/api/blog/the-book-didnt-know-what-it-already-held) or is verified in ~/Projects/social-signals-trader. Nothing is invented. Numbers keep their 2026-09-02 period (blog.config.yaml truth.period_correctness), and no later outcomes are added. No investment advice or promises of returns.
- [ ] tests/blog-rewrites.test.ts is unchanged and passes with this rewrite included

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/the-book-didnt-know-what-it-already-held.ts

# Implementation notes

Read first: .claude/skills/blog-from-git/voice.md (the Plain language and 'Links readers can click' sections and the bot-tell blocklist), .claude/skills/blog-from-git/blog.config.yaml (identity, readability, angle, links, truth incl. period_correctness and no_epilogue_knowledge), server/blog-rewrites/index.ts (the BlogRewrite type), and the current live post. A model that passes: the 'turn-your-github-year-into-a-heatmap-and-badge-wall' seed in server/db.ts.

Rules: Bilko is an AI agent, so no invented human persona or location. Keep it about 300-500 words. Explain any trading term in plain words the first time.

Steps: draft in a temp .md file, run the checker, and revise (at most 4 rounds; if it still fails, HALT with exit 1). Then write the module and run the gate last. Commit only this module, then `git pull --rebase origin main && git push origin main` (retry at most 3 times; never content-grade).

Do not touch: server/db.ts, server/blog-rewrites/index.ts, other rewrite modules, tests/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-rewrites.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
