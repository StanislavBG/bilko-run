---
title: Blog API: cache the public post list for 60 seconds
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-09T23:07:13.473Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1ks4ox-2e2956
---
# Goal

behavior. The public `/api/blog` list (server/routes/blog.ts) queries the database on every hit. Its responses are uncached, and every visit to bilko.run/blog pays the Turso latency. Memoize the public list for 60 s in-process, keyed by query params. Respect scheduled publishing: posts dated in the future stay hidden until their time, so a cached list must expire no later than the next scheduled post's publish time. Admin writes invalidate the cache.

# Acceptance criteria

- [ ] The GET list handler serves from a memo (key = normalized query string) for up to 60 s, or until the earliest future published_at among hidden posts, whichever is sooner.
- [ ] Every admin write route in blog.ts (create/update/delete) clears the memo.
- [ ] The response also sets `Cache-Control: public, max-age=60` for the list (not for admin or draft responses).
- [ ] tests/blog-scheduled-publish.test.ts stays green. A new test in tests/blog-list-cache.test.ts asserts: a second GET within 60 s makes no DB call; a post becomes visible once its scheduled time passes; and an admin write invalidates the memo.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/blog.ts
- tests/blog-list-cache.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. blog.ts was recently changed by the blog-video work (video_url in the API); read it fresh. Read first: server/routes/blog.ts (whole, ~74 lines); tests/blog-scheduled-publish.test.ts. Do not touch: server/db.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-list-cache.test.ts tests/blog-scheduled-publish.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
