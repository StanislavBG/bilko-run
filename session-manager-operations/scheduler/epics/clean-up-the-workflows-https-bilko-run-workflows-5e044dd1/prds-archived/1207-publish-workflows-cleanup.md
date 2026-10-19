---
title: Publish the cleanup: push main to origin, wait for the Render deploy, verify /workflows is gone live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T16:37:47.106Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
agentType: dev-lead
dependsOn: [claude-md-recount-after-cleanup]
planId: pl-mv2m49us-ae38eb
---
# Goal

build: Ship the workflows removal and dead-code trim to bilko.run. Push local main to origin (StanislavBG/bilko-run). Render auto-deploys from there. Then prove the live site serves the new build: /workflows no longer exists as a page, and the two retired demo endpoints return 404.

# Acceptance criteria

- [ ] Before pushing, record the live main JS asset path (`curl -sf --max-time 15 https://bilko.run/` then grep `/assets/index-*.js`) and `/api/health` uptime. Then `git push origin main` succeeds. Push to origin only, never the content-grade remote. If the push is rejected as non-fast-forward, run `git pull --rebase origin main`, re-run `pnpm typecheck` and `pnpm test`, and push again once.
- [ ] Wait for the deploy with a bounded loop: at most 20 tries, 30 s apart. A try counts as deployed when the live index.html references a different `/assets/index-*.js` than the recorded one. If the loop runs out, print a HALT line, write that to the record and exit 1.
- [ ] Live check: the served main JS bundle no longer contains the string `Background AI agents and automations` (the old Workflows section blurb). `POST https://bilko.run/api/demos/email-capture` and `POST https://bilko.run/api/demos/headline-grader/unlock` both return HTTP 404. `https://bilko.run/projects` returns 200.
- [ ] Write session-manager-operations/reviews/deploy/clean-up-the-workflows-https-bilko-run-workflows-5e044dd1/publish.md with the pushed SHA (`git rev-parse origin/main`), the old and new asset names, and each live check result with a timestamp in America/Los_Angeles (PDT). Commit it and push it too.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/clean-up-the-workflows-https-bilko-run-workflows-5e044dd1/publish.md

# Implementation notes

Read first: CLAUDE.md, the Rules section on push/deploy. Render deploys only from origin main, and there is no SHA endpoint, so a changed main asset hash is the deploy signal. Do not use uptime alone.
Steps:
1. `git status` must be clean on main. Do not commit unrelated working-tree files, especially anything under session-manager-operations/prompt-sessions/.
2. Record the old asset and push, as described in the criteria.
3. Run the bounded deploy wait loop (§1 pattern: `for i in $(seq 1 20)`).
4. Run the live checks with `curl --max-time 15`.
5. Write, commit and push the record.
Do not touch: any source file. If a live check fails after a successful deploy, report it with the evidence and exit 1. Do not try to fix the code here.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 bash -c 'test 404 = $(curl -s --max-time 15 -o /dev/null -w %{http_code} -X POST -H content-type:application/json -d {} https://bilko.run/api/demos/email-capture)'
timeout 60 bash -c 'js=$(curl -sf --max-time 15 https://bilko.run/ | grep -o /assets/index-[A-Za-z0-9_-]*.js | head -1) && test -n $js && ! curl -sf --max-time 15 https://bilko.run$js | grep -q Background.AI.agents.and.automations'
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
