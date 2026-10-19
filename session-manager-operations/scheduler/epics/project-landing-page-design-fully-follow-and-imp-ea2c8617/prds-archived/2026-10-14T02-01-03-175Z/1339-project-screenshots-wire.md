---
title: Show the baked landing-page screenshots in the Projects Ring hero
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-14T01:58:59.717Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
dependsOn: [project-screenshots-capture]
planId: pl-mv7gnqik-e4cc0a
---
# Goal

wire: make every project card's hero on /projects show its captured landing-page screenshot. HubCard.thumbnail falls back to the host-baked src/data/project-screenshots.json (landed by PRD project-screenshots-capture) when the registry entry has no `thumbnail` of its own; the hero already renders card.thumbnail as an <img> (src/pages/ProjectsPage.tsx ~line 312).

# Acceptance criteria

- [ ] src/data/projectsView.ts imports src/data/project-screenshots.json (same `with { type: 'json' }` import style as commit-order.json) and projectCard() sets `thumbnail: p.thumbnail ?? SCREENSHOTS[p.slug]`; a registry-provided thumbnail still wins.
- [ ] src/styles/projects-ring.css: the hero screenshot image is top-anchored (`object-position: top center`) so the landing page's header/hero area is what shows; the striped placeholder remains for cards without an image.
- [ ] tests/projects-view.test.ts adds: every HubCard of type 'project' whose slug is in project-screenshots.json has that thumbnail (unless the registry entry sets its own), and every path in the JSON exists on disk under public/ (fs.existsSync).
- [ ] e2e/projects-hub.spec.ts adds: on /projects the hero `.pr-shot img` is visible and its naturalWidth > 0 for PUBLIC_CARDS[0]; the whole spec passes.
- [ ] A local 1440x900 screenshot of /projects saved to /tmp/projects-ring-shots.png (via page.screenshot inside the e2e run) is Read and shows a real landing-page image in the hero; describe it in the final message.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectsView.ts
- src/styles/projects-ring.css
- tests/projects-view.test.ts
- e2e/projects-hub.spec.ts

# Implementation notes

Read first: src/data/projectsView.ts (imports at top, projectCard ~lines 92-125), src/data/project-screenshots.json and public/project-shots/ (as landed by project-screenshots-capture — read the landed files first), src/pages/ProjectsPage.tsx lines 305-320 (hero img), src/styles/projects-ring.css (`.pr-shot img` rule), e2e/projects-hub.spec.ts.

Before starting: `git fetch origin`; work on top of current HEAD; never rewrite history.

Steps:
1. Tests first (unit + e2e additions).
2. projectsView.ts: add the JSON import + fallback.
3. projects-ring.css: add `object-position: top center;` to the existing `.pr-page .pr-shot img` / `.pr-shot img` rule (keep selector specificity consistent with that file).
4. Run gate; take/inspect the screenshot.
Do not touch: src/data/standalone-projects.json, the capture script, the images, src/pages/ProjectsPage.tsx (no change needed — if one truly is, keep it to the img element and say why).

# Out of scope

- Re-capturing screenshots
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
