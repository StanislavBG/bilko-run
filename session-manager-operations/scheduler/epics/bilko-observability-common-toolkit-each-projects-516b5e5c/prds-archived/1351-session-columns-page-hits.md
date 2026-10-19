---
title: Session columns on page_hits/click_events + page-hit recorder stores session ids
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-18T18:25:10.088Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-identity-cookie]
planId: pl-mve5lxlp-756161
---
# Goal

wire: give the server-recorded page hit and click tables a session_id and the client visitor UUID, so every HTML load on bilko.run joins a session even when no client JS runs. Add the indexes a session timeline query needs. Make the page-hit recorder write the ids that the session-identity hook stashes on the request.

# Acceptance criteria

- [ ] ADDITIVE_COLUMNS in server/db-schema.ts gains session_id TEXT and client_vid TEXT for both page_hits and click_events, plus track_name TEXT for click_events.
- [ ] The post-ALTER index batch in server/db.ts (around lines 175-195, next to idx_page_hits_visitor) adds idx_page_hits_session(session_id), idx_click_events_session(session_id), idx_app_errors_session(session_id) and idx_funnel_events_visitor(visitor_id). It does not duplicate the existing idx_page_views_session or idx_funnel_events_session.
- [ ] In server/page-hits.ts, PageHitInput gains sessionId and clientVid. registerPageHitRecorder fills them from (req as any).bilkoIds when present, else from readSessionIds(req.headers.cookie) imported from server/session-identity.ts. flushPageHits INSERTs them into page_hits.session_id and page_hits.client_vid.
- [ ] tests/page-hits.test.ts gets a new test: a GET of an HTML route with a cookie of bilko_sid=<uuid>; bilko_vid=<uuid> results, after flushPageHits(), in a page_hits row with that session_id and client_vid. A request with no cookie and no hook stores NULL for both.
- [ ] initDb() runs cleanly twice in a row: the additive migration stays idempotent, and existing tests in tests/page-hits.test.ts pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db-schema.ts
- server/db.ts
- server/page-hits.ts
- tests/page-hits.test.ts

# Implementation notes

Read first: server/db-schema.ts lines 570-620 (ADDITIVE_COLUMNS shape); server/db.ts lines 155-195 (how ADDITIVE_COLUMNS is applied and the post-ALTER index list); server/page-hits.ts lines 60-200; server/session-identity.ts (added by PRD session-identity-cookie; read the landed code for readSessionIds and the req.bilkoIds shape { visitorId, sessionId, mintedVisitor, mintedSession }).

Steps:
1. db-schema.ts: add the columns.
2. db.ts: add the indexes to the batch that runs after the ALTERs. They must not go in MIGRATIONS, which runs before the ALTERs and would fail on an existing DB.
3. page-hits.ts: extend the input, the recorder and the flush INSERT.
4. Write the test.

Do not touch: server/routes/analytics.ts (PRD analytics-ingest-session-ids owns the click route), server/session-identity.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/page-hits.test.ts tests/analytics-click.test.ts tests/analytics-pageview.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
