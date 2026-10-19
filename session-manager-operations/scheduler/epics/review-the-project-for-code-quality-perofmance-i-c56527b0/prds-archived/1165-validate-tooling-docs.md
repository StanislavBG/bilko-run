---
title: Validate: maintainer tooling and docs (one manifest schema, scripts typechecked, docs match the tree)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:18:46.513Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: validator
dependsOn: [manifest-schema-unify, typecheck-scripts, docs-refresh-after-simplification]
planId: pl-mv1kvwvg-fc3c17
---
# Goal

validate. Plan: 1135 manifest-schema-unify; 1155 typecheck-scripts; 1164 docs-refresh-after-simplification.

# Acceptance criteria

- [ ] 1135-manifest-schema-unify verified against its PRD in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/review-the-project-for-code-quality-perofmance-i-c56527b0/prds/ or prds-archived/ (find by slug).
- [ ] 1155-typecheck-scripts verified.
- [ ] 1164-docs-refresh-after-simplification verified (every path named in CLAUDE.md/README.md exists).
- [ ] Whole tree: `pnpm typecheck`, `pnpm test`, `pnpm build` green; write and commit session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-tooling-docs.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-tooling-docs.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: f6c830b41387627d97916c1af828bf4c1472dae1

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
