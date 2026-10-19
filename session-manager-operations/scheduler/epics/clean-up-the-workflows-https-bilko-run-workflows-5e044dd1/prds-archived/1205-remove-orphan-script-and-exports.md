---
title: Remove the orphaned render-deploy.sh script and four unused exports
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-10T16:36:30.078Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
agentType: dev-lead
disposition: new-head
planId: pl-mv2m9ibi-919832
---
# Goal

migration: Small dead-code sweep. scripts/render-deploy.sh is a manual Render deploy-hook helper that nothing references, because Render now auto-deploys on push to origin/main. Four exports are declared but never used anywhere. Delete them.

# Acceptance criteria

- [ ] scripts/render-deploy.sh is deleted (git rm) after `git grep -n 'render-deploy'` shows no reference outside the file itself and docs/archive/ (if a live doc such as docs/deployment.md mentions it, keep the file and report it instead).
- [ ] `Panel` is removed from src/pages/admin/analytics/parts.tsx (with any imports only it used), `type AskRequest` from shared/academy-models.ts and `type LandingPages` from src/pages/session-manager-landing/copy.ts — each only after `git grep -nw` confirms that name has zero uses outside its own declaration.
- [ ] `pnpm typecheck` and `pnpm test` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/render-deploy.sh
- src/pages/admin/analytics/parts.tsx
- shared/academy-models.ts
- src/pages/session-manager-landing/copy.ts

# Implementation notes

Read first: src/pages/admin/analytics/parts.tsx around line 141; shared/academy-models.ts lines 1-30; src/pages/session-manager-landing/copy.ts around line 350; scripts/render-deploy.sh.
Steps:
1. For each symbol run `git grep -nw <Name> -- src server shared scripts tests packages mcp-host-server/src` and confirm the only hit is its declaration.
2. Delete the symbol, plus imports left unused by the deletion.
3. Run the render-deploy grep, then git rm the script.
4. Run the gate.
Do not touch: server/routes/tools/ (PRD remove-dead-demo-endpoints owns it), src/styles/, src/App.tsx, scripts/sanity-qa-cron.sh.

# Out of scope

- (none)

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
