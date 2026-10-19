---
title: Ship the rewritten Escape Velocity post to the live site via its blog rewrite entry
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T01:31:58.200Z
sourcePromptId: rebuild-this-blog-https-bilko-run-blog-a-space-s-01e2b70c
agentType: dev-lead
dependsOn: [rewrite-space-shooter-post]
planId: pl-mv35ds46-72e8e1
---
# Goal

migration: editing content/blog/<slug>.md never updates a post already in the database, so the rewrite of a-space-shooter-shrank-66-percent-to-fit-in-your-browser (landed by PRD rewrite-space-shooter-post) must replace the existing server/blog-rewrites entry with a new migrationId so it re-applies. Update it, push to origin main, and verify the new text and figures are live on https://bilko.run.

# Acceptance criteria

- [ ] server/blog-rewrites/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.ts exports rewrite: BlogRewrite with slug 'a-space-shooter-shrank-66-percent-to-fit-in-your-browser' and migrationId '2026-10-10-rewrite-a-space-shooter-shrank-66-percent-to-fit-in-your-browser-v2'.
- [ ] Its title, excerpt and content are byte-identical to the frontmatter title, excerpt and body of content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md.
- [ ] server/blog-rewrites/index.ts is unchanged (it already imports spaceShooterRewrite); tests/blog-rewrites.test.ts passes, including 'every entry passes readability', with no edits to the test file; pnpm typecheck passes.
- [ ] Commit pushed to origin (StanislavBG/bilko-run) main; never to the content-grade remote.
- [ ] After deploy (bounded poll: at most 20 tries, 30 s apart), https://bilko.run/api/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser returns the new title and each /blog-images/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/<file> returns 200 image/jpeg; else report 'pushed, deploy not yet live' with last status codes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.ts

# Implementation notes

Read first: server/blog-rewrites/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.ts (current shape), server/blog-rewrites/turn-your-github-year-into-a-heatmap-and-badge-wall.ts (a recent v2 entry to copy), server/blog-rewrites/types.ts, tests/blog-rewrites.test.ts lines 60-90, content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md (landed by PRD rewrite-space-shooter-post; read the landed file first).
Steps:
1. Rewrite server/blog-rewrites/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.ts with the new migrationId and the md's title/excerpt/body. Guarantee byte identity: a throwaway node script in a mktemp -d dir that reads the md, splits frontmatter, and prints JSON.stringify of title/excerpt/body; use JSON string literals if template-literal escaping gets messy.
2. Run pnpm vitest run tests/blog-rewrites.test.ts tests/blog-posts-loader.test.ts and pnpm typecheck.
3. Commit exactly that one path (message feat(blog): ship v2 rewrite of a-space-shooter-shrank-66-percent-to-fit-in-your-browser). Then git pull --rebase origin main && git push origin main. On rebase conflict HALT and report.
4. Bounded live check with curl -sf --max-time 15, at most 20 tries 30 s apart.
Do not touch: other server/blog-rewrites entries, server/blog-rewrites/index.ts, content/blog/, public/.

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
