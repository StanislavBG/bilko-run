---
title: Telemetry ingest: answer quota throttling with 429 + Retry-After instead of a silent 200
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-12T15:54:34.436Z
sourcePromptId: session-manager-telemetry-ingest-stop-silent-dro-42d3e451
tag: bug
agentType: dev-lead
planId: pl-mv5fnakk-fbfa8e
---
# Goal

behavior: the per-install (200/hour, 2000/day) and per-app (250k/day) quotas in server/routes/telemetry.ts currently drop over-cap records but still answer 200, so the Session Manager desktop client marks them delivered and never re-sends them. Make every quota refusal answer HTTP 429 with a Retry-After header. Make the check all-or-nothing per request, and charge no budget when it refuses, so a retried batch never double-inserts the part that would have fit. The client (session-manager telemetryClient.cjs applyFailureBackoff) already requeues with backoff on 429, and host-kit's browser SDK is fire-and-forget, so neither client disables itself on 429.

# Acceptance criteria

- [ ] server/routes/telemetry.ts: a batch on /api/telemetry/event, /log or /error whose surviving records would push any per-install hourly/daily or per-app daily bucket over its limit gets HTTP 429, a Retry-After header (integer seconds >= 1 until that window resets) and body {error:'quota_exceeded', retryAfterSec}, and inserts zero rows from that batch
- [ ] server/routes/telemetry.ts: a refused batch consumes no quota (quota check is peek-then-charge across all buckets the batch touches)
- [ ] server/routes/telemetry.ts: /api/telemetry/install answers 429 + Retry-After when its per-app or per-install daily quota is exhausted, instead of {ok:true}
- [ ] server/routes/telemetry.ts: malformed records (app not matching APP_SLUG_RE; /log records with an invalid level) are still dropped silently and are not charged to any quota; successful batch responses are {ok:true, ingested:<rows written>}
- [ ] server/routes/telemetry.ts: the abuse-controls header comment is rewritten to explain why throttling is 429 not 200, and a comment by beaconTag documents that X-SM-Beacon-Key is deliberately ignored (its value is a public fallback constant compiled into the npm package, so checking it authenticates nothing)
- [ ] tests/telemetry.test.ts: the old 'per-install hourly limit drops silently with a 200' test is replaced by one asserting statuses [200,200,200,200,429] for 5x50 records from one visitor_id with a positive Retry-After and exactly 200 stored rows; a new test shows a 20-record batch at 190 used is refused with 429 and a following 10-record batch still succeeds (total 200 rows)

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/telemetry.ts
- tests/telemetry.test.ts

# Implementation notes

Read first: server/routes/telemetry.ts lines 1-130 (rate limiters, bumpWindow, allowVisitor, allowApp, admit) and 195-330 (routes); tests/telemetry.test.ts lines 180-215 (abuse-control tests).

A tested reference implementation exists as a patch at /home/bilko/Projects/Bilko/session-manager-operations/logs/sm-telemetry-ingest.patch (absolute path, untracked, in the main checkout — read it, do not git apply it whole: it also contains the env, retention and read-side work that sibling PRDs own). Take only the quota hunks: types Quota, functions quotaWait / quotaConsume / chargeQuotas, the new admit(batch, valid) returning {ok:true, records} | {ok:false, retryAfterSec}, sendThrottled(reply, retryAfterSec) (import FastifyReply type from 'fastify'), and the install-route chargeQuotas call. Leave out envOf / envPredicate / parseEnvSelector / pruneTelemetryScheduled / startScheduledPrune and every `env` column in INSERTs.

Steps:
1. telemetry.ts: replace bumpWindow/allowVisitor/allowApp with Quota + quotaWait (pure) + quotaConsume + chargeQuotas (all-or-nothing).
2. telemetry.ts admit(): drop malformed records, group survivors per app and per visitor_id (visitor_id sliced to 80; empty visitor_id is exempt from per-install quotas), then chargeQuotas.
3. Each batch route: `if (!admitted.ok) return sendThrottled(reply, admitted.retryAfterSec)`; /log passes `(l) => ALLOWED_LEVELS.has(String(l.level))` as the validity predicate instead of skipping inside the loop.
4. /install: replace the two silent `return { ok: true }` throttles with chargeQuotas over `_appDay` key appName and `_visitorDay` key `install:${installId}`; keep the bad-slug `return { ok: true }` and the 400 for missing install_id.
5. Update comments as the criteria say; update tests.
The per-IP limiter (bumpAndCheck, already 429) is unchanged.

# Out of scope

- Persisting the env field (sibling PRD telemetry-persist-env)
- Retention changes
- Persisting limiter state across deploys

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
