---
title: Capture a landing-page screenshot for every project (one-shot script + committed images)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-14T01:58:27.068Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
disposition: new-head
planId: pl-mv7gnqik-e4cc0a
---
# Goal

primitive: the /projects Projects Ring hero shows a striped SCREENSHOT placeholder for every project because no registry entry has a `thumbnail`. Add a re-runnable script that screenshots each project's live landing page once and bakes the result into the repo (images under public/project-shots/ plus a slug→path JSON sidecar, the same baked-sidecar pattern as scripts/refresh-commit-order.ts → src/data/commit-order.json). Run it once and commit the output. A follow-up PRD wires the JSON into the hero.

# Acceptance criteria

- [ ] New scripts/capture-project-screenshots.ts (run: `pnpm exec tsx scripts/capture-project-screenshots.ts [--only slug,slug]`) iterates PROJECTS from src/data/projectsRegistry.ts, skips status 'postponed' and any href on github.com or npmjs.com, resolves the URL with projectHref() (relative paths prefixed with https://bilko.run), and screenshots each with Playwright chromium (import { chromium } from '@playwright/test') at viewport 1280x800, deviceScaleFactor 1, viewport-only (not full page), JPEG quality 72.
- [ ] Each page is bounded: goto with waitUntil 'load' and a 30s timeout, then a fixed 2500ms settle; a page that errors or times out is logged as `SKIP <slug>: <reason>` and the run continues; the script exits 1 only if zero pages were captured. Output: public/project-shots/<slug>.jpg and src/data/project-screenshots.json mapping slug → '/project-shots/<slug>.jpg' (sorted keys, only captured slugs; with --only it merges into the existing JSON instead of replacing it).
- [ ] The script has been run once against production; public/project-shots/ contains one .jpg per captured project (every public: true project must be present — git-viewer, outdoor-hours, session-manager, academy, social-signals-trader, escape-velocity, launch-kit, family-frame, plus as many non-public ones as succeed), each under 250 KB, and src/data/project-screenshots.json lists exactly those files.
- [ ] Every captured image was opened (Read) and checked: any that is blank, an error page, a 404, or only a sign-in wall is deleted and removed from the JSON (or re-captured with --only after a longer settle); the final message lists each slug with one line on what its screenshot shows, and lists every skipped slug with the reason.
- [ ] Typechecks under `pnpm exec tsc -p tsconfig.scripts.json --noEmit`.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/capture-project-screenshots.ts
- src/data/project-screenshots.json
- public/project-shots/

# Implementation notes

Read first: scripts/refresh-commit-order.ts lines 1-60 (baked-sidecar pattern, ROOT resolution, how it imports registry data), src/data/projectsRegistry.ts (PROJECTS, projectHref; session-manager resolves to the react-route /products/session-manager — screenshot that), tsconfig.scripts.json, playwright.config.ts (chromium is already installed for the e2e suite).

Before starting: local main may have diverged from origin (rebased duplicates). `git fetch origin` and work on top of the current HEAD; never rewrite history.

Steps:
1. Write the script (one browser, one context, sequential pages; close the browser in finally). Total runtime should be ~2-4 min for ~25 pages; wrap the actual run as `timeout 600 pnpm exec tsx scripts/capture-project-screenshots.ts`.
2. Run it, then Read every image and prune per the criterion.
3. Commit the script, src/data/project-screenshots.json and public/project-shots/*.jpg (exact paths). Never stage the pre-existing modified public/outdoor-hours/hourly/*.json or session-manager-operations/ files.
Do not touch: src/data/standalone-projects.json (registry thumbnails are project-owned via the bilko-host MCP — this host-side sidecar is deliberately separate), src/data/projectsView.ts, src/pages/, src/styles/ (next PRD).

# Out of scope

- Wiring screenshots into the UI (next PRD)
- Editing registry `thumbnail` fields
- Scheduling the script on a cron

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm exec tsc -p tsconfig.scripts.json --noEmit
timeout 30 test -s src/data/project-screenshots.json
timeout 30 test -s public/project-shots/git-viewer.jpg
timeout 30 test -s public/project-shots/session-manager.jpg
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
