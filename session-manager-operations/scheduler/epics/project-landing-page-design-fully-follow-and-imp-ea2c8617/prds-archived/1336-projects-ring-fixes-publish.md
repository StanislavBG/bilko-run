---
title: Publish ring outline + fill fixes: push to origin main and verify live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-13T23:16:01.901Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
dependsOn: [projects-ring-outline-fix, projects-ring-fill-space]
planId: pl-mv7ari6l-84023b
---
# Goal

wire: publish the two ring fixes (projects-ring-outline-fix, projects-ring-fill-space) to bilko.run by pushing main to origin (StanislavBG/bilko-run; Render auto-deploys) and prove both are live, using the existing scripts/verify-live-marker.ts.

# Acceptance criteria

- [ ] Local main is reconciled with origin/main without losing either side: `git fetch origin`, then `git pull --rebase origin main` (local has rebased duplicates of already-pushed ring commits; git drops those as already-applied — resolve any remaining conflict in favour of keeping BOTH the origin registry changes and the local ring fixes), then `git push origin main` succeeds. Never push to the content-grade remote; never force-push.
- [ ] `git log origin/main` contains the projects-ring-outline-fix and projects-ring-fill-space commits, and `git status -sb` shows main not ahead of origin/main.
- [ ] `pnpm exec tsx scripts/verify-live-marker.ts '.pr-page .pr-spine'` exits 0 against production after the deploy (the scoped selector only exists in the fixed CSS bundle).
- [ ] Live screenshot of https://bilko.run/projects at 1440x900 (`pnpm exec playwright screenshot --viewport-size=1440,900 --wait-for-timeout=3000 https://bilko.run/projects /tmp/projects-ring-live-fixed.png`) is Read and shows outlined, filled spines on both sides of the hero that reach close to the stage edges; describe it in the final message.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/verify-live-marker.ts

# Implementation notes

Read first: CLAUDE.md "Rules" (push to origin = StanislavBG/bilko-run main only), scripts/verify-live-marker.ts (usage + how it parses argv), src/styles/projects-ring.css (confirm the minified-safe marker: if the build output in dist/assets/*.css writes the selector differently, e.g. without the space, run `pnpm build` and grep dist/assets for `pr-spine` to pick the exact substring present in the fixed bundle and absent from the current live one, and use that instead — say so).

Steps:
1. Never stage the pre-existing modified public/outdoor-hours/hourly/*.json or session-manager-operations/ files. Rebase + push as in criterion 1.
2. Run the verify-live-marker gate (default 20 tries x 30s covers a 3-8 min Render deploy).
3. Take and Read the screenshot.
This PRD makes no code change; if there is nothing of its own to commit, report PASS with the pushed SHAs.
Do not touch: src/, server/, public/, the registry.

# Out of scope

- Any UI fix — if live is wrong, FAIL with the reason

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 900 pnpm exec tsx scripts/verify-live-marker.ts '.pr-page .pr-spine'
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
