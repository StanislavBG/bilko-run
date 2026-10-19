---
title: /projects: admin-only metadata panel in each expanded row
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-13T03:50:32.590Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [listing-marketing-fields, projects-row-open-button]
planId: pl-mv653d38-529056
---
# Goal

behavior: when the admin (Clerk email in ADMIN_EMAILS) expands a row on /projects, show a "Metadata" panel listing every registry field for that project, so the owner can inspect exactly what siblings published and what Burrow will read — and see at a glance which marketing fields are still empty. Public visitors never see the panel.

# Acceptance criteria

- [ ] New src/data/projectMetadata.ts exports `projectMetadataRows(p: Project): Array<{ key: string; value: string; missing: boolean }>` covering slug, name, displayName, tagline, category, status, year, launchedAt, public, tags, host.kind, host.path or host.url, host.sourceRepo, host.localPath, thumbnail, and every listing key (detail, metric, metricLabel, lang, audience, talkingPoints, offering, pricing, callToAction, avoidClaims); arrays join with ' · ' (talkingPoints/avoidClaims one per line with newline), absent values are `''` with `missing: true`.
- [ ] tests/projects-view.test.ts has a test that, for the git-viewer entry from PROJECTS, `projectMetadataRows` returns a row for every key in `ListingSchema.keyof().options` (import from mcp-host-server/src/contract/registry.ts) prefixed `listing.`, and that `listing.offering` is marked missing when absent.
- [ ] src/pages/ProjectsPage.tsx: `HubRow` receives `isAdmin`; when `isAdmin && expanded && card.type === 'project'` it renders a `<dl className="pf-hub-meta">` with the rows (missing values shown as a dimmed '— not set'); non-admins get no panel and no extra DOM.
- [ ] src/styles/portfolio.css adds `.pf-hub-meta` rules: two-column key/value grid, monospace keys, wraps long values, readable in the page's existing palette, collapses to one column at the existing mobile breakpoint.
- [ ] Existing e2e/projects-hub.spec.ts still passes (anonymous visitor sees no `.pf-hub-meta`); add one assertion for that.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectMetadata.ts
- src/pages/ProjectsPage.tsx
- src/styles/portfolio.css
- tests/projects-view.test.ts
- e2e/projects-hub.spec.ts

# Implementation notes

Read first: src/pages/ProjectsPage.tsx (whole — note the header/Open button restructure landed by PRD projects-row-open-button); src/data/projectsRegistry.ts (Project type, PROJECTS); mcp-host-server/src/contract/registry.ts `ListingSchema` (new fields landed by PRD listing-marketing-fields); tests/projects-view.test.ts (style).
Steps:
1. Red: add the test to tests/projects-view.test.ts.
2. Create src/data/projectMetadata.ts with `projectMetadataRows`. Iterate listing keys via `ListingSchema.keyof().options` so a future listing field appears automatically. Import type `Project` and `PROJECTS` from './projectsRegistry.js'.
3. ProjectsPage.tsx: pass `isAdmin` to `HubRow`; look up the entry with `PROJECTS.find(p => p.slug === card.slug)`; render the `<dl>` below `.pf-hub-detail-col`/`.pf-hub-actions` inside `.pf-hub-body`, headed "Metadata · admin".
4. CSS per AC. Note: the registry JSON is already in the public client bundle, so showing it to the admin leaks nothing new; keep the panel admin-gated anyway because it is noise for visitors.
Do not touch: src/data/projectsView.ts, src/data/projectCatalog.ts.

# Out of scope

- Editing metadata from the panel (read-only)
- Package-only cards
- A separate detail route/page

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/projects-view.test.ts
timeout 300 pnpm typecheck
timeout 300 pnpm exec vite build
CI=1 timeout 180 pnpm exec playwright test e2e/projects-hub.spec.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
