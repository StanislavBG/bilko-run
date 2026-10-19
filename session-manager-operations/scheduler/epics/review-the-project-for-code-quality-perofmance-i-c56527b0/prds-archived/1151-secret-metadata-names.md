---
title: Admin secrets list: seed the real secret names (STRIPE_SECRET_KEY, not STRIPE_API_KEY)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T23:15:52.848Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [db-schema-split]
planId: pl-mv1kpii1-1d18b9
---
# Goal

bug. server/db.ts seeds secret_metadata (the admin Secrets page's rotation inventory) with names the server never reads: STRIPE_API_KEY (the server reads STRIPE_SECRET_KEY) and CLERK_WEBHOOK_SECRET (nothing reads it). It is missing secrets the server does read: ANTHROPIC_API_KEY_ACADEMY, PROJECT_SNAPSHOT_TOKEN and BILKO_GAME_HMAC_KEY. Fix the seed and correct existing rows once, keeping any rotation dates already recorded.

# Acceptance criteria

- [ ] The secret_metadata seed lists only secrets read by server/ code (verified with git grep of process.env), including STRIPE_SECRET_KEY, ANTHROPIC_API_KEY_ACADEMY, PROJECT_SNAPSHOT_TOKEN and BILKO_GAME_HMAC_KEY.
- [ ] A new applyDataMigrationOnce('2026-10-10-secret-metadata-names', ...) renames an existing STRIPE_API_KEY row to STRIPE_SECRET_KEY, keeping its rotation timestamps, only when no STRIPE_SECRET_KEY row exists. It deletes the CLERK_WEBHOOK_SECRET row. All statements are parameterized.
- [ ] tests/secrets-metadata.test.ts covers: fresh DB has the new names; a DB pre-seeded with STRIPE_API_KEY (with a rotated_at value) keeps that value under STRIPE_SECRET_KEY after initDb.
- [ ] Full `pnpm test` green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- tests/secrets-metadata.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/db.ts (secret_metadata seed, grep 'secret_metadata'); server/routes/admin-secrets.ts (how rows are read); tests/secrets-metadata.test.ts. Do not touch: server/db-schema.ts unless the table definition must be read.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/secrets-metadata.test.ts tests/db.test.ts tests/db-boot.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
