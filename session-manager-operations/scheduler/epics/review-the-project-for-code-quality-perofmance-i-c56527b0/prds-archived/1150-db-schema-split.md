---
title: Database code: move table definitions out of server/db.ts into server/db-schema.ts
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T23:15:44.867Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [db-boot-batch]
planId: pl-mv1kpii1-1d18b9
---
# Goal

migration. After the blog move and boot batching (read the landed server/db.ts first), db.ts still mixes the client, query helpers, ~470 lines of CREATE TABLE/INDEX statements, the additive column list and seed data. Move the schema (the MIGRATIONS array and the additive-column list) into a new server/db-schema.ts so db.ts is client + helpers + initDb orchestration. Pure move; no SQL change.

# Acceptance criteria

- [ ] New server/db-schema.ts exports the MIGRATIONS array and the additive-columns list unchanged (byte-identical SQL strings), with a 3-line header saying 'add new tables here; additive columns go in ...'.
- [ ] server/db.ts imports them; its public exports (dbGet, dbAll, dbRun, dbTransaction, txGet, txRun, getClient, initDb, applyBlogRewrites, etc.) are unchanged; no other file needs edits.
- [ ] tests/db-boot.test.ts and full `pnpm test` green; report db.ts line count before and after.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- server/db-schema.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/db.ts (whole, post-batching). Do not touch: content/blog/, server/blog-posts.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 400 pnpm vitest run
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
