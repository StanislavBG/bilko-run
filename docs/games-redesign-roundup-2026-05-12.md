# Games redesign roundup — five Claude Design handoffs, post-regression report

**Date:** 2026-05-12 PDT
**Scope:** five sibling-game redesigns (Cellar, Sudoku, MindSwiffer, FizzPop, Etch) implemented from Claude Design handoffs, then audited by five parallel regression-validation agents.

## Headline

All five games shipped their design handoffs to their own sibling repos and dropped fresh static bundles into `public/projects/<slug>/`. **Three real bugs that would have shipped broken to production were caught by the regression-validation step that the redesign agents missed**, plus eight follow-up PRDs queued for the scheduler.

Without the regression pass, returning v0.7 Cellar users would have been stranded on the old chrome forever (broken Service Worker cache invalidation), Sudoku undo would have silently failed for the visible grid (the test only asserted bus dispatch), and the MindSwiffer vitest suite would have shipped with a real failing test.

## What shipped (sibling repos)

| Game | Tag | Sibling sha | Drop sha | Bundle gz | Tests after regression |
|---|---|---|---|---|---|
| Cellar | v0.8.0 | 8cb89e2 | 8cb89e2 | 128 KB | 229 vitest + 121 Playwright |
| Sudoku | v0.9.0 | e0828a2 | e0828a2 | 123 KB | 337 vitest + 124 Playwright |
| MindSwiffer | v0.8.0 | 2f6a17e | a091d0a | 145 KB | 213 vitest + 126 Playwright |
| FizzPop | v0.8.0 | aedcaa8 | e49b916 | 168 KB | 276 vitest + 111 Playwright |
| Etch | v0.8.0 | 7b1e419 | 4f802fc | 123 KB | 291 vitest + 154 Playwright |

All five drops in `/home/bilko/Projects/Bilko/public/projects/<slug>/` are uncommitted; this commit batches them.

## Bugs caught + patched in-line (would-have-shipped-broken)

| # | Game | Severity | Bug | Fix |
|---|---|---|---|---|
| 1 | Cellar | critical | Service Worker `VERSION = 'cellar-v0.7.0'` even on v0.8.0 build → returning users never invalidate the v0.7 cache, stay on old chrome forever | Bumped to `cellar-v0.8.0` in `public/sw.js` + matching test assertion |
| 2 | Cellar | high | PWA `manifest.webmanifest` `background_color` + `theme_color` still white → install-splash flashes white before the wood backdrop loads | Synced both to `#1a120c` |
| 3 | Sudoku | critical | `GridSlot.tsx` kept a local `useState` board separate from the Zustand store. Undo, redo, new-game, multi-tab resume, and cloud-load all updated the store but the visible grid never re-rendered. Existing Cmd+Z test only asserted bus dispatch, not visual rollback. | `GridSlot.tsx` rewritten to read from the store; `bus-bridge.ts` learned to seed DEV_PUZZLE on first interaction; test strengthened to assert visual rollback |
| 4 | MindSwiffer | high | `tests/state/store.test.ts` `lose flow` test was failing in vitest because `resetStore()` didn't reset the cozy take-back state — agent never ran `pnpm test:unit` pre-ship | `resetStore()` now resets cozy store; 50-board cozy preset no-guess coverage added |

## PRDs queued for the scheduler

All ten queued at `~/.claude/session-manager/scheduled-plans/prds/`.

### Fix-now bracket

| PRD | Severity | What |
|---|---|---|
| `152-bilko-fizzpop-goal-banner-progress-fix.md` | fix-now | Goal banner progress bar stuck at 0% — `initialTotal` cache keyed on array reference that's replaced every shot |
| `64-bilko-etch-drag-set-mode.md` | fix-now | Tap-and-drag with Fill mode UN-FILLS pre-painted cells crossed by the gesture (toggle semantics where set semantics are wanted) |
| `65-bilko-etch-unify-hint-surface.md` | fix-now | Toolbar Hint button = direct one-cell placement; keyboard `H` = legacy 3-level escalation. Two semantics for the same action |
| `64-bilko-mindswiffer-cozy-classic-toggle.md` | fix-now | Cozy → classic via `☰` has no inverse — players who exit cozy can't return without clearing localStorage |

