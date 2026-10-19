---
title: Blog posts as files: a loader that reads content/blog/*.md
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:05:11.401Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kpii1-1d18b9
---
# Goal

primitive. server/db.ts is ~3,100 lines, and ~2,300 of them are 42 blog posts written inline as SQL INSERTs. A non-developer can't add or fix a post without editing database code. This PRD adds only the loader: one markdown file per post (YAML frontmatter plus a markdown body) under a top-level content/blog/ folder. A later PRD moves the posts.

# Acceptance criteria

- [ ] New server/blog-posts.ts exports `interface SeedBlogPost` with every blog_posts column the db.ts seeds set (read the INSERTs to enumerate them: slug, title, excerpt, content, category, published, published_at and any others), plus `order: number`.
- [ ] It exports `loadBlogPosts(dir?: string): SeedBlogPost[]`. With no argument it resolves content/blog the same way server/services/manual.ts resolves data/manual: try process.cwd() and __dirname-relative candidates, so it works under tsx and from dist-server.
- [ ] It parses frontmatter with js-yaml and validates it with zod. The body after the closing `---` becomes `content`, including any later `---` lines. Results are sorted by `order`. An invalid file throws an Error naming the file and the field.
- [ ] New tests/blog-posts-loader.test.ts uses fixtures in a mkdtemp dir to cover: a valid parse; ordering; a missing required field (the error names the file); a title with colons and quotes; a body containing a `---` line; and non-.md files being ignored.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-posts.ts
- tests/blog-posts-loader.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. js-yaml and zod are already dependencies.

Read first: server/services/manual.ts lines 25-60 (path resolution pattern); server/db.ts around the blog seeds (grep `INSERT OR IGNORE INTO blog_posts`; read 2 examples to get the column list).

Do not touch: server/db.ts (blog-posts-migrate does the move).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-posts-loader.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
