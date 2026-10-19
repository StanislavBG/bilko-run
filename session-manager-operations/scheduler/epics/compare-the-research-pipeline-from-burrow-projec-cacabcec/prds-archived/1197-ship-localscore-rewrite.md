---
title: Ship the LocalScore post rewrite to the live database via server/blog-rewrites
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T16:30:31.712Z
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: feature
agentType: dev-lead
dependsOn: [rewrite-localscore-post-dag]
planId: pl-mv2m10pj-73f010
---
# Goal

migration: editing `content/blog/<slug>.md` never updates a post that is already in the database. So the LocalScore rewrite (`localscore-browser-ai-that-never-sees-your-data`, landed by PRD `rewrite-localscore-post-dag`) needs a `server/blog-rewrites` entry. Add the entry, register it, push it to origin main, and verify that the new text and figures are live on https://bilko.run.

# Acceptance criteria

- [ ] New file `server/blog-rewrites/localscore-browser-ai-that-never-sees-your-data.ts` exports `rewrite: BlogRewrite` with:
  - slug `'localscore-browser-ai-that-never-sees-your-data'`
  - migrationId `'2026-10-10-rewrite-localscore-browser-ai-that-never-sees-your-data-v2'`
  - title, excerpt and content byte-identical to the frontmatter title, the frontmatter excerpt and the body of `content/blog/localscore-browser-ai-that-never-sees-your-data.md`
- [ ] `server/blog-rewrites/index.ts` imports it as `localScoreRewrite` and appends it to `BLOG_REWRITES`.
- [ ] `tests/blog-rewrites.test.ts` passes, including its 'every entry passes readability' test, with no edits to the test file.
- [ ] The commit is pushed to origin (StanislavBG/bilko-run) main, never to the content-grade remote.
- [ ] After deploy, checked with a bounded poll of at most 20 tries 30 s apart: https://bilko.run/api/blog/localscore-browser-ai-that-never-sees-your-data returns the new title, and every https://bilko.run/blog-images/localscore-browser-ai-that-never-sees-your-data/<file> returns 200 image/jpeg. If the 20 tries run out, report 'pushed, deploy not yet live' with the last status codes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/localscore-browser-ai-that-never-sees-your-data.ts
- server/blog-rewrites/index.ts

# Implementation notes

Work in /home/bilko/Projects/Bilko.

Read first:
- `server/blog-rewrites/twelve-places-one-weather-rule-you-set-yourself.ts`, for the shape to copy: `import type { BlogRewrite } from './types.js'; export const rewrite: BlogRewrite = { slug, migrationId, title, excerpt, content }`.
- `server/blog-rewrites/index.ts` (whole).
- `tests/blog-rewrites.test.ts` lines 60-90.
- `content/blog/localscore-browser-ai-that-never-sees-your-data.md`.

Steps:
1. Create the rewrite file. To guarantee byte identity, write a throwaway node script in a `mktemp -d` folder. It reads the md, splits off the frontmatter, and prints `JSON.stringify` of title, excerpt and body. Paste those values in as JSON string literals.
2. Register the entry in `index.ts`.
3. Run `pnpm vitest run tests/blog-rewrites.test.ts tests/blog-posts-loader.test.ts` and `pnpm typecheck`.
4. Commit exactly the two server files with the message `feat(blog): ship rewrite of localscore-browser-ai-that-never-sees-your-data`. Then run `git pull --rebase origin main && git push origin main`. On a rebase conflict, HALT and report.
5. Run the bounded live check: `for i in $(seq 1 20)`, using `curl -sf --max-time 15` and `sleep 30`.

Do not touch: rewrite files for other slugs, `content/blog/`, `public/`.

# Out of scope

- Changing the post text (fix it in content/blog only if the rewrites readability test fails, and say so)
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
