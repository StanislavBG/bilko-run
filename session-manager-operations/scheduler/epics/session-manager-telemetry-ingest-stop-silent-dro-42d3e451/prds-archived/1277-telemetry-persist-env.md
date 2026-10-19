---
title: Telemetry ingest: persist the per-record env (prod/dev/test) the client already sends
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-12T15:58:06.810Z
sourcePromptId: session-manager-telemetry-ingest-stop-silent-dro-42d3e451
tag: bug
agentType: dev-lead
dependsOn: [telemetry-quota-429]
planId: pl-mv5fnakk-fbfa8e
---
# Goal

behavior: the Session Manager client stamps every event/log/error/install record with env = 'prod' | 'dev' | 'test', but server/routes/telemetry.ts ignores it, so test-runner traffic (1,526 test epic.create rows were observed) mixes into prod summaries. Add an env column to the four telemetry tables, persist it, and export the read-side helpers parseEnvSelector/envPredicate that the usage and observability routes will use.

# Acceptance criteria

- [ ] server/db-schema.ts ADDITIVE_COLUMNS adds ['env','TEXT'] to funnel_events (with a comment that only telemetry ingest writes it) and new entries app_logs, app_errors, app_installs each with ['env','TEXT']
- [ ] server/routes/telemetry.ts: envOf(rec) returns rec.env when it is exactly 'prod', 'dev' or 'test', else null; the /event, /log and /error INSERTs and the /install upsert (INSERT column list plus `env = excluded.env` in ON CONFLICT) write envOf(...)
- [ ] server/routes/telemetry.ts exports `type EnvSelector = 'prod'|'dev'|'test'|'all'`, `parseEnvSelector(raw: unknown): EnvSelector` (unrecognised or absent -> 'prod', first element if array) and `envPredicate(sel, column = 'env'): { sql: string; args: string[] }` returning '1 = 1' for all, `COALESCE(<column>, 'prod') = 'prod'` for prod (NULL counts as prod), and `<column> = ?` with [sel] for dev/test
- [ ] tests/telemetry.test.ts: a test posts event records with env 'test', 'staging' and none, a log with 'dev', an error with 'prod' and an install with 'test', and asserts stored env values ['test', null, null], 'dev', 'prod', 'test'

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db-schema.ts
- server/routes/telemetry.ts
- tests/telemetry.test.ts

# Implementation notes

Read first: server/db-schema.ts lines 540-580 (ADDITIVE_COLUMNS; server/db.ts ~line 160 applies them with ALTER TABLE only when missing, also on fresh DBs); server/routes/telemetry.ts routes section (INSERT statements for funnel_events, app_logs, app_errors, app_installs upsert). This PRD runs after telemetry-quota-429 has landed: read the current telemetry.ts first — routes iterate `admitted.records`.

A tested reference is in /home/bilko/Projects/Bilko/session-manager-operations/logs/sm-telemetry-ingest.patch (absolute path, untracked; read, do not apply whole). Take only: the ADDITIVE_COLUMNS hunk in server/db-schema.ts; ALLOWED_ENVS / envOf / EnvSelector / parseEnvSelector / envPredicate in telemetry.ts; the `env` additions to the four INSERTs; the 'Telemetry ingest — env discriminator' test. envPredicate's `column` is a trusted literal from callers, never user input; the selector value is always a bound arg.

Steps: 1) db-schema.ts columns. 2) telemetry.ts helpers + exports. 3) INSERT changes (add column and placeholder in the same position). 4) test; the test should DELETE FROM funnel_events WHERE tool = 'env-app' first.

# Out of scope

- Filtering read routes by env (sibling PRD telemetry-env-read-filter)
- Retention

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/telemetry.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
