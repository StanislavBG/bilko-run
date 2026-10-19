---
title: Field Manual service: stop doing synchronous disk reads on every request
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T23:06:22.391Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kr19z-e8ebb2
---
# Goal

behavior. server/services/manual.ts (~lines 53-60, 90, 115, 123) runs readdirSync/existsSync/readFileSync on every manual request to find the latest release and read its files. Each blocks the event loop. The bundle only changes on deploy, so resolve the latest release once and cache file contents in memory, with a size cap.

# Acceptance criteria

- [ ] The latest-release directory is resolved once per process and memoized.
- [ ] File reads go through an in-memory cache (Map path → Buffer) with a total cap of 20 MB; past the cap it reads without caching. Reads use fs/promises, not sync calls, on the request path.
- [ ] The path-traversal guard (~line 113-114: resolved path must start with the base) is kept unchanged and still covered by a test.
- [ ] tests/manual.test.ts stays green and adds a test that two reads of the same chapter hit the disk once (spy on fs/promises.readFile).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/services/manual.ts
- server/routes/manual.ts
- tests/manual.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Session Manager code that is sanctioned in the host. Read first: server/services/manual.ts (whole, ~140 lines); server/routes/manual.ts (callers); tests/manual.test.ts. Do not touch: server/routes/manual.ts unless a signature must become async (then update its call sites only).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/manual.test.ts tests/manual-client.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
