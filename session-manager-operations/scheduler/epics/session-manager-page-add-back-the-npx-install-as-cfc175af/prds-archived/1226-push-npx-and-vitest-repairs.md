---
title: deploy: push the npx e2e repair and vitest SQLITE_BUSY repair to origin main and confirm CI + live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T21:59:40.656Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
agentType: dev-lead
dependsOn: [repair-npx-copy-e2e, repair-vitest-sqlite-busy]
planId: pl-mv2utb6r-b533e1
---
# Goal

doc. Push the commits landed by repair-npx-copy-e2e and repair-vitest-sqlite-busy to origin main (StanislavBG/bilko-run), confirm GitHub CI for the pushed SHA, confirm bilko.run still serves the npx price tag, and commit a short publish record.

# Acceptance criteria

- [ ] `git push origin main` succeeds fast-forward only (never force, never the content-grade remote). If rejected, `git pull --rebase origin main` once, re-run `timeout 300 pnpm typecheck`, push again; otherwise HALT.
- [ ] Bounded wait (at most 20 x 30s) for the GitHub Actions 'CI' run on the pushed SHA (`gh run list --branch main --commit <sha> --json status,conclusion`); its conclusion is recorded. A failure is recorded honestly with the failing step name, not hidden.
- [ ] Live check: https://bilko.run/products/session-manager returns 200 and its loaded JS chunk graph still contains 'npx claude-code-session-manager@latest' (check the SessionManagerPage/hooks chunks, not just the index entry).
- [ ] New file session-manager-operations/reviews/deploy/session-manager-page-add-back-the-npx-install-as-cfc175af/publish-repairs.md records the pushed SHA, CI conclusion and live checks with America/Los_Angeles timestamps; it is committed and pushed.
- [ ] `git merge-base --is-ancestor HEAD origin/main` exits 0 at the end.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/session-manager-page-add-back-the-npx-install-as-cfc175af/publish-repairs.md

# Implementation notes

Read first: session-manager-operations/reviews/deploy/session-manager-page-add-back-the-npx-install-as-cfc175af/publish.md (format and the code-split chunk check it used).
The main checkout has unrelated dirty/untracked files under session-manager-operations/ owned by other jobs; never add, stash, reset or commit them. Only publish-repairs.md is yours. Use `TZ=America/Los_Angeles date '+%Y-%m-%d %H:%M:%S %Z'` for timestamps. Do not edit code; if CI is red, record it and report (no fix here).

# Out of scope

- Code changes
- Pushing to content-grade

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
