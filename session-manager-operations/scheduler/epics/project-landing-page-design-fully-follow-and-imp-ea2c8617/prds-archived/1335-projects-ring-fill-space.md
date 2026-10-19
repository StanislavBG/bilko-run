---
title: Projects Ring: side spines widen to fill the space left and right of the hero
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T23:14:55.809Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
disposition: new-head
planId: pl-mv7atg3l-3d0b1e
---
# Goal

behavior: with only ~7 public projects the ring's spines keep the design's fixed 64px*0.9^(j-1) widths, so each side shows 3 thin spines huddled next to the hero and ~400px of empty stage beyond them. The owner wants the side items to fill the space: when a side's spines don't naturally reach the stage edge, scale that side's spine widths up proportionally so they span from the hero edge (8px gap) to the stage edge (8px margin), keeping 6px gaps. When there are enough spines to overflow (the 140-project case), behaviour is unchanged.

# Acceptance criteria

- [ ] src/data/projectsRing.ts: `spineGeom(k, stageW, stageH, falloff = 0.9, n?: number)` — when `n` is omitted the result is byte-for-byte the current behaviour (all existing tests in tests/projects-ring.test.ts still pass unchanged).
- [ ] When `n` is given: side counts are right = min(29, floor(n/2)) for k>0 and left = min(29, n-1-floor(n/2)) for k<0 (matching ringOffset's (-n/2, n/2] range); available side width = heroLeft - 8 - 8 (same both sides); natural width = sum over j=1..count of 64*f^(j-1) plus 6*(count-1); if natural < available every spine width on that side is multiplied by scale = (available - 6*(count-1)) / sum(64*f^(j-1)), and x positions are recomputed from the scaled widths so the outermost spine ends exactly 8px from the stage edge; if natural >= available nothing changes. Heights, opacity, fontPx and hidden are unchanged by scaling.
- [ ] src/pages/ProjectsPage.tsx passes `n` (the current card count) to spineGeom; no other change to that file.
- [ ] tests/projects-ring.test.ts adds tests: n=7, stageW=1440 → the 3 right spines' widths sum + 2*6 equals 1440 - heroRight - 16 (±0.5) and the k=3 spine's x+w equals 1440-8 (±0.5), mirrored for the left; n=140 → identical output to the no-n call; n=2 → the single right spine fills its side and there is no left spine (left count 0, no division by zero).
- [ ] pnpm typecheck and the unit tests pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectsRing.ts
- src/pages/ProjectsPage.tsx
- tests/projects-ring.test.ts

# Implementation notes

Read first: src/data/projectsRing.ts (spineGeom, lines ~30-65), tests/projects-ring.test.ts, src/pages/ProjectsPage.tsx lines 270-300 (the spineGeom call inside cards.map).

Before starting: local main may have diverged from origin (rebased duplicates). `git fetch origin` and work on top of current HEAD; never rewrite history.

Steps:
1. Write the new failing tests first.
2. In spineGeom, after computing the natural geometry, if `n !== undefined` compute this side's count and scale per the criterion. Implement with a small private helper (e.g. `sideScale(count, available, falloff)`), O(count) — count <= 29. Recompute cum with scaled widths: cum = 8 + sum_{m<jj}(W(m)*scale + 6); x = heroRight + cum (right) or heroLeft - cum - w (left). Guard count <= 0 and available <= 0 (scale 1).
3. ProjectsPage.tsx: `spineGeom(ringOffset(i, active, n), stage.w, stage.h, undefined, n)` (or 0.9 explicitly).
Spines are hidden under 900px by CSS already, so mobile is unaffected.
Do not touch: src/styles/projects-ring.css, e2e/projects-hub.spec.ts (sibling PRD projects-ring-outline-fix owns them).

# Out of scope

- CSS / outline fixes (sibling PRD)
- Changing spine heights, fonts or the 140-project behaviour

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/projects-ring.test.ts tests/projects-view.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
