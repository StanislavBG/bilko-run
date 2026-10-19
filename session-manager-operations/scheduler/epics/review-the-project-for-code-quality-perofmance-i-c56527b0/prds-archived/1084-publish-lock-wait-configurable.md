---
title: Test suite: cut 60s from every run by making the publish-lock wait configurable
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T19:43:26.807Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1di2jb-b0a549
---
# Goal

behavior. tests/mcp-publish-checkout.test.ts takes ~61s of the ~97s full vitest run because its lock-exhaustion test waits out the hardcoded LOCK_WAIT_TIMEOUT_MS = 60_000 in mcp-host-server/src/publish-checkout.ts. Add an optional `lockWaitMs` option (default unchanged at 60_000) so the test can use a short wait, and rebuild the committed dist.

# Acceptance criteria

- [ ] mcp-host-server/src/publish-checkout.ts: the options type gains `lockWaitMs?: number`; `acquireLock` uses `opts.lockWaitMs ?? LOCK_WAIT_TIMEOUT_MS` (60_000) as its deadline; production callers are unchanged.
- [ ] tests/mcp-publish-checkout.test.ts: the 'serializes concurrent callers via the lock' test passes `lockWaitMs: 500` and no longer sets a 70_000 ms test timeout; it still asserts `stage === 'lock'`.
- [ ] A new test in the same file asserts that a lock released by another holder mid-wait is acquired (create the lock dir, remove it after ~200 ms, call with lockWaitMs 2000, expect ok:true).
- [ ] mcp-host-server/dist/ is rebuilt with the package's own build script so tests/mcp-dist-sync.test.ts passes.
- [ ] `pnpm vitest run tests/mcp-publish-checkout.test.ts` completes in under 15 s (report the measured duration before and after).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/publish-checkout.ts
- mcp-host-server/dist/
- tests/mcp-publish-checkout.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko.

Read first: mcp-host-server/src/publish-checkout.ts lines 20-115 (options type at ~26, constants at 41-43, acquireLock at 86-109, call at ~150); tests/mcp-publish-checkout.test.ts lines 1-45 and 205-231; mcp-host-server/package.json (build script); tests/mcp-dist-sync.test.ts (how dist sync is checked).

Steps:
1. Measure: `timeout 200 pnpm vitest run tests/mcp-publish-checkout.test.ts` and note the duration.
2. Thread `lockWaitMs` from `withPublishCheckout` opts into `acquireLock(lockDir, lockTimeoutMs, lockWaitMs)`.
3. Update the test as in the criteria; add the release-mid-wait test.
4. Rebuild dist via the mcp-host-server build script (e.g. `pnpm --filter <mcp package name> build` or `cd mcp-host-server && pnpm build`); commit only the changed dist files.

Do not touch: mcp-host-server/src/server.ts or any other src file.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-publish-checkout.test.ts tests/mcp-dist-sync.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
