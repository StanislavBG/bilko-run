---
title: Repo hygiene: dead scripts, unused deps, committed QA reports, stale package metadata
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-04T08:56:28.843Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
disposition: new-head
planId: pl-mutl6t2j-43252d
---
# Goal

migration: remove dead configuration and junk that misleads agents working in this repo, and make `pnpm typecheck` cover the server as well as the client. Today `pnpm typecheck` checks only the client, so server type errors surface only at Render build time.

# Acceptance criteria

- [ ] package.json: scripts stats, stats:week, metrics, metrics:save, metrics:history, metrics:csv, github-traffic and prepublishOnly are removed (their target files scripts/npm-stats.js, scripts/metrics.js and scripts/github-traffic.js do not exist); `files` no longer lists CONTRIBUTING.md; description and keywords describe the bilko.run host platform rather than page-roast/CRO
- [ ] package.json `typecheck` script runs `tsc --noEmit && tsc -p tsconfig.server.json --noEmit`
- [ ] The `ajv` dependency is removed from package.json and pnpm-lock.yaml (it has zero imports)
- [ ] vitest.config.ts coverage.include no longer lists bin/**/*.js
- [ ] test-results/ files are untracked with `git rm -r --cached test-results` and scripts/sanity-qa-cron.sh no longer runs `git add -f` on the QA report (reports stay on local disk only)
- [ ] src/hooks/useOgMeta.ts is deleted (no importers), and scripts/seed-rivals.ts and scripts/smoke-signal-builder-tile.sh are deleted if a repo-wide grep (excluding node_modules) still shows no references

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- package.json
- pnpm-lock.yaml
- vitest.config.ts
- test-results/
- scripts/sanity-qa-cron.sh
- src/hooks/useOgMeta.ts
- scripts/seed-rivals.ts
- scripts/smoke-signal-builder-tile.sh

# Implementation notes

Read first: package.json; vitest.config.ts; scripts/sanity-qa-cron.sh lines 60-90 (the force-add of $REPORT_FILE around line 78; keep the commit-order.json add at line 80 as is); .gitignore (test-results/ is already ignored).

Steps:
1. Edit package.json as in the criteria. Remove ajv with `pnpm remove ajv` so the lockfile updates consistently. If that needs network and fails, edit package.json and run `pnpm install --lockfile-only`.
2. vitest.config.ts: drop 'bin/**/*.js' from coverage.include. Leave CONTENTGRADE_DB_PATH alone: server code reads that name.
3. Untrack test-results/. In sanity-qa-cron.sh remove only the `git add -f "$REPORT_FILE"` line and its comment. If the commit step then commits nothing but commit-order.json, that is intended.
4. Before deleting each file in the last criterion, run `grep -rn <basename> --exclude-dir=node_modules .`.
5. Run `pnpm typecheck` with the new script. If the server half shows errors, fix only trivial ones; otherwise report them and keep the script change.

Do not touch: tsconfig.json, tsconfig.server.json (another PRD changes compiler flags).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm vitest run tests/sanity-qa.test.ts tests/db.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
