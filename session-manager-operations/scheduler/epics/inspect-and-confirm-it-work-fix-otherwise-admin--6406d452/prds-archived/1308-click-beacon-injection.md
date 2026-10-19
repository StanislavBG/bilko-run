---
title: Inject a site-wide click beacon into every HTML page the host serves
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:42:26.197Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [page-hits-wire, click-events-endpoint]
planId: pl-mv64vt5k-acb57a
---
# Goal

wire. POST /api/analytics/click exists (PRD click-events-endpoint) but no page sends to it, and 21 of 22 static-path apps carry no tracking code. Have the server inject a tiny inline, CSP-nonced click beacon into every HTML document response (SPA shell and every /projects/<slug>/ app) so clicks are captured host-wide without touching sibling repos.

# Acceptance criteria

- [ ] New server/click-beacon.ts exports BEACON_JS (string) and registerClickBeacon(app): an onSend hook that, for responses whose content-type starts with text/html, that are not attachments (content-disposition) and not isBlogVideoPath(req.url), inserts `<script nonce="<req.cspNonce>">BEACON_JS</script>` immediately before the first </head> (fallback: before </body>; neither present: unchanged), handling string, Buffer and stream payloads and removing content-length.
- [ ] BEACON_JS registers one capture-phase document click listener that finds the closest a, button, [role=button], summary, input[type=submit], input[type=button] or [data-track] element and sends navigator.sendBeacon('/api/analytics/click', JSON.stringify({ path, tag, id, label, href })); it does nothing when location.pathname starts with /admin, wraps everything in try/catch, and never reads the value of any input other than type submit/button.
- [ ] label is aria-label, else textContent collapsed and sliced to 80 chars; href is the raw href attribute; BEACON_JS is under 1500 bytes and contains no external URLs.
- [ ] server/index.ts calls registerClickBeacon(app) right after registerPageHitRecorder(app); the existing nonce hook in server/security-headers.ts does not double-nonce the injected tag.
- [ ] tests/click-beacon.test.ts proves: an HTML response gets exactly one injected script carrying the request's nonce; a JSON response, an attachment HTML response and a /blog-videos/ HTML path are unchanged; a streamed HTML file served by @fastify/static gets the beacon and no stale content-length.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/click-beacon.ts
- server/index.ts
- tests/click-beacon.test.ts

# Implementation notes

Read first: server/security-headers.ts lines 125-200 (onRequest sets (req as any).cspNonce; onSend buffers streams and nonces untagged <script> — the regex skips tags that already carry nonce=, so emit nonce yourself), server/index.ts lines 85-150 (hook registration order: registerSecurityHeaders at ~91 runs its onSend BEFORE yours, so you will usually receive a string, but still handle Buffer/stream), server/page-hits.ts (wired by PRD page-hits-wire), server/routes/analytics.ts POST /api/analytics/click (PRD click-events-endpoint).
Steps:
1. Tests first (tests/click-beacon.test.ts): build a Fastify app with registerSecurityHeaders(app) then registerClickBeacon(app) to reproduce production ordering.
2. Write server/click-beacon.ts; import isBlogVideoPath from './security-headers.js'. If cspNonce is absent (no security hook), inject without a nonce attribute.
3. Wire into server/index.ts.
Do not touch: server/security-headers.ts, server/routes/analytics.ts, any public/projects/ file, packages/host-kit/.

# Out of scope

- Page-view beacons (page views come from server-side page_hits)
- Scroll, mouse-move, keystroke or form-value capture
- Editing sibling repos or published bundles

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/click-beacon.test.ts && timeout 600 pnpm test && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
