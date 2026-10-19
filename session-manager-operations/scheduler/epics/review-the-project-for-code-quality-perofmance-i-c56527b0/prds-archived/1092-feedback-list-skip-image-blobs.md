---
title: Project feedback: stop reading 2 MB image blobs when the caller asked for no images
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T19:45:11.297Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1dkb5t-fa224e
---
# Goal

behavior. server/routes/project-feedback.ts (~lines 248-267) lists feedback with `SELECT *`, pulling `image_data` (up to 2 MB per row, up to 1,000 rows) from the database even when the request says `images=none`. Select only the columns needed and compute image presence/size in SQL when images are not requested.

# Acceptance criteria

- [ ] When images are not requested, the list query(s) name their columns explicitly and do not select `image_data`; image presence/size comes from `length(image_data)` (or `image_data IS NOT NULL`) in SQL.
- [ ] The JSON response for every mode is byte-for-byte the same shape as before (same keys, same values) — proven by a test that inserts one row with an image and one without and compares the response for images=none against the expected object.
- [ ] tests/project-feedback.test.ts stays green and includes the new case.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/project-feedback.ts
- tests/project-feedback.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. All SQL stays parameterized via the db helpers.

Read first: server/routes/project-feedback.ts lines 200-300; tests/project-feedback.test.ts (setup); the project_feedback CREATE TABLE in server/db.ts (read only).

Do not touch: server/db.ts, other routes.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/project-feedback.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
