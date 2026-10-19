---
title: Platform cleanup: remove the unused PageRoast social-roast API from the host
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-09T19:46:08.708Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1dljgk-fcdaa4
---
# Goal

migration. server/routes/social.ts + server/services/social-roast.ts (an admin-only PageRoast 'rival roast' generator, registered at server/index.ts ~line 121) is app-specific code that is not on CLAUDE.md's sanctioned list, has no caller in src/ or any sibling repo, and was last touched 2026-04-01. Remove it. Also make the shared SSRF-guarded fetcher's user agent generic.

# Acceptance criteria

- [ ] server/routes/social.ts and server/services/social-roast.ts are deleted; server/index.ts no longer imports or registers them.
- [ ] Before deleting, `git grep -n -e api/social -e social-roast -e registerSocialRoutes` is run; the report lists every hit and confirms none is a live caller (tests importing them are deleted or updated).
- [ ] DB tables used by social-roast are NOT dropped (no schema change in server/db.ts).
- [ ] server/services/page-fetch.ts user agent changes from `PageRoast/1.0` to a generic `BilkoBot/1.0 (+https://bilko.run)`; tests/page-fetch.test.ts stays green.
- [ ] Full `pnpm test` and `pnpm typecheck` are green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/social.ts
- server/services/social-roast.ts
- server/index.ts
- server/services/page-fetch.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko.

Read first: server/routes/social.ts; server/services/social-roast.ts (which tables/helpers it uses — keep any helper another file imports); server/index.ts lines 1-40 and 110-140; server/services/page-fetch.ts lines 15-35.

Do not touch: server/db.ts, server/routes/tools/page-roast.ts, any OG/static code in server/index.ts (a later PRD edits it).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 400 pnpm vitest run
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
