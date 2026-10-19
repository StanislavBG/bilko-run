---
title: Blog: stop naming the retired Content-Grade repo in two published posts
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T21:29:30.976Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1hah5s-db94e8
---
# Goal

behavior. Two live bilko.run blog posts seeded in server/db.ts name the retired ContentGrade project. In 'from-saas-to-host-decomposing-bilko-in-one-week' (~line 1668) the text says the MCP 'commits to the host's `origin` and `content-grade` remotes in parallel'. In 'week-of-six-games' (~line 1810) it says 'Render auto-deploys from `Content-Grade/master`, not `main`'. Both are now wrong and point readers at a dead project. Fix the seed text and correct the live rows once, using the existing applyDataMigrationOnce pattern.

# Acceptance criteria

- [ ] server/db.ts seed text, post 1: the sentence now reads that the MCP commits to the host repo's `origin` remote and Render auto-deploys within a minute; no mention of content-grade.
- [ ] server/db.ts seed text, post 2: the sentence now says Render was auto-deploying from a different branch than assumed, with no mention of Content-Grade; the rest of the paragraph is unchanged.
- [ ] A new `applyDataMigrationOnce('2026-10-09-blog-drop-content-grade', [...])` in initDb runs parameterized `UPDATE blog_posts SET content = replace(content, ?, ?), updated_at = ? WHERE slug = ?` for each post, with the exact old and new sentences, placed after the existing one-shot fixups.
- [ ] New tests/blog-contentgrade-scrub.test.ts: on a fresh DB after initDb, neither post's content matches /content.?grade/i. A row reset to the old sentence, with its data_migrations row deleted, is corrected by a second initDb.
- [ ] tests/db.test.ts, tests/blog-rewrites.test.ts and tests/blog-cadence-gate.test.ts stay green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- tests/blog-contentgrade-scrub.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Tests use an isolated tmpdir SQLite DB (vitest.config.ts sets BILKO_SQLITE_PATH).

Read first: server/db.ts lines 575-612 (applyDataMigrationOnce), 1595-1600 and 1660-1670 (post 1), 1720-1725 and 1805-1812 (post 2), 2800-2815 and 3000-3020 (existing one-shot fixup pattern); tests/db.test.ts (how initDb is called in tests).

The seed strings are inside template literals with escaped backticks; copy the exact old sentence from the file into the migration's replace() args. Keep the new wording short and plain; do not rewrite anything else in either post.

Do not touch: server/blog-rewrites/, other posts, scripts/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-contentgrade-scrub.test.ts tests/db.test.ts tests/blog-rewrites.test.ts tests/blog-cadence-gate.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
