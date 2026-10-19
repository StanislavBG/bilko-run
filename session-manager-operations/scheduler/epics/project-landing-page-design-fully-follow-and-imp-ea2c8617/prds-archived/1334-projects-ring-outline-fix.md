---
title: Projects Ring: restore spine/button outlines killed by the .portfolio-shell button reset
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T23:13:25.197Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
disposition: new-head
planId: pl-mv7ari6l-84023b
---
# Goal

bug: on live bilko.run/projects the side spines have no border or fill (just floating text), and the ←/→ nav and Full story / Open buttons lose their borders/fills. Root cause: src/styles/portfolio.css:39 `.portfolio-shell button { background: none; border: 0; padding: 0; ... }` (specificity 0,1,1) beats the ring's single-class rules `.pr-spine`, `.pr-nav`, `.pr-btn`, `.pr-btn-primary` (0,1,0). Raise the ring's button selectors so the design (docs/design/projects-ring/README.md) renders as specified.

# Acceptance criteria

- [ ] src/styles/projects-ring.css: every rule that styles a <button> on the ring page (`.pr-spine`, `.pr-spine:hover`, `.pr-nav`, `.pr-nav:hover`, `.pr-btn`, `.pr-btn:hover`, `.pr-btn-primary`, `.pr-btn-primary:hover`, `.pr-tick`, `.pr-tick:hover`, the admin toggle if it is a button with pr- styling, and the max-width:900px / reduced-motion overrides of those) is prefixed with `.pr-page ` so it outranks `.portfolio-shell button`; no `!important` added; src/styles/portfolio.css is NOT changed.
- [ ] On /projects at 1440x900 a visible `.pr-spine` has computed border-top-width 1px, border-top-color rgb(42, 36, 28) and background-color rgb(237, 230, 214); `.pr-nav` has a 1px border; the hero `Open →` button (.pr-btn-primary) has background-color rgb(26, 22, 18) and the `Full story` button a 1px border.
- [ ] e2e/projects-hub.spec.ts gains one test asserting the computed styles in the previous criterion via locator.evaluate(getComputedStyle); the whole spec passes.
- [ ] A screenshot of local /projects at 1440x900 (pnpm exec playwright screenshot against the dev server on :3002, saved to /tmp/projects-ring-outlines.png) is Read and shows outlined, filled spines on both sides of the hero; say what it shows in the final message.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/styles/projects-ring.css
- e2e/projects-hub.spec.ts

# Implementation notes

Read first: src/styles/projects-ring.css (whole file, ~95 lines), src/styles/portfolio.css lines 30-45 (the `.portfolio-shell button` reset — do not edit it, other pages rely on it), src/pages/ProjectsPage.tsx lines 240-360 (which elements are <button>), e2e/projects-hub.spec.ts.

Before starting: local main may have diverged from origin (rebased duplicates). Run `git fetch origin` and work on top of the current HEAD; do not rewrite history.

Steps:
1. In projects-ring.css prefix the button-styling selectors with `.pr-page ` (e.g. `.pr-page .pr-spine { ... }`, `.pr-page .pr-spine:hover { ... }`). Keep declarations identical. Do the same for the selectors inside the @media blocks that override those buttons so their precedence order is preserved.
2. Add the computed-style e2e test (use page.setViewportSize({width:1440,height:900}); pick `.pr-spine` elements whose inline opacity is > 0).
3. Run the gate, then take and inspect the screenshot (the playwright webServer config starts `pnpm dev` on :3002 for the e2e; for the screenshot start it bounded, e.g. `timeout 60 pnpm dev` in the same command flow, or reuse the e2e run's server via a Playwright test that calls page.screenshot — prefer the latter, saving to /tmp, and do not commit the image).
Do not touch: src/data/projectsRing.ts, src/pages/ProjectsPage.tsx, tests/projects-ring.test.ts (a sibling PRD owns them).

# Out of scope

- Spine width/fill geometry (sibling PRD projects-ring-fill-space)
- Editing portfolio.css or the global reset

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm build
timeout 180 pnpm exec playwright test e2e/projects-hub.spec.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
