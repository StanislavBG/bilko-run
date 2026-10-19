---
title: Docs: move finished plans and one-app research to docs/archive, rewrite the deploy guide to today's truth
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T19:44:00.609Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1dism9-2d1c5f
---
# Goal

doc. docs/ mixes current contracts with finished migration plans and research for sibling apps, and docs/deployment.md tells readers Render deploys from the Content-Grade repo and to push to both remotes, which is wrong and dangerous (bilko.run deploys only from StanislavBG/bilko-run main; pushing Bilko to content-grade is forbidden). Move historical docs under docs/archive/, delete the never-built CardSpotter plans, and rewrite deployment.md plainly.

# Acceptance criteria

- [ ] `git mv` into docs/archive/ (keeping names/subfolders): migration-plan.md, rollout-plan.md, extractions/, games-redesign-roundup-2026-05-12.md, games-research/, blog-week-of-six-games.md, prd-launchgrader.md, prd-localscore.md, prd-stackaudit.md, academy-research.md, mindswiffer-research.md, sudoku-research.md.
- [ ] docs/card-spotter/ is deleted (CardSpotter was never built and is not in src/data/standalone-projects.json).
- [ ] New docs/archive/README.md (under 15 lines) says in plain English: these files are historical, may mention retired remotes like content-grade, and must not be followed; current docs live one folder up.
- [ ] docs/deployment.md is rewritten (no content-grade/Content-Grade deploy instructions, no 'push to both remotes'): Render auto-deploys from `origin` = StanislavBG/bilko-run branch `main` (source set in the Render dashboard, no render.yaml); build = `pnpm install && pnpm build`, start = `pnpm start` (from package.json; say to confirm in the dashboard); env vars live in the Render dashboard; verify a deploy by comparing https://bilko.run/api/health uptime with the push time; never push Bilko to the content-grade remote.
- [ ] Every tracked markdown file under docs/ (excluding docs/archive/) that linked to a moved path now links to its docs/archive/ location; references in CLAUDE.md, README.md and outside docs/ are left alone and listed in the report (later PRDs fix them).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/archive/
- docs/card-spotter/
- docs/deployment.md
- docs/migration-plan.md
- docs/rollout-plan.md
- docs/extractions/
- docs/games-redesign-roundup-2026-05-12.md
- docs/games-research/
- docs/blog-week-of-six-games.md
- docs/prd-launchgrader.md
- docs/prd-localscore.md
- docs/prd-stackaudit.md
- docs/academy-research.md
- docs/mindswiffer-research.md
- docs/sudoku-research.md
- docs/publishing-contract.md
- docs/telemetry-beacons.md
- docs/project-feedback-api.md
- docs/blog-watchdog.md
- docs/templates/

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Pure docs move/rewrite; no code.

Read first: docs/deployment.md (whole); `ls docs docs/games-research docs/extractions`; package.json scripts (build/start).

Steps:
1. `git mv` each listed path into docs/archive/; `git rm -r docs/card-spotter`.
2. Write docs/archive/README.md.
3. Rewrite docs/deployment.md (keep it under ~80 lines, plain language, short sections: Where it deploys from / What Render runs / Env vars / Checking a deploy / Never do).
4. `git grep -n -e <each moved filename>` and fix links only inside docs/ (not docs/archive/). Report remaining hits elsewhere.

Do not touch: CLAUDE.md, README.md, docs/host-contract.md, docs/secrets-rotation.md, docs/host-internals.md, anything outside docs/.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
