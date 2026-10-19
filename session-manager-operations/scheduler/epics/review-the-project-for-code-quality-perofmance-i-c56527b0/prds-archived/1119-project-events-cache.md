---
title: Project events: stop rebuilding the whole event file from 5,000 rows on every GET
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T23:05:54.949Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kqg3p-1cba31
---
# Goal

behavior. server/routes/project-events.ts (~line 91) loads up to 5,000 rows on every GET, including Range requests. It joins them into a Buffer, slices it and replies with no-store. Cache the built Buffer per slug in memory and invalidate it when that slug's events change (the POST handler, ~line 73).

# Acceptance criteria

- [ ] An in-memory `Map<slug, { buf: Buffer; builtAt: number }>` serves repeat GETs, including Range slices, without a DB query. The POST that writes events for a slug deletes that slug's entry. Entries also expire after 5 minutes.
- [ ] Responses (status, headers, bytes, Range behavior) are byte-identical to before for the same data.
- [ ] tests/project-events.test.ts adds a test asserting that a second GET does not hit the DB (spy on the db helper) and that a GET after a POST returns the new event.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/project-events.ts
- tests/project-events.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/routes/project-events.ts (whole); tests/project-events.test.ts. Do not touch: server/index.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/project-events.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
