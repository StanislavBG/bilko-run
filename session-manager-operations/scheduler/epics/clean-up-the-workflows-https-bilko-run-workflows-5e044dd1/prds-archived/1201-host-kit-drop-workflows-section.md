---
title: host-kit: drop the Workflows link from SiteHeader DEFAULT_SECTIONS
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-10T16:32:37.225Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
agentType: dev-lead
disposition: new-head
planId: pl-mv2m4ind-0f6332
---
# Goal

migration: bilko.run/workflows is retired, so the shared sibling header must stop advertising it. Remove the Workflows entry from host-kit's DEFAULT_SECTIONS, add a changeset, and rebuild the package so sibling apps pick it up on their next install.

# Acceptance criteria

- [ ] packages/host-kit/src/SiteHeader.tsx `DEFAULT_SECTIONS` is exactly Home, Projects, Blog, Academy, Contact (the `{ label: 'Workflows', href: 'https://bilko.run/workflows' }` entry is removed).
- [ ] A new changeset `.changeset/site-header-drop-workflows.md` with frontmatter `"host-kit": patch` and a one-sentence body explaining the Workflows link was removed because bilko.run/workflows was retired.
- [ ] If any host-kit test asserts the section list or count, it is updated to the five sections; `pnpm --filter host-kit test`, `pnpm --filter host-kit typecheck` and `pnpm --filter host-kit build` all pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- packages/host-kit/src/
- packages/host-kit/tests/
- .changeset/site-header-drop-workflows.md

# Implementation notes

Read first: packages/host-kit/src/SiteHeader.tsx lines 35-50; .changeset/shared-site-header.md (changeset format); `grep -rn "Workflows\|workflows" packages/host-kit --include=*.ts --include=*.tsx -l | grep -v node_modules | grep -v dist` to find any test referencing it.
Steps:
1. Remove the Workflows entry from DEFAULT_SECTIONS in packages/host-kit/src/SiteHeader.tsx.
2. Update any host-kit test under packages/host-kit/ that pins the list.
3. Write .changeset/site-header-drop-workflows.md.
4. Run the gate. dist/ is untracked — do not commit it.
Do not touch: anything under src/, scripts/, tests/ at repo root (sibling PRDs own those). Do not edit sibling repos.

# Out of scope

- Publishing host-kit to npm
- Reinstalling host-kit in sibling repos

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --filter host-kit test
timeout 300 pnpm --filter host-kit typecheck
timeout 300 pnpm --filter host-kit build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
