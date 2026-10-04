---
title: Blog API: support scheduled publishing (hide posts dated in the future)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T19:10:44.394Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
disposition: new-head
planId: pl-musrowbu-be7ff7
---
# Goal

behavior: make a published blog post with a future published_at invisible on public endpoints until that moment arrives, so a post requested inside the 3-day minimum gap can be seeded now and go live automatically at the next allowed slot instead of doubling up on one day. This is needed to remediate the 2026-10-03 double publication (one post gets rescheduled to 2026-10-07) and to give owner "publish now" requests a safe landing.

# Acceptance criteria

- [ ] `server/routes/blog.ts` GET /api/blog only returns rows with `published = 1 AND datetime(published_at) <= datetime('now')`, still ordered by published_at DESC.
- [ ] `server/routes/blog.ts` GET /api/blog/:slug returns 404 for a published post whose published_at is in the future, and the post normally once its time has passed.
- [ ] `server/routes/admin-observability.ts` blog-cadence latest-post query applies the same `datetime(published_at) <= datetime('now')` filter, so the live gap ignores scheduled posts. Admin list /api/blog/admin/all is unchanged (still shows everything).
- [ ] New `tests/blog-scheduled-publish.test.ts` builds a Fastify app with registerBlogRoutes against the local test DB (initDb), inserts one past-dated and one future-dated published post with unique test slugs, and asserts list + single-post behaviour for both; it deletes its test rows afterwards.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/blog.ts
- server/routes/admin-observability.ts
- tests/blog-scheduled-publish.test.ts

# Implementation notes

Read first: server/routes/blog.ts lines 1-30, server/routes/admin-observability.ts lines 318-360, tests/db.test.ts lines 1-10 (initDb usage).

Steps:
1. blog.ts: add the datetime filter to the two public queries. Use SQLite `datetime()` on both sides so mixed formats ('YYYY-MM-DD HH:MM:SS' and ISO with Z) compare correctly.
2. admin-observability.ts: same filter in the latest-post query (around line 344).
3. Test: use `Fastify()` + `app.inject`. Unique slugs like `test-scheduled-future-<Date.now()>`. Future date = now + 2 days ISO; past date = now - 2 days ISO. Clean up with DELETE in afterAll.

Do not touch: server/db.ts, scripts/, .claude/skills/ (sibling PRDs own them).

# Out of scope

- Frontend changes
- Changing any existing post's date
- RSS/sitemap (none exist today)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-scheduled-publish.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
