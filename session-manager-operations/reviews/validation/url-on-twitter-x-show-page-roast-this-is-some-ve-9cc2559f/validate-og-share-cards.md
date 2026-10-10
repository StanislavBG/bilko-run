# Validation — OG share cards (base 3f0111b, HEAD 584b9e0)

Commits: 8d557c7 (meta), e01141c (image), 4cbac19 (base html), a34f9bd (routes), 0d7871d (doc), 584b9e0 (live record). All on origin/main.

Gate caveat: the job worktree has no node_modules. Gates were re-run in the main checkout (same HEAD 584b9e0), which lacks `@resvg/resvg-js` locally (declared in package.json:61 and pnpm-lock.yaml, so a `pnpm install` gap, not a code defect). Result there: og-meta, security-headers, spa-fallback-notfound-crash and static-cache suites pass (48 tests); og-image and og-routes suites could not load (module missing); tsc server typecheck fails only on that missing module. Those two suites were NOT executed by me. Their behaviour is covered instead by the live endpoint checks below, which exercise the same renderer and routes in production.

## og-meta-resolver — VERIFIED
- server/og-meta.ts exports resolveOg / injectOgMeta / loadOgProjects (tests/og-meta.test.ts 10 pass).
- Live: `<title>` and og tags rewritten per page (see below); no 'AI Advisory' served.
- Test asserts stale 'AI Advisory' title and og-bilko.png are removed.

## og-image-renderer — VERIFIED (tests not run locally)
- package.json:61 `@resvg/resvg-js` in dependencies; lock has 39 references.
- server/assets/fonts/ holds DejaVuSans(+Bold).ttf and LICENSE.
- server/og-image.ts: `loadSystemFonts: false` (:138), escapeXml (:43), CACHE_MAX=200 Map (:24, :130).
- Live: /og/session-manager.png, /og/page-roast.png, /og/default.png all 200 image/png.

## og-base-html-refresh — VERIFIED
- index.html:6 title 'bilko.run — Small AI tools, one at a time'; :13/:22 new description; :14/:23 image https://bilko.run/og/default.png; :15-16 width/height 1200/630.
- No 'AI Advisory'/'small business' in index.html.
- `git grep -e og-bilko -e og-pageroast` outside session-manager-operations/ matches only tests/og-meta.test.ts (stale-fixture assertion strings); public/og-* removed.
- Note: PRD said only tests/static-cache.test.ts may reference them; og-meta.test.ts uses them as negative-assertion fixtures, which is mandated by og-meta-resolver's own criteria.

## og-wire-routes — VERIFIED (og-routes tests not run locally)
- server/og-routes.ts: regex-validated `/og/:file`, 404 text/plain for unknown, cache-control public,max-age=86400, onSend hook restricted to text/html, non-attachment, string/Buffer.
- server/index.ts: registerOgRoutes right after registerSecurityHeaders; OG_OVERRIDES/ogHtmlByPath removed; boot failure of loadOgProjects caught and logged.
- Live: /og/nope.png 404 text/plain; project/product pages carry correct og:image.
- spa-fallback-notfound-crash and security-headers suites pass.

## og-host-contract-doc — VERIFIED
- docs/host-contract.md 'Social share cards' section: image URL, displayName ?? name / tagline, strip-and-replace behaviour, registry-update instruction, and the three implementing files named. ~12 lines.

## og-live-verify — VERIFIED
- og-live-check.md committed (584b9e0) listing URLs, status, og:title/og:image.
- Independently re-fetched today: /og/{session-manager,page-roast,default}.png 200 image/png; with -A Twitterbot /projects/page-roast/ -> 'PageRoast — bilko.run', og:image .../og/page-roast.png; /products/session-manager -> 'Session Manager — bilko.run', og:image .../og/session-manager.png; / -> new title, og:image .../og/default.png, zero 'AI Advisory'.
- PNG visual check not repeated; relied on the record's description.

## Findings
### Critical
- none
### Important
- none
### Minor
- Worktree/main checkouts lack `@resvg/resvg-js`; run `pnpm install` before running og-image/og-routes tests locally.
- server/og-routes.ts:35 `String(reply.getHeader('content-type'))` fine; no unsafe input paths found (slug regex + exact registry equality, attribute escaping per og-meta tests). No secrets or traversal issues seen.
