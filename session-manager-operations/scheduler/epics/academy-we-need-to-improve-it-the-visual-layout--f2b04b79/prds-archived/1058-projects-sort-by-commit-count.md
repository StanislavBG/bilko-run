---
title: Order /projects by commit count (hidden) and list Academy publicly
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T22:24:38.695Z
sourcePromptId: academy-we-need-to-improve-it-the-visual-layout--f2b04b79
tag: feature
agentType: dev-lead
dependsOn: [projects-commit-counts-sidecar]
planId: pl-musylw84-f7f8fc
---
# Goal

Type: behavior. Sort the /projects hub by total commit count descending (most-worked-on project first), using src/data/commit-counts.json produced by the landed PRD projects-commit-counts-sidecar, with last-commit date as the tie-breaker. The count is a sort key only and must never be rendered. Also add 'academy' to the public card set, since Academy no longer has its own nav tab and /projects is now its only entry point.

# Acceptance criteria

- [ ] src/data/projectsView.ts imports src/data/commit-counts.json and HUB_CARDS is sorted by commit count desc (missing slug counts as 0), ties broken by lastCommitAt desc; doc comments at the top of the file and above HUB_CARDS describe the new order.
- [ ] PUBLIC_SLUGS in src/data/projectsView.ts includes 'academy', so PUBLIC_CARDS contains the Academy card.
- [ ] No commit count is exposed in the UI: HubCard gets no count field rendered by src/pages/ProjectsPage.tsx; ProjectsPage.tsx's header comment (line ~12, 'ordered most-recently-committed first') is updated to say commit-count order. The 'Last commit' date cell stays as is.
- [ ] New test tests/projects-order.test.ts (vitest) asserts: HUB_CARDS is non-increasing by commit-counts.json value (0 for missing); PUBLIC_CARDS includes slug 'academy'; src/pages/ProjectsPage.tsx text does not reference 'commit-counts' or 'commitCount'. It passes, and tests/open-core-positioning.test.ts still passes.
- [ ] pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectsView.ts
- src/pages/ProjectsPage.tsx
- tests/projects-order.test.ts

# Implementation notes

Work only after projects-commit-counts-sidecar has landed: read src/data/commit-counts.json first (slug → integer).
Read first: src/data/projectsView.ts (whole file; COMMIT_ORDER import pattern `import commitOrder from './commit-order.json' with { type: 'json' };`, PUBLIC_SLUGS ~25-32, HUB_CARDS sort at the bottom); src/pages/ProjectsPage.tsx lines 1-90 (header comment, lastWorkedLabel use at ~42/82); tests/open-core-positioning.test.ts lines 45-60 and 195-205 (it greps projectsView.ts text — keep the session-manager ENRICH entry intact).
Steps:
1. In projectsView.ts add `import commitCounts from './commit-counts.json' with { type: 'json' };`, `const COMMIT_COUNTS = commitCounts as Record<string, number>;`, a `commitCount(slug)` helper returning `COMMIT_COUNTS[slug] ?? 0`, and change the HUB_CARDS sort to `(a, b) => commitCount(b.slug) - commitCount(a.slug) || b.lastCommitAt - a.lastCommitAt`. Do not add the count to HubCard.
2. Add 'academy' to PUBLIC_SLUGS (update the '5 named projects' comment).
3. Update the doc comments in projectsView.ts and ProjectsPage.tsx.
4. Write tests/projects-order.test.ts.
Do not touch: scripts/refresh-commit-order.ts, src/data/commit-counts.json, src/data/commit-order.json, src/data/portfolio.ts, src/App.tsx.

# Out of scope

- Showing commit counts anywhere
- Featured/pinned slots
- Changing which other projects are public

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/projects-order.test.ts tests/open-core-positioning.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
