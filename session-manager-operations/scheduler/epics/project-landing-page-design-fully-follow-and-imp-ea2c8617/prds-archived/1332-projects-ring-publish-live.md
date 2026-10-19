---
title: Publish Projects Ring: push to origin main and verify live on bilko.run
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-13T21:13:01.713Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
dependsOn: [projects-ring-polish]
planId: pl-mv76eacb-9e320f
---
# Goal

wire: publish the finished Projects Ring /projects redesign by pushing main to origin (StanislavBG/bilko-run; Render auto-deploys from it) and prove the new page is live on https://bilko.run/projects, using a small reusable bounded live-bundle check script.

# Acceptance criteria

- [ ] New scripts/verify-live-marker.ts (run via `pnpm exec tsx scripts/verify-live-marker.ts <marker> [--tries N] [--interval S]`, defaults 20 tries / 30s): fetches https://bilko.run/ with a 15s timeout per request, extracts every `/assets/*.js` and `/assets/*.css` URL from the HTML, fetches them, exits 0 printing the matching asset when any contains <marker>, else retries and finally exits 1 with a diagnostic line. Typechecks under tsconfig.scripts.json.
- [ ] Before writing the script: `git log origin/main..HEAD --oneline` shows the projects-ring commits, then `git push origin main` succeeds (never push to the content-grade remote). If the push is rejected, `git pull --rebase origin main` once and push again; any other failure → FAIL.
- [ ] `pnpm exec tsx scripts/verify-live-marker.ts pr-stage` exits 0 against production after the deploy.
- [ ] A live screenshot of https://bilko.run/projects at 1440x900 and at 390x844 is taken with `pnpm exec playwright screenshot` into /tmp and inspected: the desktop shot shows the centered hero window with spines on both sides and the tick scrubber; the mobile shot shows the stacked hero with no spines. Report what each shows (paths + one line each) in the final message.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/verify-live-marker.ts

# Implementation notes

Read first: CLAUDE.md "Rules" (push to origin = StanislavBG/bilko-run main only), tsconfig.scripts.json, scripts/synthetic-monitor.ts (existing fetch style for a script), src/styles/projects-ring.css (confirm the `pr-stage` class name actually exists in the landed code; if the landed class differs, use that name everywhere instead and say so).

Steps:
1. `git status` must show no unrelated staged changes (the tree has many pre-existing modified public/outdoor-hours/hourly/*.json files — never stage or commit them). `git push origin main`.
2. Write scripts/verify-live-marker.ts (Node 20 global fetch + AbortSignal.timeout(15000); bounded loop; no shell). Render deploys usually take 3-8 minutes, so the default 20x30s budget covers it.
3. Run the gate command; then take both screenshots (`pnpm exec playwright screenshot --viewport-size=1440,900 https://bilko.run/projects /tmp/projects-ring-desktop.png`, and 390,844 for mobile — add `--wait-for-timeout=3000`) and Read them to inspect.
4. The finish protocol commits the new script; it rides along with the next push (no second deploy needed for a script).
Do not touch: anything under src/, server/, public/, the registry.

# Out of scope

- Any UI fix — if live is broken, FAIL with the reason; a fix wave is planned separately
- Pushing to the content-grade remote

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm exec tsc -p tsconfig.scripts.json --noEmit
timeout 900 pnpm exec tsx scripts/verify-live-marker.ts pr-stage
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
