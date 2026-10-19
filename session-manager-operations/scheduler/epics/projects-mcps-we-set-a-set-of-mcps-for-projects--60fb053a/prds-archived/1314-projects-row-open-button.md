---
title: /projects: always-visible Open button on every collapsed row
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:48:01.061Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
disposition: new-head
planId: pl-mv654sdh-b8383f
---
# Goal

behavior: on https://bilko.run/projects a visitor must currently expand a row before they can reach its "Open" button, which is confusing. Add an "Open" action directly on each collapsed row header so a project opens in one click, while clicking the rest of the row still expands the details drawer.

# Acceptance criteria

- [ ] src/pages/ProjectsPage.tsx `HubRow`: every row whose card has an `href` and `status !== 'postponed'` renders a visible Open button (label `Open →`, or `GitHub →` for `type === 'package'`) in the collapsed header, calling the existing `open()` function; it is NOT nested inside the expand `<button>` (no button-in-button — restructure the header into a wrapper element holding the toggle button and the Open button as siblings).
- [ ] Clicking the header Open button navigates without toggling expansion; clicking elsewhere on the row still toggles `aria-expanded` on the toggle button.
- [ ] The duplicate Open button inside the expanded drawer (`.pf-hub-actions` `.pf-hub-primary`) is removed; npm/github/Web Remote links in the drawer stay.
- [ ] src/styles/portfolio.css styles the new header button (class `pf-hub-open`) so it fits the existing grid at desktop width and stays visible and tappable at the existing mobile breakpoint (~line 652); the header layout does not overflow at 375px width.
- [ ] New e2e/projects-hub.spec.ts: on `/projects`, the first row's `Open` button is visible without expanding; the toggle button reports `aria-expanded=false` before and after hovering it; clicking the row toggle sets `aria-expanded=true`; and the Open button's click navigates to that card's href (assert `page.url()` contains the first public card's href from PUBLIC_CARDS in src/data/projectsView.ts).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/ProjectsPage.tsx
- src/styles/portfolio.css
- e2e/projects-hub.spec.ts

# Implementation notes

Read first: src/pages/ProjectsPage.tsx (whole, 185 lines — `HubRow` lines 39-125); src/styles/portfolio.css lines 560-700 (`.pf-hub-*` rules); e2e/session-manager-landing.spec.ts lines 1-25 for spec style; playwright.config.ts (baseURL :3002, webServer `pnpm dev`).
Steps:
1. In `HubRow`, wrap the header in `<div className="pf-hub-headrow">` containing the existing `<button className="pf-hub-head" ...>` and, after it, `<button className="pf-hub-open" onClick={open} aria-label={`Open ${card.name}`}>`. Keep the `track('hub_open', ...)` call in `open()`.
2. Remove the `.pf-hub-primary` button from `.pf-hub-actions`.
3. CSS: make `.pf-hub-headrow` a flex row; `.pf-hub-head` flex:1; `.pf-hub-open` reuses the visual style of `.pf-hub-primary` (copy its rules) at a compact size. Hover/expanded background rule at ~line 580 must still apply to the head.
4. Update the page lede text in `ProjectsPage` from "Click any row to expand the full story." to "Open any project directly, or click its row for the full story."
5. Static-path hrefs do a full page load (`window.location.href`), so in the e2e wait for `page.waitForURL` with a substring match; static bundles may 404 under `pnpm dev` — assert on the URL, not page content.
Do not touch: src/data/projectsView.ts, src/data/projectCatalog.ts (owned by a concurrent PRD).

# Out of scope

- Admin metadata panel (separate PRD)
- Changing card order, filtering, or the admin Show-all toggle
- Catalog/API changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm exec vite build
CI=1 timeout 180 pnpm exec playwright test e2e/projects-hub.spec.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
