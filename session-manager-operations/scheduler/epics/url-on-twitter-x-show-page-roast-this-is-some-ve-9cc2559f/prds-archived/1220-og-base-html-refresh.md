---
title: Refresh the stale base share card: index.html copy and remove the PageRoast-image og PNGs
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-10T21:50:27.346Z
sourcePromptId: url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f
agentType: dev-lead
disposition: new-head
planId: pl-mv2xh98y-887554
---
# Goal

migration: the SPA shell index.html still advertises "Bilko — AI Advisory for Small Business" and points og:image/twitter:image at public/og-bilko.png, which is actually a PageRoast card. Update the shell's default metadata to the current studio positioning, point it at the server-rendered https://bilko.run/og/default.png, and delete the legacy PNG/SVG cards so nothing can reference them again.

# Acceptance criteria

- [ ] index.html <title>, meta description, og:title, og:description, twitter:title and twitter:description no longer contain 'AI Advisory' or 'small business'; title is 'bilko.run — Small AI tools, one at a time' and the description is 'A studio of one shipping small AI tools: trading bots that trade in public, a weather report, a live GitHub dashboard, a session scheduler and a free AI academy. Most are free or open source.'
- [ ] index.html og:image and twitter:image are https://bilko.run/og/default.png, and og:image:width 1200 / og:image:height 630 meta tags are present.
- [ ] public/og-bilko.png, public/og-bilko.svg, public/og-pageroast.png and public/og-pageroast.svg are deleted (git rm).
- [ ] No file outside node_modules, public/projects/ and tests/static-cache.test.ts references og-bilko or og-pageroast (tests/static-cache.test.ts only uses 'og-bilko.png' as a self-written fixture filename and stays untouched).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- index.html
- public/og-bilko.png
- public/og-bilko.svg
- public/og-pageroast.png
- public/og-pageroast.svg

# Implementation notes

Read first: index.html lines 1-25; src/pages/HomePage.tsx lines 18-40 (current hero copy, source of the new description).

Steps:
1. Edit index.html head tags as in the criteria; keep og:type, og:url https://bilko.run, twitter:card summary_large_image, twitter:site @BilkoBibitkov.
2. git rm the four public/og-* files.
3. Run `git grep -n -e og-bilko -e og-pageroast` and confirm only tests/static-cache.test.ts matches.

Do not touch: server/ (sibling PRDs own server/og-meta.ts, server/og-image.ts, server/index.ts), tests/static-cache.test.ts.

# Out of scope

- Server-side injection or image rendering
- Homepage visual changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm vitest run tests/static-cache.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
