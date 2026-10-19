---
title: Remove the /workflows page from the bilko.run SPA and redirect it to /projects
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-10T16:32:25.828Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
agentType: dev-lead
disposition: new-head
planId: pl-mv2m49us-ae38eb
---
# Goal

migration: The owner decided bilko.run/workflows adds no value and must go. Delete the WorkflowsPage, its nav/section entry and its CSS, and replace the route with a client redirect to /projects so old links (including already-published sibling bundles) land somewhere useful instead of a 404.

# Acceptance criteria

- [ ] src/pages/WorkflowsPage.tsx is deleted (git rm) and src/App.tsx no longer declares the lazy `WorkflowsPage` import; the `/workflows` route in src/App.tsx is `<Route path="/workflows" element={<Navigate to="/projects" replace />} />`, placed beside the existing /games, /studio, /packages redirects with a one-line comment saying the Workflows page was retired 2026-10-10.
- [ ] src/data/portfolio.ts SECTIONS no longer contains the `id: 'workflows'` entry; HomePage section tiles, Layout nav, mobile menu and CommandPalette therefore show no Workflows entry (they all map SECTIONS).
- [ ] src/components/Layout.tsx `activeSectionPath` no longer has the `/workflows` branch.
- [ ] src/styles/portfolio.css no longer contains any `.pf-wf-` selector (both the `/* ============ Workflows ============ */` block near line 489 and the `/* Workflows: one section per project */` block near line 1010, including its `@media (max-width: 720px)` rules for `.pf-wf-*`); `grep -c 'pf-wf-' src/styles/portfolio.css` prints 0.
- [ ] `pnpm typecheck` and `pnpm test` pass (src/data/workflowsView.ts and tests/workflows.test.ts are intentionally left in place for a follow-up PRD and still compile).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/WorkflowsPage.tsx
- src/App.tsx
- src/data/portfolio.ts
- src/components/Layout.tsx
- src/styles/portfolio.css

# Implementation notes

Read first: src/App.tsx lines 35-50 and 165-210; src/data/portfolio.ts lines 60-80; src/components/Layout.tsx lines 1-20; src/styles/portfolio.css lines 485-525 and 1005-1030.
Steps:
1. `git rm src/pages/WorkflowsPage.tsx`.
2. src/App.tsx: delete the `const WorkflowsPage = lazyWithRetry(...)` line; replace the `/workflows` Route with a `<Navigate to="/projects" replace />` route next to the /packages redirect (move it into that redirect group, comment `{/* /workflows retired 2026-10-10 — fold into the projects hub */}`). `Navigate` is already imported.
3. src/data/portfolio.ts: remove the `{ id: 'workflows', ... }` SECTIONS entry. Check that any `SectionId`-style union type or other reference to 'workflows' in src/ is also removed (`grep -rn "'workflows'" src`). Layout.tsx uses SECTIONS.slice(0,3)/slice(3) for the footer — confirm it still renders sensibly with one fewer section (no code change expected).
4. src/components/Layout.tsx: drop the `/workflows` line in activeSectionPath.
5. src/styles/portfolio.css: delete every rule whose selector is `.pf-wf-*`, and the two Workflows comment headers. Keep non-wf rules that share a media query.
6. Run the gate.
Do not touch: src/data/workflowsView.ts, src/data/workflows.json, scripts/*workflows*, scripts/lib/workflows.ts, tests/workflows.test.ts, scripts/sanity-qa-cron.sh (owned by the sibling PRD remove-workflows-data-pipeline), packages/host-kit/ (owned by host-kit-drop-workflows-section).

# Out of scope

- Deleting workflowsView.ts/workflows.json/scripts/tests (separate PRD)
- Any other nav or design change

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
