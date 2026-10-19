---
title: Projects Ring: rebuild /projects as ring + hero + scrubber
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-13T21:11:59.122Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
dependsOn: [projects-ring-math]
planId: pl-mv76eacb-9e320f
---
# Goal

behavior: replace the /projects row list with the high-fidelity "Projects Ring" design — section bar with ←/counter/→, a stage holding a fixed centered hero window and an endless ring of vertical spines, and a tick scrubber — driven by the real PUBLIC_CARDS / HUB_CARDS data and the helpers from src/data/projectsRing.ts. UI only: keep the existing site header (Layout), data sources, admin toggle, tracking and drawer content (moved into a "Full story" view).

# Acceptance criteria

- [ ] src/pages/ProjectsPage.tsx renders section bar (eyebrow `SECTION 02 · PORTFOLIO`, h1 `Projects & Packages.`, `←` button aria-label 'Previous project', counter `.pr-counter` showing `<pad3(active)> / <cards.length>`, `→` button aria-label 'Next project'), a `.pr-stage` with spines (`button.pr-spine`, aria-label `Open <name>`, title = name) and the hero (`.pr-hero`), and a `.pr-scrubber` with one `.pr-tick` per card — geometry, colours and type exactly per docs/design/projects-ring/README.md, using spineGeom/heroBox/tickStyle/ringOffset/ringStats/pad3/RING_DOTS.
- [ ] Navigation: ←/→ buttons and window ArrowLeft/ArrowRight (ignored when focus is in INPUT/TEXTAREA/contentEditable) move ±1 with wrap; clicking a spine or tick makes it active; a non-passive wheel listener on the stage moves ±1 on the dominant axis, throttled 140ms, ignoring |delta|<4, and does nothing when the event target is inside the open Full story panel; a ResizeObserver on the stage drives stage width/height.
- [ ] Hero shows: dot + `<n> · <category chips upper-cased joined by ' · '>` + status badge pushed right (LIVE green #2e5a3e; COOKING accent; others ink-3), screenshot area (card.thumbnail as <img> with alt=name, else the 135° stripe placeholder labelled SCREENSHOT), title, blurb, ringStats footer, `Full story` and `Open →` buttons (Open keeps the old open() behaviour: track('hub_open'), SPA navigate when isInternal else location.href; label `GitHub →` for packages; hidden when no href or status postponed). Hero content is keyed by card slug so the .45s fade-up replays on every change.
- [ ] `Full story` (aria-expanded) swaps the screenshot area for a scrollable `.pr-story` panel containing the old drawer content verbatim in behaviour: detail ?? blurb, tags, install copy button, npm/github links, the session-manager `href="/projects/session-manager/"` Web Remote link, and the admin-only MetadataPanel; it closes when the active card changes. The admin show-all toggle stays in the section bar and resets active to 0 when toggled.
- [ ] Styles live in new src/styles/projects-ring.css (imported from src/index.css), scoped under `.pr-` classes with the design tokens as CSS custom properties; Source Serif 4 + Inter Tight load page-scoped via a <link> injected on mount/removed on unmount (same CSP-safe pattern as usePageFonts in src/pages/session-manager-landing/hooks.ts — copy the pattern, do not import from that folder); dynamic geometry goes in React style props only (no runtime <style> elements). An empty card list renders a plain 'No projects yet.' line instead of the stage.
- [ ] e2e/projects-hub.spec.ts is rewritten for the ring: counter starts at `001 / N`; clicking → shows `002 / N` and ArrowLeft returns to 001; clicking the 3rd tick shows `003 / N`; the hero's Open button navigates to PUBLIC_CARDS[0].href; Full story toggles aria-expanded and shows .pr-story. It passes, as do tests/open-core-positioning.test.ts and pnpm typecheck/build.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/ProjectsPage.tsx
- src/styles/projects-ring.css
- src/index.css
- e2e/projects-hub.spec.ts

# Implementation notes

Read first: docs/design/projects-ring/README.md (whole file) and docs/design/projects-ring/Projects Ring.dc.html (the <x-dc> markup is the pixel spec: every inline style there is the target; the script block is the behaviour spec), src/pages/ProjectsPage.tsx (current page — keep statusMeta, categoryChips, MetadataPanel, open(), copyInstall(), track calls, admin logic, useDocumentTitle, hub-route body class), src/data/projectsRing.ts (helpers landed by PRD projects-ring-math — read the landed code first), src/pages/session-manager-landing/hooks.ts lines 70-110 (usePageFonts pattern).

Steps:
1. ProjectsPage.tsx: replace HubRow + the .pf-hub-list with the ring layout. State: active index, storyOpen, stage {w,h} (initial 1280x560 like the prototype). cards = (isAdmin && showAll ? HUB_CARDS : PUBLIC_CARDS). Render one spine per card keyed by `${type}:${slug}`, positioned with `transform: translate(${x}px,-50%)`, width/height/opacity/pointer-events from spineGeom(ringOffset(i, active, n), w, h); hidden spines get tabIndex -1 + aria-hidden. Dot colour = RING_DOTS[i % 3]. Hero left/width from heroBox(w). Ticks from tickStyle(Math.abs(ringOffset(i, active, n))), title `${pad3(i)} ${name}`.
2. Wire listeners in useEffect with cleanup (keydown on window, wheel on the stage ref with {passive:false}, ResizeObserver on the stage).
3. Fonts: inject one <link rel=stylesheet> to https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap with an id guard, removed on unmount.
4. Create src/styles/projects-ring.css; add `@import "./styles/projects-ring.css";` to src/index.css next to the portfolio.css import. Page container: background #f5f0e6, height fills the existing hub-route shell (keep body.hub-route toggling as today), min-height 720px; static styles (fonts, colours, borders, hover states, transitions `transform .55s cubic-bezier(.6,0,.2,1), width .55s, height .55s, opacity .4s`, fade-up keyframes) go here.
5. Rewrite e2e/projects-hub.spec.ts per the last criterion (playwright config starts `pnpm dev` on :3002 itself).
Do not touch: src/styles/portfolio.css (the next PRD cleans dead .pf-hub-* rules and adds mobile/a11y), src/data/*, server/, the registry, mcp-host-server/. Autoplay is NOT built (default-off prototype prop).

# Out of scope

- Mobile (<900px) layout, prefers-reduced-motion, aria-live, ?p=slug URL sync, dead CSS removal — next PRD
- Changing the site header/Layout
- Registry, listing, MCP or server changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm vitest run tests/open-core-positioning.test.ts tests/projects-ring.test.ts
timeout 300 pnpm build
timeout 180 pnpm exec playwright test e2e/projects-hub.spec.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
