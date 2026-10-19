---
title: Publish: push the validated host simplification to origin/main and confirm bilko.run is live and CI is green
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T19:48:45.353Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: dev-lead
dependsOn: [validate-host-simplification]
planId: pl-mv1dgcto-8ab552
---
# Goal

build. Ship this plan: after the validator has run, push the plan's commits to origin main (StanislavBG/bilko-run), which Render auto-deploys, and confirm the site and the new CI workflow are healthy. Scheduler jobs commit in their own worktree and are merged afterwards, so this separate job does the push. Never push if the validator refuted anything.

# Acceptance criteria

- [ ] Read session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-host-simplification.md; if it contains any `REFUTED` line or an open Critical/Important finding, HALT with exit 1 naming them and push nothing.
- [ ] Find the plan's commits: SRC = `main` if the validation record commit is an ancestor of main, else the branch `sm-epic/review-the-project-for-code-quality-perofmance-i-c56527b0`; `git log origin/main..SRC` must list only this Epic's PRD commits/merges plus routine ops snapshot commits, else HALT and name the unexpected commits.
- [ ] On SRC: `pnpm typecheck`, `pnpm test`, `pnpm build` all exit 0 before pushing (each under timeout 400).
- [ ] `git push origin SRC:main` — only to remote `origin`, never `content-grade`, never force. If rejected as non-fast-forward: `git fetch origin`, merge origin/main into a temp branch from SRC (`git merge --no-edit`), re-run `pnpm test`, push the temp branch to origin main; at most 3 attempts; on a merge conflict HALT.
- [ ] After the push: poll https://bilko.run/api/health at most 20 times 30 s apart (`curl -sf --max-time 15`) until its uptime is lower than the seconds since the push; then `curl -sf --max-time 15` returns 200 for https://bilko.run/, https://bilko.run/projects, https://bilko.run/blog and https://bilko.run/products/session-manager. Report each.
- [ ] `gh run list --workflow ci.yml --limit 1` for the pushed SHA: poll at most 20 times 30 s apart until completed; report its conclusion (a red CI run is reported with its failing step, exit 1).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- README.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Remote `origin` = StanislavBG/bilko-run. The `content-grade` remote is a separate project: never push there.

The main checkout has unrelated uncommitted files under session-manager-operations/ (and possibly public/outdoor-hours/). Never stage, stash, commit or discard them; never `git add -A`; do not check out branches in the main checkout. Do all git work in this job's own worktree (use a temp branch for any merge). This job commits nothing to the tree beyond a possible merge commit.

Do not touch: any tracked file.

# Out of scope

- Fixing a failing check — HALT and report instead
- Pushing to any remote other than origin

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
