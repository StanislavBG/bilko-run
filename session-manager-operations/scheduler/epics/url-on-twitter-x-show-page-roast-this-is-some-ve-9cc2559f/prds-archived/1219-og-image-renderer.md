---
title: Social-card image renderer: 1200x630 PNG per project, generated from registry text
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T21:50:14.625Z
sourcePromptId: url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f
agentType: dev-lead
disposition: new-head
planId: pl-mv2xgzfl-90d6af
---
# Goal

primitive: add server/og-image.ts, which renders a branded 1200x630 PNG social card from text (project name, tagline, category, URL label) using @resvg/resvg-js and a bundled font. The current public/og-bilko.png is literally a PageRoast card, so every link shared on X shows PageRoast; cards rendered from the registry at request time are always current, including for projects registered later via the bilko-host MCP.

# Acceptance criteria

- [ ] package.json dependencies gain @resvg/resvg-js (runtime dependency, not devDependency) and pnpm-lock.yaml is updated by pnpm install.
- [ ] An OFL/permissive-licensed TTF (regular + bold) lives under server/assets/fonts/ with its LICENSE file alongside.
- [ ] server/og-image.ts exports `renderOgCard(input: { title: string; tagline: string; category?: string; urlLabel: string }): Buffer` returning a PNG (first 8 bytes are the PNG signature) of exactly 1200x630, using only the bundled font files (loadSystemFonts: false) so output is identical on Render.
- [ ] Text is XML-escaped before entering the SVG template; the title wraps or shrinks to fit within 1100px and the tagline wraps to at most 3 lines and is truncated with an ellipsis beyond that; visual style matches the existing brand: background #1a1613, accent #ff6b1a, warm grey text, 'bilko.run' wordmark.
- [ ] renderOgCard memoizes by input (a Map capped at 200 entries) so repeated requests do not re-render.
- [ ] tests/og-image.test.ts asserts PNG signature and 1200x630 dimensions (read IHDR width/height bytes 16-23), that a tagline containing <script>&" renders without throwing, that a 400-char tagline still renders, and that two identical calls return the same Buffer instance.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/og-image.ts
- tests/og-image.test.ts
- server/assets/fonts/
- package.json
- pnpm-lock.yaml

# Implementation notes

Read first: public/og-bilko.svg (current brand SVG template — reuse its colors/layout ideas, but do NOT list tool names); package.json (dependencies block); server/static-cache.ts lines 1-40 (module style).

Steps:
1. `pnpm add @resvg/resvg-js` at repo root (not a workspace package).
2. Font: prefer Inter static TTFs (OFL). If not obtainable offline, copy /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf and DejaVuSans-Bold.ttf (Bitstream Vera/DejaVu license) and write server/assets/fonts/LICENSE with the license text. Keep total font size under 2 MB.
3. server/og-image.ts: resolve the fonts dir from candidates [resolve(process.cwd(),'server/assets/fonts'), resolve(dirname(fileURLToPath(import.meta.url)),'assets/fonts'), resolve(dirname(fileURLToPath(import.meta.url)),'../../server/assets/fonts')] — the compiled server runs from dist-server/server/, so the first/last candidate is what works in prod. Build an SVG string (simple word-wrap by approximate char width), render with `new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily }, fitTo: { mode: 'original' } }).render().asPng()`.
4. Layout: small uppercase category label top-left in accent, large title, tagline below, footer with 'bilko.run' wordmark and the urlLabel (e.g. 'bilko.run/projects/page-roast').
5. tests/og-image.test.ts (vitest).

Do not touch: server/index.ts, server/og-meta.ts, index.html, public/ (sibling PRDs own them).

# Out of scope

- HTTP route for the image (PRD og-wire-routes)
- Per-project custom artwork or screenshots

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/og-image.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
