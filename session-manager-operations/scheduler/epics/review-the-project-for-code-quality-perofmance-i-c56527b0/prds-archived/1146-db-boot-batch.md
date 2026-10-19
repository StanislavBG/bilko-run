---
title: Faster server start: stop ~140 sequential database calls at every boot
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-09T23:14:11.946Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [blog-posts-migrate]
planId: pl-mv1kpii1-1d18b9
---
# Goal

behavior. initDb() in server/db.ts makes ~140 sequential round-trips before the server listens; at 20-60 ms each on Turso that's 3-9 s of downtime on every deploy. About 42 ALTER TABLE ADD COLUMN statements throw 'duplicate column' on every boot and get swallowed (~lines 621-681). About 43 config/budget seed upserts and 6 secret_metadata inserts each run separately. Check existing columns once per table via PRAGMA table_info, and send the idempotent seeds in batches. Read the landed db.ts from blog-posts-migrate first.

# Acceptance criteria

- [ ] Additive column migrations run `PRAGMA table_info(<table>)` once per affected table and issue ALTER only for missing columns. No ALTER is attempted or swallowed on a second boot.
- [ ] Idempotent seeds (budgets, ceilings, referrer rules, secret metadata, blog posts if not already batched) are sent in at most a few `client.batch(..., 'write')` calls.
- [ ] New tests/db-boot.test.ts runs initDb twice on a fresh temp DB with a spy on the client's execute/batch. It asserts the second boot issues at most 25 round-trips (report the before and after counts measured first on the old code) and that the schema and seeded rows are identical after both boots.
- [ ] tests/db.test.ts, tests/blog-*.test.ts and the full `pnpm test` are green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- tests/db-boot.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Measure the old round-trip count first (spy) and put it in the report. Never drop or rewrite data; keep every statement's semantics (INSERT OR IGNORE stays ignore, raise-only upserts stay raise-only).

Read first: server/db.ts lines 1-70 (client/helpers), 520-760 (MIGRATIONS tail, data_migrations, ALTER list, seeds), and the blog insert loop.

Do not touch: content/blog/, server/blog-posts.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/db-boot.test.ts tests/db.test.ts
timeout 400 pnpm vitest run
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
