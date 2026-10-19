---
title: Ship the rewritten OutdoorHours post to the live site via a blog rewrite
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T04:33:23.140Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
agentType: dev-lead
dependsOn: [rewrite-twelve-places-post]
planId: pl-mv1waavv-83d93c
---
# Goal

migration: editing content/blog/<slug>.md never updates a post already in the database, so the rewrite of twelve-places-one-weather-rule-you-set-yourself (landed by PRD rewrite-twelve-places-post) needs a server/blog-rewrites entry. Add it, register it, push to origin main, and verify the new text and figures are live on https://bilko.run.

# Acceptance criteria

- [ ] New file server/blog-rewrites/twelve-places-one-weather-rule-you-set-yourself.ts exports `rewrite: BlogRewrite` with slug 'twelve-places-one-weather-rule-you-set-yourself', a unique migrationId '2026-10-09-rewrite-twelve-places-one-weather-rule-you-set-yourself-v2', and title, excerpt and content byte-identical to the frontmatter title, excerpt and body of content/blog/twelve-places-one-weather-rule-you-set-yourself.md
- [ ] server/blog-rewrites/index.ts imports it and appends it to BLOG_REWRITES
- [ ] tests/blog-rewrites.test.ts passes, including its 'every entry passes readability' test, with no edits to the test file
- [ ] Commit pushed to origin (StanislavBG/bilko-run) main; never to the content-grade remote
- [ ] After deploy (bounded poll: at most 20 tries, 30 s apart), https://bilko.run/api/blog/twelve-places-one-weather-rule-you-set-yourself returns the new title and https://bilko.run/blog-images/twelve-places-one-weather-rule-you-set-yourself/<each file> returns 200 image/jpeg; if 20 tries run out, report 'pushed, deploy not yet live' with the last status codes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/twelve-places-one-weather-rule-you-set-yourself.ts
- server/blog-rewrites/index.ts

# Implementation notes

Read first: server/blog-rewrites/twelve-releases-in-four-days-for-the-scheduler-view.ts (shape to copy: `import type { BlogRewrite } from './types.js'; export const rewrite: BlogRewrite = { slug, migrationId, title, excerpt, content: `...` }`), server/blog-rewrites/index.ts (whole, ~20 lines), tests/blog-rewrites.test.ts lines 60-90, content/blog/twelve-places-one-weather-rule-you-set-yourself.md.
Steps:
1. Create server/blog-rewrites/twelve-places-one-weather-rule-you-set-yourself.ts. Build the content as a template literal; escape backticks and `${` in the body. Figure lines stay as-is (the renderer and readability both accept `![alt](/blog-images/... "caption")`). Easiest way to guarantee identity: write a throwaway node script in a mktemp dir that reads the md, splits frontmatter, and prints JSON.stringify of the body; paste it as a JSON string literal instead of a template literal if escaping gets messy.
2. Import it in server/blog-rewrites/index.ts as `twelvePlacesRewrite` and add to the array.
3. Run `pnpm vitest run tests/blog-rewrites.test.ts tests/blog-posts-loader.test.ts` and `pnpm typecheck`.
4. Commit exactly: server/blog-rewrites/twelve-places-one-weather-rule-you-set-yourself.ts server/blog-rewrites/index.ts (message `feat(blog): ship rewrite of twelve-places-one-weather-rule-you-set-yourself`). Then `git pull --rebase origin main && git push origin main`. On rebase conflict HALT and report.
5. Bounded live check: `for i in $(seq 1 20); do ...; sleep 30; done` with `curl -sf --max-time 15`. Check the API title and every image URL.
Do not touch: server/blog-rewrites files for other slugs, content/blog/ (already landed).

# Out of scope

- Changing the post text (fix it in content/blog only if tests/blog-rewrites.test.ts readability fails, and say so)
- Video

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-rewrites.test.ts tests/blog-posts-loader.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
