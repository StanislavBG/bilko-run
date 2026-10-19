---
title: Generated share card: composite the project icon and cache-bust og:image
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-13T03:58:47.970Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [og-custom-share-image]
planId: pl-mv653d38-529056
---
# Goal

behavior: projects without a full shareImage but with a `listing.icon` get that icon drawn on their generated 1200x630 X card, so every project's card is visually distinct. Also add a content-version query to the og:image URL so X and other unfurlers refetch after a project changes its image or copy (X caches per image URL for days).

# Acceptance criteria

- [ ] server/og-image.ts `OgCardInput` gains optional `iconPng?: Buffer`; when present `buildSvg` draws it as an `<image>` with a base64 PNG data URI at 160x160, top-right (x=960, y=70), and the render cache key includes a hash of the icon bytes.
- [ ] server/og-routes.ts: when no valid shareImage is served and the project has `icon`, it loads it via `readProjectPng(ctx.staticRoot, slug, icon, 512 * 1024)` and passes it only if square and 128–1024 px; otherwise renders without an icon.
- [ ] server/og-meta.ts project og:image URLs become `https://bilko.run/og/<slug>.png?v=<8 hex>`, where v is a sha1 over the title, tagline, category and the bytes of the icon/shareImage files when readable (computed once per project and memoized); `/og/default.png` and blog images stay unversioned.
- [ ] tests/og-image.test.ts: rendering with an icon yields a different PNG than without, and two different icons yield different PNGs.
- [ ] tests/og-meta.test.ts: a project's og:image matches `/og/<slug>\.png\?v=[0-9a-f]{8}$` and v changes when the tagline changes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/og-image.ts
- server/og-routes.ts
- server/og-meta.ts
- tests/og-image.test.ts
- tests/og-meta.test.ts
- tests/og-routes.test.ts

# Implementation notes

Read first: server/og-image.ts (whole, 148 lines); the landed server/og-assets.ts and server/og-routes.ts from PRD og-custom-share-image; server/og-meta.ts lines 84-110 (`projectMeta`, `resolveOg`); tests/og-image.test.ts and tests/og-meta.test.ts.
Steps:
1. Red: tests first; generate icon PNGs in-test with @resvg/resvg-js.
2. og-image.ts: add iconPng support; the tagline wraps at TEXT_WIDTH 1040 — when an icon is present, shrink the title/tagline wrap width so text never runs under the icon (title area x 80..920).
3. og-routes.ts: icon loading as in AC.
4. og-meta.ts: versioned URL; `resolveOg` needs `ctx.staticRoot` to hash files — when absent, hash only the text fields.
Check existing tests in tests/og-meta.test.ts and tests/og-routes.test.ts that assert exact og:image URLs and update them to the versioned form.

# Out of scope

- Changing card colors or layout beyond making room for the icon
- Icons on /projects rows

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/og-image.test.ts tests/og-meta.test.ts tests/og-routes.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
