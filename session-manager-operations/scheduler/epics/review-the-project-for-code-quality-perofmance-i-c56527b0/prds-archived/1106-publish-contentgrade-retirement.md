---
title: Publish: ship the ContentGrade retirement to bilko.run and confirm the public surfaces are gone
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T21:30:42.877Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: dev-lead
dependsOn: [validate-contentgrade-retirement]
planId: pl-mv1hacoj-72fbb4
---
# Goal

build. After the validator runs, push this plan's commits to origin main (StanislavBG/bilko-run). Render auto-deploys from there. Then confirm live that ContentGrade is no longer sold, license endpoints are gone, the two blog posts no longer name Content-Grade, and CI is green. Scheduler jobs merge into local main after they commit, so this separate job does the push. Never push if the validator refuted anything.

# Acceptance criteria

- [ ] Read session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-contentgrade-retirement.md. If it has any `REFUTED` line, or an entry under `### Critical` / `### Important` other than `- none`, HALT with exit 1 and push nothing.
- [ ] `git fetch origin`. Every commit in `git log --format='%h %s' origin/main..main` must be either this plan's work (subjects matching the validation record's per-PRD commits, its merges and the record commit) or an ops snapshot touching only session-manager-operations/. Print the list. Anything else: HALT with exit 1 and name it.
- [ ] In this job's own worktree at main's tip, `pnpm typecheck`, `pnpm test` and `pnpm build` each exit 0 (timeout 400 each). Then `git push origin <sha>:refs/heads/main`: origin only, never content-grade, never force. On a non-fast-forward rejection, fetch, merge origin/main into a temp branch, re-run `pnpm test` and push; at most 3 tries; HALT on a conflict. Record the pushed SHA and the push time.
- [ ] Poll `curl -sf --max-time 15 https://bilko.run/api/health` at most 20 times, 30 s apart, until uptime is less than the seconds since the push.
- [ ] Live checks, each reported: /upgrade gives 302 with Location `/` or https://bilko.run/; POST /api/license/validate and GET /api/stripe/license-key?email=a@b.co give 404; GET /my-license body has no 'License key' text. For slugs from-saas-to-host-decomposing-bilko-in-one-week and week-of-six-games, https://bilko.run/api/blog/<slug> content has no /content.?grade/i match.
- [ ] `gh run list --repo StanislavBG/bilko-run --workflow ci.yml --commit <sha> --limit 1 --json databaseId,status,conclusion`, retried at most 20 times 30 s apart until a run appears. Then `timeout 900 gh run watch <id> --repo StanislavBG/bilko-run --exit-status`. On red, report the failing step and exit 1.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- README.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Remote `origin` = StanislavBG/bilko-run. The `content-grade` remote is a separate, retired project; never push there.

The main checkout has unrelated untracked/uncommitted files (session-manager-operations/, .playwright-mcp/, check-blank.png, sm-prod-landing.png, data/manual/releases/1.0.0/figures/). Never stage, stash, commit, reset or discard them. Never `git add -A`. Never check out branches in the main checkout. Do all git work in this job's own worktree; confirm isolation with `git rev-parse --git-common-dir`.

Polling: use one bounded loop under timeout (e.g. `timeout 700 bash -c 'for i in $(seq 1 20); do ...; sleep 30; done'`) with identical wording on every attempt; never `sleep N && cmd` chains.

Do not touch: any tracked file. The only commit allowed is a merge commit on a temp branch, and only in the non-fast-forward case.

# Out of scope

- Fixing a failing check: HALT and report instead
- Stripe dashboard changes (payment link, products)
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
