---
title: Wire social cards into the server: /og/<slug>.png route and OG injection on every HTML response
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T21:50:47.884Z
sourcePromptId: url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f
agentType: dev-lead
dependsOn: [og-meta-resolver, og-image-renderer]
planId: pl-mv2xgl7c-32470c
---
# Goal

wire: adopt server/og-meta.ts (resolveOg, injectOgMeta, loadOgProjects) and server/og-image.ts (renderOgCard) in the Fastify server. Add GET /og/<slug>.png and /og/default.png, and an onSend hook that injects the resolved card into every HTML response — both the SPA fallback (/, /projects, /blog/<slug>, /products/session-manager) and static-path sibling bundles served by @fastify/static at /projects/<slug>/, which today carry no OG tags at all. Replace the hand-maintained OG_OVERRIDES map so shared links always reflect the live registry.

# Acceptance criteria

- [ ] New server/og-routes.ts exports `registerOgRoutes(app: FastifyInstance, ctx: OgContext): void` registering GET '/og/:file' (file must match ^([a-z0-9-]+)\.png$; 'default' renders the site card; a registry slug renders that project's card with urlLabel 'bilko.run/projects/<slug>'; anything else 404 text/plain) with content-type image/png and cache-control 'public, max-age=86400'.
- [ ] registerOgRoutes also adds an onSend hook that, for text/html responses that are not attachments and whose req.url path resolveOg maps to non-null, returns injectOgMeta(payload, meta); it only handles string/Buffer payloads (stream buffering is already done by the security-headers onSend hook) and leaves non-matching responses byte-identical.
- [ ] server/index.ts builds the context once at boot (loadOgProjects() plus published entries from loadBlogPosts() mapped to slug/title/excerpt) and calls registerOgRoutes(app, ctx) immediately after registerSecurityHeaders(app) so the hook runs after nonce injection and before compression; the OG_OVERRIDES map and ogHtmlByPath are removed and the SPA fallback sends indexHtml.
- [ ] tests/og-routes.test.ts (app.inject on a minimal Fastify app with registerSecurityHeaders + registerOgRoutes + a static-like HTML route) asserts: /og/page-roast.png 200 image/png; /og/default.png 200; /og/nope.png and /og/..%2fx.png 404; an HTML response at /projects/page-roast/ gains og:title containing the registry name and og:image https://bilko.run/og/page-roast.png while still carrying the CSP nonce meta; /products/session-manager gets the session-manager tagline; a /api JSON response is untouched.
- [ ] tests/spa-fallback-notfound-crash.test.ts and tests/security-headers.test.ts still pass unchanged.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/og-routes.ts
- server/index.ts
- tests/og-routes.test.ts

# Implementation notes

Read first: server/og-meta.ts and server/og-image.ts (landed by PRDs og-meta-resolver and og-image-renderer — read their exported signatures before writing code); server/index.ts lines 80-90 (registerSecurityHeaders call site) and lines 218-285 (OG_OVERRIDES + setNotFoundHandler); server/security-headers.ts lines 150-195 (the HTML onSend hook that buffers streams to a string — ours must run after it); tests/security-headers.test.ts (how app.inject tests are set up).

Steps:
1. Create server/og-routes.ts with registerOgRoutes. Use req.url split on '?' for the path. For /og/:file, validate with the regex before any registry lookup. Hook order: Fastify runs onSend hooks in registration order, so registering right after registerSecurityHeaders guarantees a string payload for HTML.
2. server/index.ts: import loadOgProjects, registerOgRoutes, loadBlogPosts (already exported from server/blog-posts.ts); build ctx; call registerOgRoutes(app, ctx) on the line after `registerSecurityHeaders(app);`. Delete OG_OVERRIDES / ogHtmlByPath and send `indexHtml` in the not-found handler (keep its existing `return reply.send` comment and cache-control header).
3. If loadOgProjects throws at boot, log app.log.error and continue with an empty projects list (cards fall back to the site default) — never crash the server.
4. tests/og-routes.test.ts.

Do not touch: server/og-meta.ts, server/og-image.ts (fix nothing there; report mismatches), index.html, public/.

# Out of scope

- Changing card copy/design
- Editing sibling repos' index.html

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/og-routes.test.ts tests/og-meta.test.ts tests/og-image.test.ts tests/security-headers.test.ts tests/spa-fallback-notfound-crash.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
