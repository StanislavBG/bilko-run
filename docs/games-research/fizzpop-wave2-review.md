# FizzPop Wave-2 PRD Review — 2026-05-10

Wave-2 was a cross-review pass over all 12 FizzPop PRDs (100–106, parallelGroups 100–106). Every file was read end-to-end and expanded in place. Below is every gap found and how it was patched.

## Gaps and Patches

**PRD 100 (research-anchor)** — Slot inventory listed slot names but not which parallelGroup fills each. Added explicit mapping: `EngineSlot → 103`, `BoardSlot → 103`, `HudSlot → 103`, `DailySlot → 104`, `DifficultySlot → 104`, `ThemeSlot → 104`.

**PRD 101 (bootstrap)** — `src/lib/bus.ts` event type names were defined inline but not flagged as authoritative. Added canonical note: all PRDs 102–105 must import `bus` from this module; divergent event names are wrong.

**PRD 102 (engine)** — `worldToCell` description omitted the snap threshold value and algorithm. Inlined the full implementation with `SNAP_THRESHOLD = 0.5` (half tileDiameter). `resolveRainbow` tie-breaking was described in prose only; inlined an explicit function using clockwise neighbor index (index 0 = top-left wins). `addRowFromTop` comment was ambiguous about row-index direction; clarified row 0 = top, content shifts down. `isLost` comment did not reference the brief's lose condition; fixed. Out-of-scope section had bare NN cross-references; replaced with file paths.

**PRD 103 (state-persistence)** — Migration helper was referenced by name but never defined. Inlined full `loadOrReset<T>` generic with unknown-version → empty-state fallback. Streak state shape was deferred to another PRD number; replaced with inline TypeScript type. Resume condition was underspecified (would re-resume solved games on refresh); added explicit guard: `mode !== null && !solved && !lost && (mode !== 'daily' || dailyIso === todayIso)`. Added "what survives vs doesn't survive a hard reload" section.

**PRD 103 (ui-board)** — `Esc` and `?` keyboard handlers were missing from `input.ts` despite being called out in the design brief. Added both handlers, extended `KeyboardOpts` with `openSettings?` and `toggleShortcuts?` callbacks, and wired `bus.emit('settingsOpened', {})`. Screen-reader live-region contract was absent; added Step 7 with exact `aria-live="polite"` wording for every in-game event. Debug hook co-location note added: `__fizzpopTestState` belongs in `Board.tsx`, not `store.ts`.

**PRD 103 (ui-hud)** — `.fp-confirm` dialog used `position: absolute`, which clips inside the HUD strip. Fixed to `position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%)`.

**PRD 104 (daily-puzzle)** — `CalendarSheet` referenced a sibling PRD implementation instead of inlining it; replaced with full component. `validate-dailies.mjs` imported `solver.js` (would fail under tsx); renamed to `.ts` and fixed import path. `queueColorsFor` duplicated the `dailySeed()` formula rather than importing it from the engine; fixed. `trapFocus` inlined as a fallback since themes-a11y runs in the same parallelGroup and may not be present at integration time.

**PRD 104 (difficulty-modes)** — `__fizzpopFakeWin` debug hook set store state but did not emit the `gameWon` bus event, so streak store and sounds would not react. Fixed to emit `bus.emit('gameWon', {...})` after state mutation. Added co-location note: all three debug hooks must live in `src/state/store.ts`.

**PRD 104 (themes-a11y)** — CSS variable inventory existed only as a prose list. Added a complete table of all bubble tokens (`--bubble-1` through `--bubble-6`) for all four theme combinations (light, dark, colorblind, dark+colorblind). `prefers-reduced-motion` handling was described generally; added an exhaustive 11-row table mapping every named animation to its exact reduced-motion fallback (instant snap, omit entirely, static badge, etc.).

**PRD 105 (animations)** — No master animation inventory existed, making it impossible to audit completeness. Added an 11-row table at the top (name, owner component, duration, easing, reduced-motion fallback). `tileDiameter` was hardcoded as `64` inside `startAnimLoop`; replaced with an injectable `getTileDiameter: () => number` parameter so the renderer can pass the live value. `drop` animation used `'#888'` hardcoded; fixed to `job.color ?? '#888888'` with a comment explaining why neutral gray is correct (board state already mutated before animation runs).

**PRD 105 (haptics-sounds)** — Event-to-vibration and event-to-sound mappings were scattered across prose. Consolidated into two explicit tables. `rowAdded` bus event was missing from `initFeedback()` wiring; added `bus.on('rowAdded', () => { haptics.bump(); sound.warn(); })`. `clear` arpeggio condition was ambiguous; pinned to `count >= 5` floaters. Added note that `AudioContext` uses the browser's native sample rate (44100 or 48000 Hz; do not force a specific rate).

**PRD 106 (publish)** — Bundle-budget SQL was entirely absent; added `INSERT OR REPLACE INTO app_budgets` with `max_size_gz_bytes = 307200` (300 KB gz) and full `turso db shell` execution instructions. Registry-flip `category` and `tags` values were unspecified; pinned to `"Game · Arcade"` and `["Game", "Arcade", "Bubble Shooter", "Daily", "Free"]` as confirmation targets. Bare NN cross-reference to `45-mindswiffer-publish.md` replaced with behavior description.

## Cross-PRD Coherence Verified

- Bus event names consistent across all PRDs: `bubbleFired`, `bubbleSnapped`, `clusterPopped`, `floatersDropped`, `rowAdded`, `pityChanged`, `gameStarted`, `gameWon`, `gameLost`, `settingsOpened`, `settingsClosed`.
- Mode names consistent: `'daily' | 'beginner' | 'intermediate' | 'expert'`.
- Zustand hook names consistent: `useRunState()`, `useRunActions()`, `useStreakState()`, `useStreakActions()`.
- Debug hook co-location resolved: `__fizzpopStartBeginner`, `__fizzpopStartDaily`, `__fizzpopFakeWin` → `src/state/store.ts`; `__fizzpopTestState` → `Board.tsx`.
- 2026-05-10: build-validate gate green. typecheck/tests/build/axe/dailies/smoke all pass. Bundle: 218 KB gz.
