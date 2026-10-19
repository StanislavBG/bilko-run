---
title: Publish: ship the full simplification wave to bilko.run and confirm it's live and healthy
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-09T23:19:04.363Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: dev-lead
dependsOn: [validate-blog-files-db, validate-tool-gateways, validate-server-fixes, validate-frontend-simplification, validate-tooling-docs]
planId: pl-mv1kpii1-1d18b9
---
# Goal

build. After all five validators have run, push this wave's commits to origin main (StanislavBG/bilko-run), which Render auto-deploys. Then confirm the site, the blog (now served from content/blog/), the admin page and CI are healthy. Jobs merge into local main after they commit, so this separate job does the push. Never push if any validator refuted anything.

# Acceptance criteria

- [ ] Read the five records validate-blog-files-db.md, validate-tool-gateways.md, validate-server-fixes.md, validate-frontend-simplification.md and validate-tooling-docs.md under session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/. If any has a REFUTED line, or a Critical/Important entry other than `- none`, HALT with exit 1 and push nothing.
- [ ] `git fetch origin`. Every commit in `git log --format='%h %s' origin/main..main` must be this wave's work (subjects matching the validation records' per-PRD commits, their merges and the record commits) or touch only session-manager-operations/. Print the list; anything else: HALT with exit 1 and name it.
- [ ] In this job's own worktree at main's tip: `pnpm typecheck`, `pnpm test` and `pnpm build` each exit 0 (timeout 400). Then `git push origin <sha>:refs/heads/main`: origin only, never content-grade, never force. On non-fast-forward: fetch, merge origin/main into a temp branch, re-run `pnpm test`, push; at most 3 tries; HALT on conflict. Record the SHA and push time.
- [ ] Poll https://bilko.run/api/health at most 20 times 30 s apart (curl -sf --max-time 15) until uptime is less than the seconds since the push.
- [ ] Live checks, each reported: https://bilko.run/, /blog, /projects/ (after redirect) and /products/session-manager return 200. https://bilko.run/api/blog lists the same number of posts as before the push (capture the count first). Two sample posts (/api/blog/week-of-six-games and the newest slug) return non-empty content. /admin returns 200.
- [ ] `gh run list --repo StanislavBG/bilko-run --workflow ci.yml --commit <sha> --limit 1 --json databaseId,status,conclusion`, retried at most 20 times 30 s apart until a run appears; then `timeout 900 gh run watch <id> --repo StanislavBG/bilko-run --exit-status`. On red, report the failing step and exit 1.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- README.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Remote `origin` = StanislavBG/bilko-run. The `content-grade` remote is a separate, retired project; never push there.

Capture the live blog post count (`curl -sf --max-time 15 https://bilko.run/api/blog`) BEFORE pushing.

The main checkout has unrelated untracked/uncommitted files (session-manager-operations/, .playwright-mcp/, check-blank.png, sm-prod-landing.png, data/manual/releases/1.0.0/figures/). Never stage, stash, commit, reset or discard them; never `git add -A`; never check out branches in the main checkout. Work in this job's own worktree; confirm with `git rev-parse --git-common-dir`.

Polling: one bounded loop under timeout with identical wording every attempt; never `sleep N && cmd`.

Do not touch: any tracked file. The only commit allowed is a merge commit on a temp branch in the non-fast-forward case.

# Out of scope

- Fixing a failing check: HALT and report instead
- Pushing to any remote other than origin, or force-pushing

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 git fetch origin main
timeout 60 git merge-base --is-ancestor HEAD origin/main
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
