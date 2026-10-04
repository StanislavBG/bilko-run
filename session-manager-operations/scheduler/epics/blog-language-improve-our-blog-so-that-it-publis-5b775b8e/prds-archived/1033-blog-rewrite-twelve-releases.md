---
title: Rewrite post: twelve-releases-in-four-days-for-the-scheduler-view (plain language, cool side first)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T17:31:02.835Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-rewrites-primitive]
planId: pl-musn5bd6-b4cbc7
---
# Goal

behavior. Rewrite the live post 'twelve-releases-in-four-days-for-the-scheduler-view' (2026-09-22, project session-manager) to the new blog rules. It currently fails scripts/blog-readability.ts: FK grade 13.2, 31.5 words per sentence, 10 long sentences. Fill in server/blog-rewrites/twelve-releases-in-four-days-for-the-scheduler-view.ts so the boot migration replaces its title, excerpt and content. The URL and date stay the same.

# Acceptance criteria

- [ ] server/blog-rewrites/twelve-releases-in-four-days-for-the-scheduler-view.ts exports a non-null `rewrite` with slug 'twelve-releases-in-four-days-for-the-scheduler-view', migrationId '2026-10-03-rewrite-twelve-releases-in-four-days-for-the-scheduler-view', a title under 60 chars, a plain one-or-two-sentence excerpt, and markdown content
- [ ] The content passes analyzeReadability with the blog.config.yaml readability thresholds (FK grade <= 8, avg sentence <= 18 words, <= 2 long sentences, zero jargonHits, zero linkIssues). The executor runs `npx tsx scripts/blog-readability.ts` on it and quotes the JSON in the report.
- [ ] The content opens with the coolest thing an early-college reader can do with Session Manager, and links https://bilko.run/projects/session-manager/ as a full URL. If it mentions open source or GitHub, it links the real repo, but only after `gh repo view` confirms it is PUBLIC. The registry says github.com/StanislavBG/session-manager, while GitHub has StanislavBG/claude-code-session-manager as PUBLIC; verify which one is real.
- [ ] Every fact and number comes from the current live post (https://bilko.run/api/blog/twelve-releases-in-four-days-for-the-scheduler-view) or is verified in the repo. Nothing is invented. Engineering detail appears only where it makes the cool part believable.
- [ ] tests/blog-rewrites.test.ts is unchanged and passes with this rewrite included

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/twelve-releases-in-four-days-for-the-scheduler-view.ts

# Implementation notes

Read first: .claude/skills/blog-from-git/voice.md (the Plain language and 'Links readers can click' sections and the bot-tell blocklist), .claude/skills/blog-from-git/blog.config.yaml (identity, readability, angle, links, truth), server/blog-rewrites/index.ts (the BlogRewrite type), and the current live post. A model that passes: the 'turn-your-github-year-into-a-heatmap-and-badge-wall' seed in server/db.ts.

Rules: Bilko is an AI agent, so no invented human persona or location. Keep it about 300-500 words. Translate scheduler/PRD jargon into what a student would see and do.

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
