---
title: bilko-host MCP: route register/unregister/publish through the clean publish checkout
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-04T08:58:39.783Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [mcp-tool-input-contract, mcp-publish-checkout]
planId: pl-mutl87jt-689df9
---
# Goal

wire: make every mutating bilko-host MCP tool do its file and git work inside withPublishCheckout (mcp-host-server/src/publish-checkout.ts, landed by PRD mcp-publish-checkout) instead of the human's main checkout. Delete the old commitAndPush. Report a failed push as an MCP error, never as success. Publishing agents then stop committing unrelated staged files, pushing from the wrong branch, and reporting phantom successes.

# Acceptance criteria

- [ ] mcp-host-server/src/server.ts no longer defines commitAndPush and never runs `git add`, `git commit` or `git push` against HOST_ROOT; register_static_project, unregister_project and publish_static_project perform registry reads/writes and public/projects changes inside the withPublishCheckout callback root
- [ ] Any withPublishCheckout result with ok:false is returned as an MCP isError result whose text names the failed stage and the git error
- [ ] publish_static_project copies the bundle into `public/projects/<slug>.incoming-<pid>` inside the checkout, then renames the old dir aside, renames the new one into place and removes the old one. A copy failure leaves the previous bundle intact
- [ ] The autoCommit=false path is removed from all three tools' input schemas (publishing always commits and pushes through the checkout), and success text includes the pushed commit sha
- [ ] The status tool reports the publish checkout's HEAD sha and whether it equals origin/main, alongside the existing host-checkout info
- [ ] tests/mcp-publish-request.test.ts and tests/mcp-publish-checkout.test.ts still pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/server.ts

# Implementation notes

Read the landed code first: mcp-host-server/src/publish-checkout.ts (withPublishCheckout, PublishOutcome) and mcp-host-server/src/publish-request.ts (projectDir, parseBypass, parseRegistry).
Read first: mcp-host-server/src/server.ts (whole file, ~560 lines; tools 3-6).

Steps:
1. Change readRegistry/writeRegistry to take a root path argument (the checkout root). list_projects may keep reading HOST_ROOT's registry, but say in its output notes that the authoritative copy is origin/main.
2. publish_static_project: run the gates first, outside the lock, against distPath as today. Only after the gates pass, call withPublishCheckout to copy and commit `public/projects/<slug>`. The requireRegistered check reads the registry inside the checkout callback (fresh origin/main).
3. Keep the manifest upsert and override audit logging as they are (best-effort DB writes).
4. Use `rename` from node:fs/promises for the swap, and `cp(src, dst, { recursive: true })` from node:fs/promises instead of execFile('cp').

Server.ts imports the MCP SDK, which may not be installed in a job worktree, so the gate checks the pure modules' tests. Rebuilding dist/ happens in PRD mcp-dist-rebuild-sync; do not edit mcp-host-server/dist/ here.

Do not touch: mcp-host-server/src/publish-checkout.ts, mcp-host-server/src/publish-request.ts (fix a real bug there only if blocking, and say so), mcp-host-server/dist/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-publish-request.test.ts tests/mcp-publish-checkout.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
