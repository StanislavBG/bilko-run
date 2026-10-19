---
title: Shared format helpers + Field Manual page: one formatBytes, a data hook, and no N full re-renders while chapters load
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:16:08.581Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [admin-pages-wire]
planId: pl-mv1ktdhy-60aef1
---
# Goal

behavior. formatBytes is written three times: ManualPage.tsx ~33, admin/BandwidthPanel.tsx ~20, admin/ObservabilityPage.tsx ~84-96. In src/pages/ManualPage.tsx every chapter fetch calls setChapters (~149), so the whole page re-renders once per chapter as they load. Extract a shared src/lib/format.ts. Move ManualPage's data loading (~116-169) into a useManualChapters hook that commits all chapters in one state update, and render chapters through a memoized Chapter component.

# Acceptance criteria

- [ ] New src/lib/format.ts exports formatBytes; ManualPage, BandwidthPanel and ObservabilityPage import it and their local copies are deleted.
- [ ] ManualPage uses a `useManualChapters()` hook (in the same file or src/lib/manualClient.ts's neighbor) that loads chapters in parallel and sets state once; chapters render through `React.memo(Chapter)`.
- [ ] The manual still renders the same chapters, ToC and download links: tests/manual-client.test.ts and tests/session-manager-book.test.ts green.
- [ ] `pnpm typecheck` and `pnpm build` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/lib/format.ts
- src/pages/ManualPage.tsx
- src/pages/admin/BandwidthPanel.tsx
- src/pages/admin/ObservabilityPage.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/pages/ManualPage.tsx (whole); src/lib/manualClient.ts; the formatBytes copies. Do not touch: src/pages/SessionManagerPage.tsx, src/styles/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/manual-client.test.ts tests/session-manager-book.test.ts
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
