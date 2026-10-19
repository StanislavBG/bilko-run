---
title: Deploy: push main to origin and verify the Launch Kit row is live on bilko.run/projects for signed-out visitors
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-11T07:38:16.062Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-hub-public, launch-kit-hub-commit-order]
planId: pl-mv3idm9q-d23f06
---
# Goal

deploy: ship the registry change to production and prove it. Push the Bilko main branch to origin (Render auto-deploys StanislavBG/bilko-run main), then verify with a real headless browser that https://bilko.run/projects, signed out, shows a 'Launch Kit' row whose open action goes to /projects/launch-kit/. Record the result.

# Acceptance criteria

- [ ] Before pushing, `pnpm test`, `pnpm typecheck` and `pnpm build` exit 0 on the commit being pushed.
- [ ] The record lists every commit pushed (`git log --oneline origin/main..HEAD` before the push); it may include unrelated earlier main commits such as ecdc5d0 (git-viewer default price) and 9a06ded (validation record).
- [ ] origin/main contains the launch-kit-hub-public and launch-kit-hub-commit-order commits; the push went only to the `origin` remote (github.com/StanislavBG/bilko-run), never to content-grade.
- [ ] Bounded poll (max 20 x 30s): headless Chromium, no cookies, loads https://bilko.run/projects and finds visible text 'Launch Kit' and '8 Claude skills that take your product from it-works to launched. $9.'
- [ ] Expanding the Launch Kit row and using its open action lands on https://bilko.run/projects/launch-kit/, and that URL returns 200 containing 'Launch Kit' (curl --max-time 15).
- [ ] session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-hub-deploy.md is committed and pushed to origin main: pushed SHA, commit list, PDT/PST times, each check PASS/FAIL, a /tmp screenshot path, and 'HUB: PASS' only if every check passed.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-hub-deploy.md

# Implementation notes

This runs in a scheduler job worktree branched from local main after both earlier PRDs landed. Read first: CLAUDE.md "Rules" (push to origin main only), src/pages/ProjectsPage.tsx lines 39-100 (HubRow: the row head is a button that expands; the open action sets window.location.href = card.href).

Steps:
1. `git log --oneline origin/main..HEAD` — confirm both earlier PRDs' commits are present (find them by subject); save the list for the record.
2. Run `timeout 600 pnpm test`, `timeout 300 pnpm typecheck`, `timeout 600 pnpm build`. HALT (exit 1, one diagnostic line) on any failure — the push deploys everything on main.
3. `git fetch origin`. If origin/main is not an ancestor of HEAD (`git merge-base --is-ancestor origin/main HEAD`), run `git merge --no-edit origin/main` — do NOT rebase, local history has merge commits; HALT on conflict. Then `git push origin HEAD:main`. Verify `git remote get-url origin` contains StanislavBG/bilko-run before pushing.
4. Render needs a few minutes and has no SHA endpoint, so poll the real condition. Write a check script in a temp dir (e.g. /tmp/lk-hub/check.mjs) using Playwright's chromium (the repo has @playwright/test as a devDependency; run the script from the repo root with NODE_PATH pointing at the repo's node_modules, or via `pnpm exec node`). If the browser binary is missing, run `pnpm exec playwright install chromium` once. Loop `for i in $(seq 1 20)` with `sleep 30` between attempts; each attempt: fresh browser context, goto https://bilko.run/projects, wait for load, read body text, look for 'Launch Kit' and the tagline. On success click the Launch Kit row head, then its open button, and assert the final URL is https://bilko.run/projects/launch-kit/. Save a desktop screenshot of the row to /tmp/lk-hub/projects-launch-kit.png. On exhaustion, FAIL with the last 300 chars of page text.
5. curl -sf --max-time 15 the landing page and check it contains 'Launch Kit'.
6. Write the record (times converted to America/Los_Angeles with PDT/PST), `git add` only the record, commit, fetch and merge origin/main again if it moved, push origin HEAD:main.

Do not touch: application source, src/data/, public/projects/, the private /home/bilko/Projects/Bilko-Launch-Kit repo. Do not add a permanent e2e spec to the repo.

# Out of scope

- Any code or registry change — if the live check fails because of the code, FAIL and report; do not fix it here
- Blog or social announcement
- A purchase test

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 curl -sf --max-time 15 https://bilko.run/projects/launch-kit/ && timeout 10 grep -q 'HUB: PASS' session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-hub-deploy.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
