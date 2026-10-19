---
title: Cleanup: server session-identity typing, /api check, page-hits fallback, stale comments
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-19T02:40:58.431Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
disposition: new-head
planId: pl-mvendohr-b6719f
---
# Goal

behavior: a clarity and minimalism pass over the server side of the session identity work, from an independent review. Type req.bilkoIds once instead of casting it with (req as any) in three places. Make the /api exclusion exact. Simplify the page-hits fallback. Fix comments that are now false or name the old src/hooks/usePageView.ts. Document the two visitor_id meanings.

# Acceptance criteria

- [ ] server/session-identity.ts declares, in a `declare module 'fastify' { interface FastifyRequest { bilkoIds?: BilkoIds } }` block, an exported BilkoIds type. No `(req as any).bilkoIds` remains in server/: rg -n 'as any\)\.bilkoIds' server returns nothing.
- [ ] The cookie-setting check in server/session-identity.ts (around line 72) excludes the path '/api' and anything under '/api/' (the pathname, ignoring the query string), and nothing else. A new case in tests/session-identity.test.ts asserts that GET '/api' and '/api?x=1' set no cookie, while '/apiary' (an HTML route in the test) does.
- [ ] In server/page-hits.ts (around lines 192-198), the inline fallback function is replaced by `const ids = req.bilkoIds ?? readSessionIds(h.cookie)` or the equivalent. The existing tests/page-hits.test.ts cases still pass.
- [ ] The header comment of server/session-identity.ts names src/lib/telemetry.ts instead of src/hooks/usePageView.ts. It also states that visitor_id means the server IP+UA hash in click_events/page_hits, while client_vid and page_views.visitor_id/sessions.visitor_id hold the bilko_vid cookie UUID.
- [ ] The pageview route comment in server/routes/analytics.ts (around line 97, 'no cookies, no PII') is rewritten to say accurately that the route reads the bilko_vid/bilko_sid cookies and the Clerk session. There are no behavior changes in analytics.ts.
- [ ] pnpm typecheck and the gate tests pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/session-identity.ts
- server/page-hits.ts
- server/routes/analytics.ts
- tests/session-identity.test.ts

# Implementation notes

Read first: server/session-identity.ts (whole file); server/page-hits.ts lines 180-205; server/routes/analytics.ts lines 90-105; tests/session-identity.test.ts (setup pattern).

Do not touch: server/routes/admin-sessions.ts or any src/ file (sibling cleanup PRDs own them).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/session-identity.test.ts tests/page-hits.test.ts tests/analytics-click.test.ts tests/analytics-pageview.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
