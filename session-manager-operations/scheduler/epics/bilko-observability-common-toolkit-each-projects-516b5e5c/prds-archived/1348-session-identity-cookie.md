---
title: Shared bilko.run session identity cookies (bilko_vid / bilko_sid)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T18:23:30.397Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
planId: pl-mve5lxlp-756161
---
# Goal

primitive: add one server module that defines the single session identity contract for all of bilko.run. It covers the host SPA, every static-path app under /projects/<slug>/, the injected click beacon, and the host-kit SDK. Today each surface invents its own visitor/session id: sessionStorage per tab, server-side ip+ua hashes, or none at all. So nothing joins into one user session. This PRD mints and refreshes first-party cookies on HTML responses and exposes a validated reader that later PRDs use.

# Acceptance criteria

- [ ] New file server/session-identity.ts exports VID_COOKIE='bilko_vid', SID_COOKIE='bilko_sid', VID_MAX_AGE_S=31536000, SID_IDLE_S=1800, isValidId(v: unknown): v is string (UUID regex only), readSessionIds(cookieHeader: string | undefined): { visitorId: string | null; sessionId: string | null } (invalid values -> null), and registerSessionIdentity(app: FastifyInstance): void.
- [ ] registerSessionIdentity adds an onRequest hook that sets (req as any).bilkoIds = { visitorId, sessionId, mintedVisitor, mintedSession }, keeping valid cookie values and minting crypto.randomUUID() for missing or invalid ones.
- [ ] Its onSend hook appends Set-Cookie for bilko_vid (Max-Age=31536000) and bilko_sid (Max-Age=1800, refreshed on every qualifying response, i.e. a sliding idle window). Both are Path=/; SameSite=Lax, plus Secure when the request is https (req.protocol or x-forwarded-proto), and are NOT HttpOnly. It does this only for GET responses with status 200, a content-type starting with text/html, and a URL that does not start with /api/. Any Set-Cookie headers already present are preserved, not overwritten.
- [ ] server/index.ts calls registerSessionIdentity(app) before registerPageHitRecorder(app) and registerClickBeacon(app).
- [ ] New tests/session-identity.test.ts (Fastify inject) covers: minting on first HTML GET; reusing valid cookies; replacing a malformed cookie value such as '<script>' with a fresh UUID; no Set-Cookie on /api/* responses, on non-HTML responses, or on 404; an existing Set-Cookie header from a route surviving; readSessionIds parsing a multi-cookie header.
- [ ] pnpm typecheck and the gate tests pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/session-identity.ts
- server/index.ts
- tests/session-identity.test.ts

# Implementation notes

Read first: server/index.ts lines 80-175 (hook registration order; registerPageHitRecorder at ~160, registerClickBeacon at ~163); server/page-hits.ts lines 80-100 (sessionCookie() cookie-parsing style to mirror); server/click-beacon.ts lines 34-50 (onSend hook pattern); tests/click-beacon.test.ts (Fastify inject test pattern).

Identity contract (later PRDs rely on these exact names): cookie bilko_vid = visitor UUID, 1 year; cookie bilko_sid = session UUID, 30-minute sliding idle window. Both are readable by client JS (not HttpOnly) and shared across tabs because the whole site is one origin. A valid id matches /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i. Anything else counts as absent, so an attacker-set cookie is never echoed back or stored. Wire field names on beacons and API bodies: visitor_id, session_id.

Steps:
1. Write server/session-identity.ts. Add a module doc comment stating the contract above, so client implementers (BEACON_JS, host-kit telemetry.ts, src/hooks/usePageView.ts) can point at it. Use node:crypto randomUUID.
2. onSend: use reply.header('set-cookie', [...existing, ...new]). Read existing values via reply.getHeader('set-cookie'), which may be a string, an array or undefined. Return payload unchanged.
3. Register in server/index.ts.
4. Write the test with Fastify({ logger: false }) and a route returning reply.type('text/html').send('<html><head></head></html>').

Do not touch: server/page-hits.ts, server/click-beacon.ts, server/routes/analytics.ts (sibling PRDs own them).

# Out of scope

- Consuming the ids in page-hits, click or telemetry routes (separate PRDs)
- Client-side JS changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/session-identity.test.ts tests/click-beacon.test.ts tests/page-hits.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