### Defer bracket

| PRD | What |
|---|---|
| `153-bilko-fizzpop-boosters-engine-wire.md` | Booster buttons (Bomb / Lightning / Rainbow) show counts + active rings but have no engine hook |
| `154-bilko-fizzpop-upnext-pity-race.md` | Up Next preview drifts cosmetically when the pity timer fires between peek-time and execute-time |
| `155-bilko-fizzpop-tearoom-settings-sheet.md` | Tearoom settings persist programmatically but lack an inline UI surface (existing CustomizeSheet still works) |
| `64-bilko-mindswiffer-cozy-budget-persist.md` | Take-back and hint budgets reset on tab reload (cozy `Persisted` shape only saves preferences, not per-game state) |
| `64-bilko-mindswiffer-anim-flag-plant-flake.md` | Pre-existing `anim.spec.ts › flag-plant` flakes 2/20 runs — RNG-dependent cell (0,0) cascade-reveals |
| `64-bilko-mindswiffer-bigtext-narrow-fit.md` | Big-text mode + ≤375px viewport overflows the 7-tile-wide board by 42-62px |

## Cross-game patterns worth fixing structurally

1. **"All tests pass" reports aren't all the tests.** Two of the five redesign agents reported full green test runs but their changes failed in suites they didn't run. Sudoku's `tests/v9-design.spec.ts` Cmd+Z test was asserting the wrong invariant (bus dispatch instead of visible rollback); MindSwiffer's redesign agent skipped `pnpm test:unit` entirely. Suggested host-level guard: every sibling `pnpm build` script enforces a `pnpm test:unit && pnpm test:e2e` precondition before allowing `dist/` to land.
2. **Manifest gitSha drift.** FizzPop and Etch both shipped drops with the previous version's `gitSha` because the build script doesn't refresh that field automatically. The regression agents had to rebuild + re-drop in both cases. Suggested host-level guard: the manifest-CLI should always inject `gitSha` from `git rev-parse --short HEAD` at build time.
3. **Service Worker version strings hand-maintained.** Cellar shipped a v0.8.0 build with a v0.7.0 SW VERSION literal in `public/sw.js`. The same hazard probably lives in every sibling that ships its own SW. Suggested host-level guard: SW VERSION should be templated from `package.json#version` at build time.
4. **Game-specific palette systems vs. legacy theme registry.** Cellar (4 new themes), Sudoku (Paper/Ink/Dark), MindSwiffer (Tearoom/Garden/Parlor), Etch (Cream/Sage/Lavender/Newspaper) each added a new palette system that doesn't always interact cleanly with the pre-existing themes registry. Etch's regression flagged "legacy themes are dead UI" when a palette is active. Worth standardising on a single theme contract across the games.
5. **Visual fidelity vs. axe-core.** Etch's regression agent had to drop the design's paper-grain texture + radial wash because axe-core's contrast calculator was confused by translucent overlays. Cellar's ambient lamp layer survived axe but only because `pointer-events: none` + careful z-index. There's craft here that should be codified.

## Manifest values for the host-repo commit

```
public/projects/cellar/manifest.json      version 0.8.0  gitSha 8cb89e2  128 KB gz
public/projects/sudoku/manifest.json      version 0.9.0  gitSha e0828a2  123 KB gz
public/projects/mindswiffer/manifest.json version 0.8.0  gitSha a091d0a  145 KB gz
public/projects/fizzpop/manifest.json     version 0.8.0  gitSha e49b916  168 KB gz
public/projects/etch/manifest.json        version 0.8.0  gitSha 4f802fc  123 KB gz
```

All under the 300 KB gz budget. Each game still passes its own `pnpm test:unit` and `pnpm test:e2e` post-regression.

## What's next

Trigger one Render Manual Deploy to ship all five redesigns at once. After that, run the four fix-now PRDs from the scheduler queue.
