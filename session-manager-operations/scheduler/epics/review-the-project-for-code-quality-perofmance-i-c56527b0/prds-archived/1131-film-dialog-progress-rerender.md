---
title: Session Manager film dialog: stop re-rendering the whole dialog 60 times a second
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-09T23:08:16.557Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kthd9-aea075
---
# Goal

behavior. src/pages/session-manager-landing/FilmDialog.tsx (~lines 118-128) calls setTime on every animation frame while the promo video plays, so the 433-line dialog re-renders at ~60 fps. Move the progress display into a small child component that owns that state, or drive it through a ref, so only the progress bar updates.

# Acceptance criteria

- [ ] FilmDialog's top-level component no longer holds per-frame time state; a child component (or a ref plus direct style update) renders progress.
- [ ] Visible behavior is unchanged: the progress bar advances, seeking, pausing and the end card work as before.
- [ ] tests/session-manager-landing.test.ts and tests/session-manager-book.test.ts stay green; `pnpm build` passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/session-manager-landing/FilmDialog.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/pages/session-manager-landing/FilmDialog.tsx (whole). Do not touch: other session-manager-landing files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/session-manager-landing.test.ts tests/session-manager-book.test.ts
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
