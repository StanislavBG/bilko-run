---
title: Split AdminPage (3): Synthetic and Manifests tabs reuse the Observability components
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:16:34.898Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [adminpage-split-2, manual-page-hooks]
planId: pl-mv1ktdhy-60aef1
---
# Goal

migration. Step 3 of 3. AdminPage's Synthetic and Manifests tabs duplicate src/pages/admin/ObservabilityPage.tsx; for example, the drift badge (originally ~1078-1086) copies ObservabilityPage ~108-116. Export the shared drift badge from ObservabilityPage (or a small admin/DriftBadge.tsx), move both tabs into src/pages/admin/analytics/OpsTabs.tsx using it, and leave AdminPage.tsx as a thin shell: header, KPIs, tab bar and tab switch.

# Acceptance criteria

- [ ] src/pages/admin/analytics/OpsTabs.tsx exports SyntheticTab and ManifestsTab; the drift badge exists once and both pages use it.
- [ ] AdminPage.tsx is under 250 lines (report the count) and contains only the shell, the tab bar and the tab imports; it has no remaining `: any` state.
- [ ] `pnpm typecheck` and `pnpm build` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/AdminPage.tsx
- src/pages/admin/analytics/OpsTabs.tsx
- src/pages/admin/ObservabilityPage.tsx
- src/pages/admin/DriftBadge.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: src/pages/AdminPage.tsx (as landed); src/pages/admin/ObservabilityPage.tsx (as landed by manual-page-hooks); src/pages/admin/analytics/parts.tsx. Do not touch: other admin tabs files except imports.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
