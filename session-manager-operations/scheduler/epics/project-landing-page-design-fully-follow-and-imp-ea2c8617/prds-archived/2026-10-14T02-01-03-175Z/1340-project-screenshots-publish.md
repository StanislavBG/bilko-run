---
title: Publish project screenshots: push to origin main and verify live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-14T01:59:15.302Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
dependsOn: [project-screenshots-wire]
planId: pl-mv7gnqik-e4cc0a
---
# Goal

wire: publish the project-screenshot work (project-screenshots-capture, project-screenshots-wire) to bilko.run by pushing main to origin (StanislavBG/bilko-run; Render auto-deploys) and prove the hero shows real screenshots live, using the existing scripts/verify-live-marker.ts.

# Acceptance criteria

- [ ] `git fetch origin` then `git pull --rebase origin main` (local main carries rebased duplicates of already-pushed commits; git drops those as already-applied — resolve any real conflict keeping BOTH sides), then `git push origin main` succeeds. Never force-push; never push to the content-grade remote; never stage the pre-existing modified public/outdoor-hours/hourly/*.json or session-manager-operations/ files.
- [ ] `git log origin/main` contains the project-screenshots-capture and project-screenshots-wire commits and `git status -sb` shows main not ahead of origin/main.
- [ ] `pnpm exec tsx scripts/verify-live-marker.ts /project-shots/` exits 0 against production (the JSON paths are inlined into the JS bundle), and `curl -fsS --max-time 15 -o /dev/null -w '%{http_code} %{content_type}' https://bilko.run/project-shots/git-viewer.jpg` prints `200 image/jpeg`.
- [ ] A live 1440x900 screenshot of https://bilko.run/projects (`pnpm exec playwright screenshot --viewport-size=1440,900 --wait-for-timeout=3000 https://bilko.run/projects /tmp/projects-live-shots.png`) is Read and shows a real landing-page image in the hero; describe it in the final message.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/verify-live-marker.ts

# Implementation notes

Read first: CLAUDE.md "Rules" (push to origin = StanislavBG/bilko-run main only), scripts/verify-live-marker.ts (argv usage).

Steps: rebase + push; run the marker gate (default 20x30s covers a 3-8 min Render deploy); curl the image; take and Read the live screenshot.
This PRD makes no code change; if there is nothing of its own to commit, report PASS with the pushed SHAs.
Do not touch: src/, server/, public/, the registry.

# Out of scope

- Any UI or image fix — if live is wrong, FAIL with the reason

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 900 pnpm exec tsx scripts/verify-live-marker.ts /project-shots/
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
