---
title: host-kit telemetry: shared cookie session, same-origin endpoint, trackFlow()
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-18T18:24:06.363Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
disposition: new-head
planId: pl-mve5mpcr-a175c5
---
# Goal

behavior: make the host-kit telemetry SDK the common reporting SDK for every static-path app. Its ids must join the site-wide session: it reads the bilko_vid/bilko_sid cookies instead of a per-tab sessionStorage id. Its events must always reach the telemetry endpoint, including when the app never called initTelemetry: today that fallback posts to /api/analytics/event, which rejects unknown event names with 400. Add trackFlow(flow, step) so apps can tag their primary flows in one consistent shape.

# Acceptance criteria

- [ ] Ids: in packages/host-kit/src/telemetry.ts, getVisitorId()/getSessionId() follow the touchSession rule from the implementation notes. The session id is re-read from the cookie on every enqueue and is never cached for the page lifetime; the bilko_sid cookie is rewritten with Max-Age=1800 on each enqueue.
- [ ] Endpoint: the default endpoint is the relative '/api/telemetry' when location.hostname is 'bilko.run' or 'www.bilko.run', and 'https://bilko.run/api/telemetry' otherwise. initTelemetry({ endpoint }) still overrides it.
- [ ] Uninitialized track(): it auto-initializes with app = the <slug> from a location.pathname of the form /projects/<slug>/ (else 'bilko') and version 'unknown', then buffers like an initialized call. No code path posts to /api/analytics/event any more.
- [ ] Every track() payload's props gets path: location.pathname unless the caller set props.path. New export trackFlow(flow: string, step: string, props?: Record<string, unknown>): void sends event name `${flow}.${step}` with props.flow and props.step. It silently drops the call when flow or step fails /^[a-z0-9][a-z0-9-]{0,39}$/. It is exported from packages/host-kit/src/index.tsx.
- [ ] New packages/host-kit/tests/telemetry.test.ts (jsdom) covers: the cookie id reuse and the legacy localStorage vid winning; sid cookie rotation once the cookie is absent; relative vs absolute endpoint by hostname; uninitialized track() deriving the app slug and batching to /event; trackFlow name and props, plus rejecting 'Bad Flow'; stripPII still redacting an 'email' prop.
- [ ] A new .changeset/*.md declares a minor bump for host-kit that describes the session cookie, the endpoint change and trackFlow. pnpm --filter host-kit test, typecheck and build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- packages/host-kit/src/telemetry.ts
- packages/host-kit/src/index.tsx
- packages/host-kit/tests/telemetry.test.ts
- .changeset/

# Implementation notes

Read first: packages/host-kit/src/telemetry.ts (whole file, ~200 lines); packages/host-kit/src/index.tsx lines 20-30 (export list); packages/host-kit/vitest.config.ts (jsdom env); an existing .changeset/*.md, if any, for the format (else the standard changesets frontmatter `---\n'host-kit': minor\n---`).

Identity contract (mirrors server/session-identity.ts, which a sibling PRD adds; host-kit cannot import server code, so duplicate the constants with a comment pointing there): cookie bilko_vid = visitor UUID, Max-Age 31536000; cookie bilko_sid = session UUID, Max-Age 1800 sliding; both `Path=/; SameSite=Lax` plus `; Secure` when location.protocol is https:, not HttpOnly. A valid id matches /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; anything else counts as absent.

touchSession rule:
- vid = the valid cookie bilko_vid, else the valid localStorage bilko_vid (legacy), else crypto.randomUUID().
- If the localStorage bilko_vid is valid and differs from the cookie, localStorage wins and the cookie is rewritten.
- Always set localStorage bilko_vid = vid and write the vid cookie.
- sid = the valid cookie bilko_sid, else a new UUID; always rewrite the sid cookie.
- Wrap all of this in try/catch and fall back to 'anon', as today.

Steps:
1. Replace getVisitorId/getSessionId in telemetry.ts. Keep _resetForTest resetting any new state.
2. Change the cfg.endpoint default. Replace the backward-compat direct-send branch in track() with lazy auto-init: call initTelemetry with the derived app and version 'unknown', then push to the buffer.
3. Add trackFlow and export it from index.tsx (the same line as track).
4. Write the tests. Clear document.cookie between tests by setting each cookie with Max-Age=0. Use vi.spyOn(navigator, 'sendBeacon') or stub fetch to assert the URLs.
5. Run `pnpm --filter host-kit build` so dist/ compiles.

Do not touch: anything outside packages/host-kit/ and .changeset/.

# Out of scope

- Bumping consumer apps or reinstalling host-kit in sibling repos
- Server-side changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --filter host-kit test && timeout 300 pnpm --filter host-kit typecheck && timeout 300 pnpm --filter host-kit build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
