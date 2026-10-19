---
title: Host SPA trackFlow() helper (same taxonomy as host-kit)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-18T18:41:25.330Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [remove-usepageview-pageviews]
planId: pl-mve5lxlp-756161
---
# Goal

primitive: the host SPA's own pages (home, projects, blog, pricing, the Session Manager landing with its downloads, and the coffee tip) need to emit primary-flow events in the same shape host-kit's trackFlow sends. That way the admin Flows dashboard groups host flows with sibling-app flows. Add trackFlow and trackScreen helpers to the host's analytics module.

# Acceptance criteria

- [ ] src/hooks/usePageView.ts exports trackFlow(flow: string, step: string, props?: Record<string, unknown>): void.
- [ ] trackFlow sends navigator.sendBeacon('/api/telemetry/event', JSON.stringify({ batch: [{ app: 'bilko', name: `${flow}.${step}`, visitor_id, session_id, ts, props: { ...props, flow, step, path: location.pathname } }] })), falling back to fetch with keepalive.
- [ ] trackFlow silently drops a call whose flow or step fails /^[a-z0-9][a-z0-9-]{0,39}$/, and never throws.
- [ ] src/hooks/usePageView.ts exports trackScreen(screen: string): void, which sends the event name 'screen_view' with props { screen, path } using the same transport.
- [ ] Prop keys matching /(email|password|token|key|ssn|card|cvv|apikey)/i are replaced with '[redacted]', mirroring host-kit stripPII.
- [ ] New tests/host-track-flow.test.ts stubs globalThis navigator/location/document/localStorage and asserts: the payload shape and URL; that a bad flow name is dropped; the redaction; and that trackScreen sends the screen_view shape. pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/hooks/usePageView.ts
- tests/host-track-flow.test.ts

# Implementation notes

Read first: src/hooks/usePageView.ts (after PRD remove-usepageview-pageviews landed it: track(), getOrCreateVisitorId, getOrCreateSessionId); packages/host-kit/src/telemetry.ts trackFlow and stripPII (the reference shape to match); server/routes/telemetry.ts, the /api/telemetry/event handler (fields it reads: name, app, props, session_id, visitor_id).

Keep the existing track() untouched.

If importing usePageView.ts in node pulls in browser-only modules, guard the global access inside the functions so the test can stub the globals before calling them.

Do not touch: page components (sibling PRDs tag them).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/host-track-flow.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
