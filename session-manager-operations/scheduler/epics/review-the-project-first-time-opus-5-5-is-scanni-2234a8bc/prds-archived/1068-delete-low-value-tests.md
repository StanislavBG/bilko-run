---
title: Delete low-value tests (prose greps, sibling-app specs, prod-network smoke, done-migration checks)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-04T08:57:02.318Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
disposition: new-head
planId: pl-mutl7iwe-8bddcf
---
# Goal

migration: delete test files that guard no host behavior. They break on harmless rewording and slow agents down. They grep skill prose, test sibling-app UI that belongs in the sibling repo, hit production bilko.run, never run at all, or check a finished migration or a generated-data snapshot.

# Acceptance criteria

- [ ] Deleted: tests/academy-nav.test.ts, tests/academy-retired.test.ts, tests/commit-counts.test.ts, tests/projects-order.test.ts (done-migration and generated-data shape checks)
- [ ] Deleted: tests/blog-spotlight-mode.test.ts and tests/blog-editorial-focus-not-content.test.ts (they only grep .claude/skills/blog-from-git prose)
- [ ] Deleted: tests/smoke-fizzpop.spec.ts and tests/games-prod-smoke.spec.ts (matched by neither vitest nor playwright, and hit production) and e2e/local-score.spec.ts (sibling Local-Score UI flow), plus any e2e/fixtures/ file that only local-score.spec.ts used
- [ ] No remaining file imports a deleted file, and the full vitest suite passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- tests/academy-nav.test.ts
- tests/academy-retired.test.ts
- tests/commit-counts.test.ts
- tests/projects-order.test.ts
- tests/blog-spotlight-mode.test.ts
- tests/blog-editorial-focus-not-content.test.ts
- tests/smoke-fizzpop.spec.ts
- tests/games-prod-smoke.spec.ts
- e2e/local-score.spec.ts
- e2e/fixtures/

# Implementation notes

Read first: playwright.config.ts (testDir); vitest.config.ts (include: tests/**/*.test.ts); e2e/fixtures/ listing.

Steps:
1. Before each delete, open the file and confirm it matches the description in the criteria. If a file contains a behavioral test of host code (it calls a host function or starts the server, rather than reading prose or JSON), keep that file and name it in your report instead of deleting it.
2. git rm the files. For e2e/fixtures, grep each fixture's name across e2e/ and tests/ and delete only fixtures that are now unreferenced.
3. Run the full suite once (the gate).

Do not touch: tests/blog-plain-language.test.ts, tests/blog-cadence-watchdog.test.ts, tests/auth.test.ts, tests/games-page.test.ts (other PRDs or a later decision own them).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 600 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
