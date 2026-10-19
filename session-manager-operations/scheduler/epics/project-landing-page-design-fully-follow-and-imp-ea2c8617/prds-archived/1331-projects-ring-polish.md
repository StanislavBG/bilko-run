---
title: Projects Ring: mobile layout, a11y, reduced motion, ?p= deep link, dead CSS
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-13T21:12:25.964Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
dependsOn: [projects-ring-page]
planId: pl-mv76eacb-9e320f
---
# Goal

behavior: finish the Projects Ring /projects page with the production items the design handoff asks for — aria-live hero, prefers-reduced-motion, `?p=<slug>` deep-link sync — plus a usable narrow-screen layout, and remove the now-dead `.pf-hub-*` row/drawer CSS from portfolio.css.

# Acceptance criteria

- [ ] src/pages/ProjectsPage.tsx: the hero content wrapper has aria-live="polite"; on mount, `?p=<slug>` selects the matching card (unknown slug → index 0, no error); every active change replaces the URL query with `?p=<active slug>` via react-router's setSearchParams with {replace:true} (no history spam, hash preserved).
- [ ] src/styles/projects-ring.css: under `@media (prefers-reduced-motion: reduce)` spine/tick transitions are 0s and the hero fade-up animation is none.
- [ ] src/styles/projects-ring.css: at max-width 900px the spines are display:none, the hero is static full-width (no absolute positioning, auto height, title clamps down to ~36px), the stage has no fixed height and the page scrolls normally (works with portfolio.css's existing hub-route mobile rules), and the ←/counter/→ controls plus scrubber stay usable.
- [ ] src/styles/portfolio.css: `.pf-hub-*` rules that nothing in src/ references any more are deleted (grep each selector against src/ before deleting; keep body.hub-route rules and anything still used, e.g. MetadataPanel classes if ProjectsPage still uses them).
- [ ] e2e/projects-hub.spec.ts gains: visiting /projects?p=<PUBLIC_CARDS[2].slug> shows counter `003 / N`; after clicking → the URL contains `p=<PUBLIC_CARDS[1].slug>` when starting from 001; at a 390x844 viewport the hero Open button is visible and no .pr-spine is visible. Whole spec passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/ProjectsPage.tsx
- src/styles/projects-ring.css
- src/styles/portfolio.css
- e2e/projects-hub.spec.ts

# Implementation notes

Read first: src/pages/ProjectsPage.tsx and src/styles/projects-ring.css as landed by PRD projects-ring-page (read the landed code first — class names come from there), docs/design/projects-ring/README.md ("Accessibility to add in production", "State"), src/styles/portfolio.css lines ~527-680 (hub section + 900px media block), e2e/projects-hub.spec.ts.

Steps:
1. ProjectsPage.tsx: useSearchParams from react-router-dom. Initialise active from `p` (findIndex on the current cards; -1 → 0). When the admin show-all toggle changes the card list, re-resolve the current slug in the new list (fallback 0). Sync on change with setSearchParams(prev => {prev.set('p', slug); return prev}, {replace:true}). Add aria-live="polite" to the hero content wrapper.
2. projects-ring.css: add the reduced-motion and max-width:900px blocks.
3. portfolio.css: delete dead `.pf-hub-*` rules (rows, heads, rails, caret, badges, drawer, install, list) — verify each with `grep -rn '<class>' src/` first.
4. Extend e2e/projects-hub.spec.ts (page.setViewportSize for the mobile case).
Do not touch: src/data/*, server/, registry, mcp-host-server/, Layout.

# Out of scope

- Autoplay
- New data fields or registry/listing changes
- Header/Layout changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 600 pnpm test
timeout 300 pnpm build
timeout 180 pnpm exec playwright test e2e/projects-hub.spec.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
