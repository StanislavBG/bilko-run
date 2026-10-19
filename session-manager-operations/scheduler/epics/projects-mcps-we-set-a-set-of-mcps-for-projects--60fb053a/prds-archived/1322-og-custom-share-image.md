---
title: /og/<slug>.png serves the project's own shareImage when present
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-13T03:56:52.416Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [listing-share-image-fields]
planId: pl-mv653d38-529056
---
# Goal

behavior: today every project's X card at https://bilko.run/og/<slug>.png is a generated text card. When the registry entry's `listing.shareImage` (added by PRD listing-share-image-fields) points at a valid 1200x630 PNG inside the project's published bundle, serve those bytes from the same `/og/<slug>.png` URL instead, so links posted on X show the project's own image. Any problem with the file falls back to the generated card — a share link must never 404.

# Acceptance criteria

- [ ] New server/og-assets.ts exports `readProjectPng(staticRoot: string, slug: string, assetPath: string, maxBytes: number): { bytes: Buffer; width: number; height: number } | null` that resolves the path under staticRoot, returns null if the resolved path escapes `<staticRoot>/projects/<slug>/`, the file is missing, larger than maxBytes, or does not start with the PNG signature; width/height come from the IHDR chunk.
- [ ] server/og-meta.ts `OgProject` gains optional `icon` and `shareImage`, populated by `loadOgProjects` from each entry's `listing`; `OgContext` gains optional `staticRoot`.
- [ ] server/og-routes.ts `/og/:file`: when the project has `shareImage`, `ctx.staticRoot` is set, and `readProjectPng(..., 5 MB)` returns exactly 1200x630, the route replies with those bytes as image/png (same cache-control); otherwise it renders the generated card as today and logs one warn line naming the slug and reason.
- [ ] server/index.ts passes the static root it already serves (`distPath`) as `staticRoot` in the `registerOgRoutes` context.
- [ ] tests/og-routes.test.ts (using a temp dir as staticRoot with fixture PNGs written in the test) covers: valid 1200x630 shareImage is served byte-for-byte; wrong dimensions, non-PNG bytes, missing file and a `../` traversal attempt each fall back to the generated card with 200.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/og-assets.ts
- server/og-meta.ts
- server/og-routes.ts
- server/index.ts
- tests/og-routes.test.ts

# Implementation notes

Read first: server/og-routes.ts (whole); server/og-meta.ts lines 1-110; server/index.ts lines 95-110 and 215-240 (distPath, registerOgRoutes call); tests/og-routes.test.ts lines 1-60.
Steps:
1. Red: tests first. Build fixture PNGs in-test with `new Resvg('<svg width=\"1200\" height=\"630\" .../>').render().asPng()` from @resvg/resvg-js (already a dependency) — no binary fixtures committed.
2. Write server/og-assets.ts (use path.resolve + startsWith(root + sep) check; read only the first 24 bytes for the signature/IHDR before reading the whole file, and stat for size).
3. Extend `OgProject`/`loadOgProjects`/`OgContext` in og-meta.ts.
4. Wire og-routes.ts and server/index.ts. If `distPath` is defined after `registerOgRoutes` is called, pass a value computed the same way.
Security: never follow an https URL; only local files under the project's own folder.
Do not touch: server/og-image.ts (owned by PRD og-card-icon which runs after this one).

# Out of scope

- Icon compositing and cache-busting query (PRD og-card-icon)
- Changing og:image URL format
- JPEG support

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/og-routes.test.ts tests/og-meta.test.ts tests/og-image.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
