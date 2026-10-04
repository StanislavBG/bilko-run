---
title: Blog rewrites: per-post rewrite modules applied to live posts by a once-only boot migration
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T17:30:27.585Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [1030-blog-publish-now-owner-override]
planId: pl-musn5bd6-b4cbc7
---
# Goal

primitive. The owner wants the last 5 published posts rewritten to the new editorial rules: plain GED-level English, cool side first, early-college reader, full links. Five sibling PRDs will each rewrite one post, so build a mechanism that lets each one edit only its own file. Use one module per post under server/blog-rewrites/. initDb applies every non-null rewrite to the live DB once, via the existing applyDataMigrationOnce.

# Acceptance criteria

- [ ] server/blog-rewrites/index.ts exports `interface BlogRewrite { slug: string; migrationId: string; title: string; excerpt: string; content: string }` and `BLOG_REWRITES: BlogRewrite[]`. BLOG_REWRITES collects the non-null `rewrite` export of these five modules, each created with `export const rewrite: BlogRewrite | null = null;`: server/blog-rewrites/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.ts, twelve-releases-in-four-days-for-the-scheduler-view.ts, sigma-now-shows-who-sits-behind-a-contract.ts, the-book-didnt-know-what-it-already-held.ts, a-new-game-a-week-old-and-already-playable.ts (the interface may live in a types.ts that index re-exports, to avoid import cycles)
- [ ] server/db.ts initDb, after all blog seeds and the '2026-10-03-blog-absolute-links' migration (~line 2983), loops BLOG_REWRITES and calls applyDataMigrationOnce(r.migrationId, [{ sql: 'UPDATE blog_posts SET title = ?, excerpt = ?, content = ?, updated_at = ? WHERE slug = ?', args: [...] }]). It never changes slug, published_at, category or published.
- [ ] New tests/blog-rewrites.test.ts: (a) with a stub rewrite on a fresh test DB, initDb-style application updates title/excerpt/content and leaves published_at unchanged, and a second application changes nothing. (b) For every entry in BLOG_REWRITES: analyzeReadability(content) from scripts/blog-readability.ts passes using the thresholds in .claude/skills/blog-from-git/blog.config.yaml `readability:`, migrationId is unique and starts with '2026-', the slug exists among the seeded posts, and the title is under 60 chars. (b) passes trivially while all five are null.
- [ ] Parameterized SQL only, through the db helpers. Existing tests in tests/db.test.ts still pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/
- server/db.ts
- tests/blog-rewrites.test.ts

# Implementation notes

Read first: server/db.ts lines 560-600 (applyDataMigrationOnce, initDb start) and 2840-3000 (the five target seeds plus the 2026-10-03 absolute-links migration as a style model); tests/db.test.ts (how a test DB and initDb are set up); scripts/blog-readability.ts (analyzeReadability, DEFAULT_THRESHOLDS); tests/blog-plain-language.test.ts (how the config's readability block is loaded into thresholds — reuse that).

Server is ESM TypeScript; match import extension style used by other server/ imports (e.g. '../clerk.js').

For (a), apply the migration helper directly against a stub list rather than mutating BLOG_REWRITES; export a small `applyBlogRewrites(rewrites)` from db.ts (or from index.ts taking the helper) so tests can call it.

Do not touch: the existing seed text for any post. Commit only your paths; then `git pull --rebase origin main` and `git push origin main` (never content-grade; retry pull+push at most 3 times on a race).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-rewrites.test.ts tests/db.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
