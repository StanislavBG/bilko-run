---
title: Rewrite post: sigma-now-shows-who-sits-behind-a-contract (plain language, cool side first)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T17:31:40.981Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-rewrites-primitive]
planId: pl-musn5bd6-b4cbc7
---
# Goal

behavior. Rewrite the live post 'sigma-now-shows-who-sits-behind-a-contract' (2026-09-16, project sigma) to the new blog rules. It currently fails scripts/blog-readability.ts: FK grade 9.6, 4 long sentences. Fill in server/blog-rewrites/sigma-now-shows-who-sits-behind-a-contract.ts so the boot migration replaces its title, excerpt and content. The URL and date stay the same.

# Acceptance criteria

- [ ] server/blog-rewrites/sigma-now-shows-who-sits-behind-a-contract.ts exports a non-null `rewrite` with slug 'sigma-now-shows-who-sits-behind-a-contract', migrationId '2026-10-03-rewrite-sigma-now-shows-who-sits-behind-a-contract', a title under 60 chars, a plain one-or-two-sentence excerpt, and markdown content
- [ ] The content passes analyzeReadability with the blog.config.yaml readability thresholds (FK grade <= 8, avg sentence <= 18 words, <= 2 long sentences, zero jargonHits, zero linkIssues). The executor runs `npx tsx scripts/blog-readability.ts` on it and quotes the JSON in the report.
- [ ] The content opens with the coolest thing an early-college reader can do with Sigma, and links its live app https://sigma-plus.replit.app as a full URL (registry host external-url). Any open-source/GitHub mention links a repo confirmed PUBLIC with `gh repo view`. The registry says github.com/midt-bg/sigma, while StanislavBG/sigma is PUBLIC; verify which one is the source.
- [ ] Every fact and number comes from the current live post (https://bilko.run/api/blog/sigma-now-shows-who-sits-behind-a-contract) or is verified in the repo. Nothing is invented. Engineering detail appears only where it makes the cool part believable.
- [ ] tests/blog-rewrites.test.ts is unchanged and passes with this rewrite included

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/sigma-now-shows-who-sits-behind-a-contract.ts

# Implementation notes

Read first: .claude/skills/blog-from-git/voice.md (the Plain language and 'Links readers can click' sections and the bot-tell blocklist), .claude/skills/blog-from-git/blog.config.yaml (identity, readability, angle, links, truth), server/blog-rewrites/index.ts (the BlogRewrite type), and the current live post. A model that passes: the 'turn-your-github-year-into-a-heatmap-and-badge-wall' seed in server/db.ts.

Rules: Bilko is an AI agent, so no invented human persona or location. Keep it about 300-500 words. Explain any government-contract term in plain words the first time.

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
