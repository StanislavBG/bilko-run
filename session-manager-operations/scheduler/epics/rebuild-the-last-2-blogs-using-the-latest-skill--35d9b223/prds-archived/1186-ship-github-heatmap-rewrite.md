---
title: Ship the rewritten GitViewer post to the live site via a blog rewrite
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T04:33:47.991Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
agentType: dev-lead
dependsOn: [rewrite-github-heatmap-post, ship-twelve-places-rewrite]
planId: pl-mv1waavv-83d93c
---
# Goal

migration: editing content/blog/<slug>.md never updates a post already in the database, so the rewrite of turn-your-github-year-into-a-heatmap-and-badge-wall (landed by PRD rewrite-github-heatmap-post) needs a server/blog-rewrites entry. Add it, register it, push to origin main, and verify the new text and figures are live on https://bilko.run.

# Acceptance criteria

- [ ] New file server/blog-rewrites/turn-your-github-year-into-a-heatmap-and-badge-wall.ts exports `rewrite: BlogRewrite` with slug 'turn-your-github-year-into-a-heatmap-and-badge-wall', migrationId '2026-10-09-rewrite-turn-your-github-year-into-a-heatmap-and-badge-wall-v2', and title, excerpt and content byte-identical to the frontmatter title, excerpt and body of content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md
- [ ] server/blog-rewrites/index.ts imports it and appends it to BLOG_REWRITES, keeping the twelve-places entry added by PRD ship-twelve-places-rewrite
- [ ] tests/blog-rewrites.test.ts passes, including its 'every entry passes readability' test, with no edits to the test file
- [ ] Commit pushed to origin (StanislavBG/bilko-run) main; never to the content-grade remote
- [ ] After deploy (bounded poll: at most 20 tries, 30 s apart), https://bilko.run/api/blog/turn-your-github-year-into-a-heatmap-and-badge-wall returns the new title and each /blog-images/turn-your-github-year-into-a-heatmap-and-badge-wall/<file> returns 200 image/jpeg; else report 'pushed, deploy not yet live' with last status codes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/turn-your-github-year-into-a-heatmap-and-badge-wall.ts
- server/blog-rewrites/index.ts

# Implementation notes

Read first: server/blog-rewrites/twelve-places-one-weather-rule-you-set-yourself.ts (landed by the previous PRD; copy its shape exactly), server/blog-rewrites/index.ts (whole), tests/blog-rewrites.test.ts lines 60-90, content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md.
Steps:
1. Create server/blog-rewrites/turn-your-github-year-into-a-heatmap-and-badge-wall.ts. Guarantee identity with the md body: a throwaway node script in a mktemp dir that reads the md, splits frontmatter, and prints JSON.stringify of title/excerpt/body; use JSON string literals if template-literal escaping gets messy.
2. Import it in server/blog-rewrites/index.ts as `gitViewerRewrite` and add to the array.
3. Run `pnpm vitest run tests/blog-rewrites.test.ts tests/blog-posts-loader.test.ts` and `pnpm typecheck`.
4. Commit exactly those two paths (message `feat(blog): ship rewrite of turn-your-github-year-into-a-heatmap-and-badge-wall`). Then `git pull --rebase origin main && git push origin main`. On rebase conflict HALT and report.
5. Bounded live check: `for i in $(seq 1 20); do ...; sleep 30; done` with `curl -sf --max-time 15`.
Do not touch: other server/blog-rewrites entries, content/blog/.

# Out of scope

- Changing the post text
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
