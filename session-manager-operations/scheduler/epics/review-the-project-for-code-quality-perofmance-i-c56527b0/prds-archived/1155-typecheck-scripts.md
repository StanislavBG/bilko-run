---
title: Typecheck the scripts too: maintenance scripts get the same type safety as the app
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:16:20.373Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [blog-pipeline-seed-path]
planId: pl-mv1kpii1-1d18b9
---
# Goal

behavior. `pnpm typecheck` covers src/ and server/ but not scripts/: blog cadence gate, readability checker, sanity QA, cost and synthetic monitors, workflow refresh. These cron/watchdog scripts run unattended, so a type error ships silently. Add a scripts tsconfig and include it in `pnpm typecheck` (and so CI). Fix any real type errors found, with minimal edits.

# Acceptance criteria

- [ ] New tsconfig.scripts.json (noEmit, same strictness as tsconfig.server.json) includes scripts/**/*.ts except scripts/project-pages/ (vendored Session Manager tooling) and any file that cannot be typed without large changes (list exclusions with reasons in the report).
- [ ] package.json `typecheck` runs all three: client, server, scripts.
- [ ] Any type errors in included scripts are fixed with minimal edits (no behavior change); the report lists each file changed and why.
- [ ] `pnpm typecheck` and full `pnpm test` green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- tsconfig.scripts.json
- package.json
- scripts/blog-cadence-gate.ts
- scripts/blog-readability.ts
- scripts/cost-monitor.ts
- scripts/synthetic-monitor.ts
- scripts/sanity-qa.ts
- scripts/refresh-commit-order.ts
- scripts/refresh-workflows.ts
- scripts/workflows-allowlist.ts
- scripts/lib/
- scripts/sanity-qa-runners/

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: tsconfig.server.json; package.json scripts; `ls scripts scripts/lib scripts/sanity-qa-runners`. Do not touch: scripts/*.sh, scripts/project-pages/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 400 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
