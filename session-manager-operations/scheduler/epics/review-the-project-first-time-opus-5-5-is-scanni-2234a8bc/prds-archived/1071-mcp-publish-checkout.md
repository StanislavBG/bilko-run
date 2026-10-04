---
title: bilko-host MCP: publish from a dedicated clean checkout with locked, path-scoped commit and retrying push
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-04T08:57:34.265Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
disposition: new-head
planId: pl-mutl87jt-689df9
---
# Goal

primitive: today the bilko-host MCP (mcp-host-server/src/server.ts, commitAndPush at about lines 117-141) writes, commits and pushes from the human's main checkout at ~/Projects/Bilko. That checkout usually has 200+ dirty files and can be on any branch. So publishing agents commit other people's staged work (`git commit -m` without paths), push `main` while HEAD is elsewhere, get non-fast-forward rejections (the sibling social-signals-trader pushes hourly), and get back a non-error result when the push failed. This PRD adds a standalone module that does all git work in a dedicated, clean checkout synced to origin/main.

# Acceptance criteria

- [ ] New file mcp-host-server/src/publish-checkout.ts exports `withPublishCheckout<T>(opts: { hostRoot: string; checkoutDir?: string; remote?: string; branch?: string; lockTimeoutMs?: number }, fn: (root: string) => Promise<{ result: T; paths: string[]; message: string }>): Promise<PublishOutcome<T>>`, where PublishOutcome is a typed union with `{ ok: true; result; committed: boolean; sha?: string }` and `{ ok: false; stage: 'lock' | 'sync' | 'commit' | 'push'; error: string }`. It imports no MCP SDK and no fastify
- [ ] Before fn runs, the checkout is created if missing (`git -C hostRoot worktree add --detach <dir>`, default dir from env BILKO_PUBLISH_CHECKOUT or ~/.local/state/bilko-host/publish-checkout), then `fetch <remote> <branch>`, `reset --hard <remote>/<branch>` and `clean -fd`; it never touches hostRoot's working tree or index
- [ ] It commits with `git commit -m <message> -- <paths>` after `git add -A -- <paths>`, so only the returned paths are committed. An empty diff returns ok with committed:false
- [ ] It pushes with `git push <remote> HEAD:refs/heads/<branch>`; on rejection it fetches, rebases onto <remote>/<branch> and retries, at most 3 attempts. Final failure returns ok:false with stage 'push'
- [ ] A lock (atomic mkdir of a lock dir next to the checkout, stale after lockTimeoutMs, default 10 min) serializes concurrent callers. A second caller waits up to 60 s, then returns ok:false with stage 'lock'
- [ ] New test tests/mcp-publish-checkout.test.ts uses real git in a tmp dir (bare origin plus host clone; a dirty, staged file in the host clone) and proves: the dirty staged host file is never committed; the commit contains only the returned paths; a concurrent commit pushed to origin between sync and push is rebased over and the push succeeds; a push to an origin that rejects every push (pre-receive hook exiting 1) returns stage 'push' after 3 attempts; the host clone's HEAD and index are unchanged

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/publish-checkout.ts
- tests/mcp-publish-checkout.test.ts

# Implementation notes

Read first: mcp-host-server/src/server.ts lines 40-150 (HOST_ROOT, REGISTRY_JSON, PUBLIC_PROJECTS, gitInHost, commitAndPush, which you are replacing; do NOT edit server.ts here); mcp-host-server/tsconfig.json (NodeNext, strict; use `.js` import suffixes).

Implementation: use `execFile` from node:child_process (promisified) with explicit args, never a shell. Give every git call a timeout option (60 s; 120 s for fetch and push). Use `git -c user.name=... -c user.email=...` only if the repo has no identity configured; otherwise inherit. In the test, set GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME and GIT_COMMITTER_EMAIL env in the test process, and pass checkoutDir inside the tmp dir so nothing touches ~/.local. Use `git init --bare` for origin. Simulate a concurrent push from inside fn by committing and pushing from a second clone. The test file goes in tests/ (root vitest include is tests/**/*.test.ts) and imports '../mcp-host-server/src/publish-checkout.js'.

Do not touch: mcp-host-server/src/server.ts, mcp-host-server/dist/ (later PRDs wire and rebuild).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-publish-checkout.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
