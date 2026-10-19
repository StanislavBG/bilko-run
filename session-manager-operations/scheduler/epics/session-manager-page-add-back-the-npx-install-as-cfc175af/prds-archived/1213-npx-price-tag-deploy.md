---
title: deploy: push the npx price-tag option to bilko.run and verify it live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T20:37:36.256Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
agentType: dev-lead
dependsOn: [npx-price-tag-e2e]
planId: pl-mv2utb6r-b533e1
---
# Goal

doc. Push the landed npx price-tag commits (PRDs npx-copy-primitive, npx-price-tag-wire, npx-price-tag-e2e) to origin main (StanislavBG/bilko-run), let Render auto-deploy, confirm the live bilko.run/products/session-manager bundle carries the npx command, and commit a publish record.

# Acceptance criteria

- [ ] Before pushing, record the current live main asset: fetch https://bilko.run/products/session-manager (curl --max-time 15) and extract the /assets/index-*.js src.
- [ ] `git push origin main` succeeds (fast-forward only; NEVER push to the content-grade remote; never force-push). If the push is rejected as non-fast-forward, `git pull --rebase origin main` once, re-run `timeout 300 pnpm typecheck`, and push again; if that fails, HALT with a diagnostic.
- [ ] Bounded live check (at most 20 tries x 15s): the main asset src changes and the new bundle (curl --max-time 15 https://bilko.run/assets/<file>) contains 'npx claude-code-session-manager@latest' and 'Copy the install command'. On exhaustion print HALT and exit 1.
- [ ] New file session-manager-operations/reviews/deploy/session-manager-page-add-back-the-npx-install-as-cfc175af/publish.md records: pushed SHA, old and new main asset names, try number, and each live check with a PASS/FAIL line and a timestamp in America/Los_Angeles (PDT). It is committed and pushed to origin main.
- [ ] `git merge-base --is-ancestor HEAD origin/main` exits 0 after the final push.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/session-manager-page-add-back-the-npx-install-as-cfc175af/publish.md

# Implementation notes

Read first:
- session-manager-operations/reviews/deploy/clean-up-the-workflows-https-bilko-run-workflows-5e044dd1/publish.md (the format to copy)
- CLAUDE.md 'Rules' section (push to origin = StanislavBG/bilko-run main only)

Steps:
1. `git -C <repo> status --short` — the main checkout has unrelated untracked/modified files under session-manager-operations/ owned by other jobs; do NOT add, stash, reset or commit them. Only the publish.md you create is yours.
2. Record old asset: `curl -sf --max-time 15 https://bilko.run/products/session-manager | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | head -1`.
3. `timeout 120 git push origin main`.
4. Poll loop: `for i in $(seq 1 20); do NEW=...; if [ "$NEW" != "$OLD" ] && curl -sf --max-time 15 https://bilko.run$NEW | grep -q 'npx claude-code-session-manager@latest'; then echo "live (try $i)"; break; fi; sleep 15; done` then a hard check that exits 1 if not found (do not use /api/health uptime as the deploy signal). Also check the bundle contains 'Copy the install command'.
5. Write publish.md (times via `TZ=America/Los_Angeles date '+%Y-%m-%d %H:%M:%S %Z'`), `git add` that one path, commit `docs(deploy): record npx price-tag publish verification`, `timeout 120 git push origin main`.

Do not touch any source file. If the live check fails, report HALT with the asset names — do not edit code here.

# Out of scope

- Code or test changes
- Pushing to the content-grade remote

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 git fetch origin main && timeout 30 git merge-base --is-ancestor HEAD origin/main
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
