---
title: Delete the workflows data pipeline (view model, baked JSON, refresh scripts, tests, cron step)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-10T16:33:10.045Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
agentType: dev-lead
dependsOn: [remove-workflows-page]
planId: pl-mv2m49us-ae38eb
---
# Goal

migration: With the /workflows page gone (PRD remove-workflows-page landed first), its whole data pipeline is dead. Delete the view model, the baked JSON, the crontab-scraping refresh scripts and their test, and remove the refresh step from the nightly sanity-QA cron so it no longer regenerates or stages workflows.json.

# Acceptance criteria

- [ ] These files are deleted with git rm: src/data/workflowsView.ts, src/data/workflows.json, scripts/refresh-workflows.ts, scripts/workflows-allowlist.ts, scripts/lib/workflows.ts, tests/workflows.test.ts.
- [ ] scripts/sanity-qa-cron.sh no longer runs `scripts/refresh-workflows.ts` (the comment + command near lines 29-31 are removed) and its `git add` line stages only src/data/commit-order.json and src/data/commit-counts.json; `bash -n scripts/sanity-qa-cron.sh` passes.
- [ ] `git grep -n -i -E 'workflowsView|workflows\.json|refresh-workflows|workflows-allowlist|lib/workflows' -- src server scripts tests shared` returns no matches.
- [ ] `pnpm typecheck` and `pnpm test` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/workflowsView.ts
- src/data/workflows.json
- scripts/refresh-workflows.ts
- scripts/workflows-allowlist.ts
- scripts/lib/workflows.ts
- tests/workflows.test.ts
- scripts/sanity-qa-cron.sh

# Implementation notes

Read first: the landed commit of PRD remove-workflows-page (`git log --oneline -5`) to confirm src/pages/WorkflowsPage.tsx is already gone; scripts/sanity-qa-cron.sh lines 20-35 and 75-90; scripts/lib/ directory listing (if scripts/lib/ has other files keep them; only workflows.ts goes).
Steps:
1. git rm the six files listed in the criteria.
2. scripts/sanity-qa-cron.sh: delete the `# Same for /workflows...` comment and the `pnpm exec tsx scripts/refresh-workflows.ts ...` line; drop `src/data/workflows.json` from the `git add` line.
3. Run the negative grep from the criteria (it must print nothing), `bash -n scripts/sanity-qa-cron.sh`, then the gate.
Do not touch: src/App.tsx, src/styles/, packages/host-kit/, docs/archive/ (historical, leave as is).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 bash -n scripts/sanity-qa-cron.sh
timeout 300 pnpm typecheck
timeout 300 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
