---
title: CI: run typecheck and tests on every push to main and every PR
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-09T19:42:06.828Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
planId: pl-mv1dgcto-8ab552
---
# Goal

primitive. The repo has no CI for the host: the only workflow, .github/workflows/host-kit-release.yml, runs on host-kit-v* tags. A non-technical maintainer pushing to main gets no red/green signal before Render deploys. Add .github/workflows/ci.yml that runs typecheck, the vitest suite, the host-kit tests and the production build on push to main and on pull_request.

# Acceptance criteria

- [ ] New file .github/workflows/ci.yml triggers on `push` to branch main and on `pull_request`.
- [ ] The job runs on ubuntu-latest and, in order: checkout, setup-node (node 22), pnpm/action-setup, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm --filter host-kit test`, `pnpm build`.
- [ ] Actions are pinned to full commit SHAs, copied from .github/workflows/host-kit-release.yml (checkout 11bd71901bbe5b1630ceea73d27597364c9af683, setup-node 49933ea5288caeca8642d1e84afbd3f7d6820020, pnpm/action-setup a7487c7e89a18df4991f7f222e4898a00d66ddda) with the same version comments; `permissions: contents: read`; a `concurrency` group cancels superseded runs on the same ref.
- [ ] Each of the four pnpm commands was run locally once in the repo and exited 0; the report lists each command and its result.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .github/workflows/ci.yml

# Implementation notes

Repo: /home/bilko/Projects/Bilko (pnpm workspace, packageManager pnpm@10.32.0 in package.json).

Read first: .github/workflows/host-kit-release.yml (whole file, ~45 lines) for the pinned action SHAs and pnpm setup pattern; package.json scripts (typecheck, test, build).

Steps:
1. Create .github/workflows/ci.yml with `name: CI`, the triggers above, one job `check`, timeout-minutes 20.
2. No secrets: the test suite runs without env vars (verified locally). Do not add any `env:` secrets. Set `CI: true` only.
3. Run locally: `pnpm typecheck`, `pnpm test`, `pnpm --filter host-kit test`, `pnpm build` (each under `timeout 400`). If `pnpm --filter host-kit test` fails for a reason unrelated to this PRD, drop that step from the workflow and say why in the report.

Do not touch: .github/workflows/host-kit-release.yml, package.json.

# Out of scope

- Deploy steps, Render hooks, or any secret
- Changing test or build scripts

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 node -e 'const y=require("js-yaml");const d=y.load(require("fs").readFileSync(".github/workflows/ci.yml","utf8"));if(!d.jobs||!d.on)process.exit(1)'
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
