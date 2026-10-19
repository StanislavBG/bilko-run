---
title: Projects Ring hero shows each project's X/OG share card (/og/<slug>.png)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-14T02:01:34.667Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
disposition: new-head
planId: pl-mv7grr9n-107a88
---
# Goal

wire: the /projects Projects Ring hero shows a striped SCREENSHOT placeholder for every project. The owner wants it to show exactly the image X/Twitter shows when a project's link is shared — the host already serves that as `/og/<slug>.png` (server/og-routes.ts: the project's 1200x630 shareImage when it has one, else the generated card), and every project page's og:image/twitter:image points at it. Make every project-type HubCard's image that URL, displayed uncropped.

# Acceptance criteria

- [ ] src/data/projectsView.ts projectCard() sets `thumbnail: `/og/${p.slug}.png`` for every registry project (so the hero image is always the same share card X shows, which already honours the project's own shareImage server-side); packageCard() leaves thumbnail undefined (no /og route for packages → placeholder stays).
- [ ] src/styles/projects-ring.css: the hero image shows the whole 1200x630 card uncropped — `object-fit: contain`, centered, with the `.pr-shot` background behind an image set to the card's own dark tone (#1b1714) so letterboxing blends; the striped placeholder styling is unchanged for cards with no image.
- [ ] vite.config.ts dev server proxies `/og` to http://localhost:4000 (same as the existing `/api` entry) so the image loads under `pnpm dev`; production is unaffected (Fastify serves /og directly).
- [ ] tests/projects-view.test.ts adds: every HubCard of type 'project' has thumbnail === `/og/${slug}.png`; every 'package' card has no thumbnail.
- [ ] e2e/projects-hub.spec.ts adds: on /projects the hero `.pr-shot img` has src ending `/og/<PUBLIC_CARDS[0].slug>.png` and naturalWidth 1200 after load; after clicking → the src changes to PUBLIC_CARDS[1]'s card. Whole spec passes; a page.screenshot to /tmp/projects-ring-og.png at 1440x900 is Read and described in the final message (hero shows the dark share card with the project's title).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectsView.ts
- src/styles/projects-ring.css
- vite.config.ts
- tests/projects-view.test.ts
- e2e/projects-hub.spec.ts

# Implementation notes

Read first: server/og-routes.ts (the /og/:file route — read only, do not change), src/data/projectsView.ts (projectCard ~lines 92-125, packageCard after it), src/pages/ProjectsPage.tsx lines 305-320 (hero already renders `card.thumbnail` as <img alt=name> — no change needed there), src/styles/projects-ring.css (`.pr-shot` ~line 48, `.pr-shot img` ~line 54, mobile `.pr-shot` aspect-ratio ~line 89 — set mobile aspect-ratio to 1200 / 630 so the card fits), vite.config.ts proxy block (~line 36), e2e/projects-hub.spec.ts.

Before starting: local main may have diverged from origin (rebased duplicates). `git fetch origin` and work on top of the current HEAD; never rewrite history.

Steps: tests first; then projectsView.ts; css; vite proxy; run gate; screenshot + Read.
For a card with an image, give `.pr-shot` a modifier class or use `.pr-shot:has(img)` to switch the background to #1b1714 (keep selector specificity consistent with the `.pr-page`-prefixed rules in that file).
Do not touch: server/, src/data/standalone-projects.json (registry thumbnail/shareImage are project-owned), mcp-host-server/, src/pages/ProjectsPage.tsx.

# Out of scope

- Generating or capturing new images
- Changing the OG card renderer or og-meta
- Registry/MCP changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm vitest run tests/projects-view.test.ts tests/projects-ring.test.ts tests/project-catalog.test.ts
timeout 300 pnpm build
timeout 180 pnpm exec playwright test e2e/projects-hub.spec.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
