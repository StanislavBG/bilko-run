---
title: Session Manager landing: move page-turn and canvas-input logic into hooks; one Chevron icon
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:16:43.527Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [manual-page-hooks, film-dialog-progress-rerender]
planId: pl-mv1kthd9-aea075
---
# Goal

migration. src/pages/SessionManagerPage.tsx (447 lines) keeps page-turn state (~191-262) and a canvas input effect (~265-319) inline. The Chevron icon is defined both there (~168) and in ManualPage.tsx (~69). Extract `useBookPages()` and `useCanvasTurnInputs()` into src/pages/session-manager-landing/hooks.ts and one Chevron into the landing folder, with behavior unchanged.

# Acceptance criteria

- [ ] src/pages/session-manager-landing/hooks.ts exports useBookPages and useCanvasTurnInputs; SessionManagerPage.tsx uses them and drops the inline logic.
- [ ] Chevron is defined once (e.g. session-manager-landing/Chevron.tsx) and imported by SessionManagerPage and ManualPage.
- [ ] tests/session-manager-landing.test.ts, tests/session-manager-book.test.ts and tests/open-core-positioning.test.ts are green; if one reads file text, update its path or expectation to the new location without weakening what it asserts.
- [ ] `pnpm typecheck` and `pnpm build` pass; report SessionManagerPage.tsx line count before and after.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/SessionManagerPage.tsx
- src/pages/ManualPage.tsx
- src/pages/session-manager-landing/hooks.ts
- src/pages/session-manager-landing/Chevron.tsx
- tests/session-manager-landing.test.ts
- tests/session-manager-book.test.ts
- tests/open-core-positioning.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/pages/SessionManagerPage.tsx (whole); src/pages/session-manager-landing/hooks.ts; ManualPage.tsx ~60-75; the three tests. Do not touch: FilmDialog.tsx, CSS files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/session-manager-landing.test.ts tests/session-manager-book.test.ts tests/open-core-positioning.test.ts
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
