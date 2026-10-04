---
title: Remove Academy as a top-level site section (nav tab, footer, ⌘K)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T22:24:11.511Z
sourcePromptId: academy-we-need-to-improve-it-the-visual-layout--f2b04b79
tag: feature
agentType: dev-lead
disposition: new-head
planId: pl-musylofr-6dce8b
---
# Goal

Type: behavior. Academy is an external sibling app (static-path at /projects/academy/), so for consistency with every other sibling it must stop being a top-level site section and live only as a project on /projects. Remove the 'academy' entry from SECTIONS (which drives the top nav, mobile menu, footer columns, home-page section tiles and the ⌘K palette) and the now-unused Academy level data.

# Acceptance criteria

- [ ] src/data/portfolio.ts: SECTIONS has no entry with id 'academy' (remaining order: home, projects, blog, workflows, contact); the unused ACADEMY_LEVELS export and AcademyLevel interface are removed.
- [ ] src/components/Layout.tsx: activeSectionPath no longer has the '/academy' branch; footer still renders all remaining sections across its 'Sections' and 'More' columns (adjust the slice split so 'Sections' shows Home, Projects, Blog and 'More' shows Workflows, Contact).
- [ ] New test tests/academy-nav.test.ts (vitest) imports SECTIONS from src/data/portfolio.ts and asserts no section has id 'academy' or a path/href containing 'academy', and that ids equal ['home','projects','blog','workflows','contact']. It passes.
- [ ] pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/portfolio.ts
- src/components/Layout.tsx
- tests/academy-nav.test.ts

# Implementation notes

Read first: src/data/portfolio.ts lines 30-100 (AcademyLevel interface ~34, SECTIONS ~82-89, ACADEMY_LEVELS ~92-98); src/components/Layout.tsx lines 15-25 (activeSectionPath) and 120-175 (mobile menu + footer slices SECTIONS.slice(0, 4) / slice(4)); src/pages/HomePage.tsx lines 115-140 (section tiles use SECTIONS.length, no change needed); src/components/portfolio/CommandPalette.tsx line 36 (maps SECTIONS, no change needed — Academy stays reachable in ⌘K via PORTFOLIO_PROJECTS since 'academy' is a registry project).
Steps:
1. Run `grep -rn "ACADEMY_LEVELS\|AcademyLevel" src` — expect hits only in portfolio.ts (the in-repo Academy pages are being deleted by sibling PRD academy-retire-inrepo-pages and never imported these). Delete the interface and constant.
2. Delete the academy SECTIONS line.
3. In Layout.tsx remove the `/academy` line in activeSectionPath and change the footer slices to SECTIONS.slice(0, 3) and SECTIONS.slice(3).
4. Write tests/academy-nav.test.ts.
Do not touch: src/App.tsx, src/pages/Academy*.tsx, src/data/academy/ (owned by academy-retire-inrepo-pages), src/data/projectsView.ts, src/pages/HomePage.tsx copy.

# Out of scope

- Editing the Academy link in ~/Projects/Bilko-Host-Kit/src/SiteHeader.tsx (separate repo)
- Changing /projects ordering or visibility

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/academy-nav.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
