---
title: Blog posts as files: move all 42 seeded posts out of server/db.ts into content/blog/
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-09T23:11:33.529Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [blog-posts-loader]
planId: pl-mv1kpii1-1d18b9
---
# Goal

migration. Using loadBlogPosts() from server/blog-posts.ts (landed by blog-posts-loader; read it first), move every inline blog post seed in server/db.ts initDb() into content/blog/<slug>.md and replace the inline INSERTs with one loop. Afterwards a fresh database must hold exactly the same blog_posts rows as before. Do the move with a throwaway script, not by hand.

# Acceptance criteria

- [ ] Before editing: a throwaway script in $TMPDIR (not committed) runs initDb against a fresh BILKO_SQLITE_PATH temp file and dumps `SELECT * FROM blog_posts ORDER BY slug` (minus autoincrement id and any column defaulted to now) to $TMPDIR/before.json.
- [ ] Every inline `INSERT OR IGNORE INTO blog_posts` seed (and the first conditional seed) is replaced by content/blog/<slug>.md files with `order` preserving insertion order, plus one loop in initDb inserting all loaded posts with the same SQL semantics in a single `client.batch` (or chunks of at most 50).
- [ ] The one-shot `applyDataMigrationOnce` fixups and applyBlogRewrites stay in db.ts and still run after the inserts, in the same order as before.
- [ ] After editing, the same script writes $TMPDIR/after.json, and a byte-for-byte comparison with before.json reports identical; the report includes the row count and the comparison output.
- [ ] New content/blog/README.md explains in under 25 plain-English lines how to add a post: copy a file, the frontmatter fields, and that `published_at` must respect the blog cadence gate (scripts/blog-cadence-gate.ts).
- [ ] server/db.ts shrinks by at least 2,000 lines (report wc -l before and after); tests db, blog-cadence-gate, blog-rewrites, blog-scheduled-publish and blog-contentgrade-scrub stay green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- content/blog/

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Seeds are template literals with escaped backticks and `${...}` constants (e.g. GIT_VIEWER_CONTENT, GIT_VIEWER_SLUG near ~3000); resolve them to literal text in the .md files. Constants that are still referenced by a later applyDataMigrationOnce must stay in db.ts or be read from the loaded post.

Read first: server/blog-posts.ts; server/db.ts lines 575-620 and the blog seed region (grep `INSERT OR IGNORE INTO blog_posts`, ~760-3075); tests/blog-cadence-gate.test.ts (loadSeededPosts behavior).

Content directory must ship to Render: it is a top-level tracked folder read at runtime, like data/manual.

Do not touch: scripts/, .claude/skills/ (the blog pipeline is updated by blog-pipeline-seed-path), server/blog-rewrites/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/db.test.ts tests/blog-cadence-gate.test.ts tests/blog-rewrites.test.ts tests/blog-scheduled-publish.test.ts tests/blog-contentgrade-scrub.test.ts tests/blog-posts-loader.test.ts
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
