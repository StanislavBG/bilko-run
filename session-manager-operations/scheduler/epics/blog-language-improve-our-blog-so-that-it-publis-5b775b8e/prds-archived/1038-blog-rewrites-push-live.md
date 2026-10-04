---
title: Push the merged blog rewrites to origin/main and confirm they are live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T17:35:07.689Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: build
agentType: dev-lead
dependsOn: [blog-rewrite-space-shooter, blog-rewrite-twelve-releases, blog-rewrite-sigma-contract, blog-rewrite-the-book, blog-rewrite-new-game]
planId: pl-musn5bd6-b4cbc7
---
# Goal

build. Scheduler jobs commit in their own worktree, and the scheduler merges them into the shared `main` ref afterwards. A push made inside a job therefore misses its own merged commit. On 2026-10-03 this left PRDs 1024 and 1030 committed but not pushed, and Render (which deploys origin/main) never saw them. This job runs after the five post rewrites are merged: it pushes `main` to origin and confirms the rewrites are live on bilko.run.

# Acceptance criteria

- [ ] `git log origin/main..main` is inspected first. It must list only scheduler merges/commits from this Epic plus routine snapshot commits. If it lists anything else unexpected, HALT with exit 1 and name the commits.
- [ ] `git push origin main` succeeds, never to any other remote and never force. If it is rejected as non-fast-forward, run `git fetch origin` then `git rebase origin/main main` (only when the shared main ref is not checked out with conflicting changes; otherwise HALT and report) and push again, at most 3 attempts.
- [ ] After the push, poll at most 20 times 30s apart (curl --max-time 15). Each of the 5 slugs (a-space-shooter-shrank-66-percent-to-fit-in-your-browser, twelve-releases-in-four-days-for-the-scheduler-view, sigma-now-shows-who-sits-behind-a-contract, the-book-didnt-know-what-it-already-held, a-new-game-a-week-old-and-already-playable) must return content from https://bilko.run/api/blog/<slug> that passes `npx tsx scripts/blog-readability.ts` (exit 0). Report per-slug pass/fail; if any is not live after 20 polls, say which and exit 1.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/blog-rewrites/index.ts

# Implementation notes

Read first: server/blog-rewrites/index.ts (which rewrites are non-null), server/db.ts (where BLOG_REWRITES is applied at boot).

The main checkout has hundreds of unrelated, uncommitted public/outdoor-hours/hourly/*.json changes. Never stage, stash, commit or discard them. Never `git add -A`. This job commits nothing. Write each live post's content to a temp file (`mktemp`) before running the checker.

Do not touch: any tracked file.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-rewrites.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
