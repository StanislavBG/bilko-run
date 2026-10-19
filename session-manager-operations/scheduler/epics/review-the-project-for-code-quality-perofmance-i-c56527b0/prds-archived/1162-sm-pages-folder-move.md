---
title: Session Manager pages live in one folder: move SessionManagerPage and ManualPage into src/pages/session-manager-landing/
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:18:08.737Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [sm-landing-hooks]
planId: pl-mv1kthd9-aea075
---
# Goal

migration. Session Manager is the one app-specific product UI living in the host. Its two top-level pages (src/pages/SessionManagerPage.tsx, src/pages/ManualPage.tsx) sit beside the platform pages, while the rest of its UI is in src/pages/session-manager-landing/. Move both pages into that folder with `git mv`, so 'everything Session Manager' is one folder. Update the imports and the test paths that reference them.

# Acceptance criteria

- [ ] `git mv` moves src/pages/SessionManagerPage.tsx and src/pages/ManualPage.tsx into src/pages/session-manager-landing/ (names kept); src/App.tsx lazy imports and the moved files' relative imports (CSS, hooks, lib) are updated.
- [ ] Comment/path references in src/pages/session-manager-landing/bookTurn.ts, src/styles/session-manager-landing.css and src/styles/session-manager-manual.css point at the new paths.
- [ ] tests/open-core-positioning.test.ts, tests/session-manager-landing.test.ts and tests/session-manager-urls.test.ts read the new paths without weakening assertions.
- [ ] `pnpm typecheck`, `pnpm build` and full `pnpm test` green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/SessionManagerPage.tsx
- src/pages/ManualPage.tsx
- src/pages/session-manager-landing/
- src/App.tsx
- src/styles/session-manager-landing.css
- src/styles/session-manager-manual.css
- tests/open-core-positioning.test.ts
- tests/session-manager-landing.test.ts
- tests/session-manager-urls.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/App.tsx (route imports); `git grep -n -e SessionManagerPage -e ManualPage`. CLAUDE.md's sanctioned list is updated later by docs-refresh-after-simplification; do not edit it here. Do not touch: CLAUDE.md, README.md, any file not listed.

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
