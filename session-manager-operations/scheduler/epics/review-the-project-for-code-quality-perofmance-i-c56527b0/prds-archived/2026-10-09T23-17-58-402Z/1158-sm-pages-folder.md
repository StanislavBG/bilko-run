---
title: Session Manager pages live in one folder: move SessionManagerPage and ManualPage into src/pages/session-manager-landing/
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:17:05.569Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [sm-landing-hooks]
planId: pl-mv1kthd9-aea075
---
# Goal

migration. Session Manager is the one app-specific product UI living in the host, but its two top-level pages (src/pages/SessionManagerPage.tsx, src/pages/ManualPage.tsx) sit beside the platform pages, while the rest of its UI is in src/pages/session-manager-landing/. Move both pages into that folder with `git mv`, so 'everything Session Manager' is one folder. Update imports and test paths.

# Acceptance criteria

- [ ] `git mv` moves src/pages/SessionManagerPage.tsx and src/pages/ManualPage.tsx into src/pages/session-manager-landing/ (names kept); all imports (src/App.tsx lazy imports, CSS imports inside them, relative imports) are updated.
- [ ] Tests and e2e specs that reference the old paths (git grep 'SessionManagerPage' and 'ManualPage' in tests/ and e2e/) point at the new paths without weakening assertions.
- [ ] `pnpm typecheck`, `pnpm build` and full `pnpm test` green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/SessionManagerPage.tsx
- src/pages/ManualPage.tsx
- src/pages/session-manager-landing/
- src/App.tsx
- tests/
- e2e/

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/App.tsx (route imports); `git grep -n -e SessionManagerPage -e ManualPage`. CLAUDE.md's sanctioned list is updated later by docs-refresh-after-simplification; do not edit it here. Do not touch: CLAUDE.md, README.md.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
timeout 400 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
