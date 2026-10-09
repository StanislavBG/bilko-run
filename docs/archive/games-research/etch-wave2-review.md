# Etch Wave-2 PRD Review

**Reviewed:** 2026-05-10  
**Reviewer:** Claude (Sonnet 4.6)  
**PRDs reviewed:** `110-etch-research-anchor` through `116-etch-publish` (12 files)

---

## Summary

All 12 wave-1 Etch PRDs have been expanded in place. Each PRD is now self-contained enough for a fresh executor to complete it without conversation context. The gaps fell into five categories:

1. **Wrong frontmatter** — two files had broken YAML (`parallelGroup: 106` in engine PRD, spurious `ideas: |-` field in daily-curated PRD). Both fixed.
2. **Missing algorithmic detail** — engine, free-play generator, and state-persistence PRDs lacked pseudocode for their core algorithms. Now inlined.
3. **Missing constants and schemas** — localStorage key table, `SerializedRun` interface, `SIZE_DIMS` usage, cell state machine transitions, and scoring worked example. Now inlined.
4. **Missing CSS + breakpoint specs** — clue responsive breakpoints, sticky clue bars for 20×20, and the full CSS variable table across all 5 themes. Now inlined.
5. **Missing anti-spoiler contract** — hints PRD didn't explicitly forbid `nextHint` from reading `board.solution`. Now an explicit type boundary + test requirement.

---

## File-by-file changes

| File | Gap addressed |
|------|---------------|
| `110-etch-research-anchor.md` | Added section listing 7 etch.md headings downstream PRDs reference (by heading, not line number — paragraph insertion shifts line numbers) |
| `111-etch-bootstrap.md` | Added engine stub note for pre-engine builds; Zustand v5 API note (`create` named import) |
| `112-etch-engine.md` | **Fixed `parallelGroup: 106 → 112`**; inlined cell state machine diagram; inlined `solveLine` Batenburg-Kosters pseudocode with 50k placement cap; difficulty classification table; full scoring worked example (Wed Daily, Intermediate, 9:30, 1 hint, 0 mistakes, streak=3 → 525 total) |
| `113-etch-state-persistence.md` | Inlined all 9 localStorage key names + schema version field; `SerializedRun` interface; `loadFromStorage<T>` pattern; fixed fragile dimension detection to use `SIZE_DIMS[effectiveSize]` |
| `113-etch-ui-board.md` | Inlined long-press threshold config (350ms default, accepts 200/350/500); hover `-1` sentinel derivation; drag batching contract; complete 9-handler input event table; reduced-motion note |
| `113-etch-ui-clues.md` | Inlined mobile/desktop breakpoints (≤479px, 480-767px, ≥768px); sticky clue bar CSS for 20×20 overflow; `--clue-done` token usage for strikethrough |
| `114-etch-daily-curated.md` | **Fixed spurious `ideas: |-` YAML field**; inlined complete 30-image launch seed (2026-05-10 to 2026-06-08) with ASCII previews for hand-drawn Sketch files; difficulty distribution (5 Sketch / 8 Beginner / 4 Intermediate / 4 Tall / 9 Expert) |
| `114-etch-free-play.md` | Inlined generator solver-loop pseudocode (6 steps: construct → reject empty → verify deductive → verify unique → classify → accept); 200-attempt hard cap; ≤200ms performance budget; UI error handling sequence |
| `114-etch-themes-a11y.md` | Inlined 12-variable × 5-theme CSS token switch table; 12-event SR announcement format table; `prefers-reduced-motion` sweep checklist by CSS file |
| `115-etch-animations-haptics.md` | Inlined 9 named animations (duration/easing/trigger/fallback); reveal sequence timing diagram; 8 sound+haptic events (Hz/duration/wave/vibrate pattern); default states (haptics ON, sounds OFF) |
| `115-etch-hints-system.md` | Added anti-spoiler type boundary (`Omit<Board, 'solution'>`); algorithmic purity note (solveLine uses clues + marks, never solution); test coverage requirement for stripped-solution case; aria-live region DOM persistence pattern; exact announcement text for all 4 hint states |
| `116-etch-publish.md` | Inlined bundle-budget SQL (`INSERT OR REPLACE INTO app_budgets`); explicit registry-flip fields (`status`, `launchedAt`, `category: "Game · Puzzle"`, `tags: ["Game","Puzzle","Free","No-guess"]`); explicit `useUnlocks('etch').unlock('first_solve')` wiring with fallback TODO pattern |

---

## Cross-cutting invariants verified

- No PRD references another by NN number — all cross-references use file paths or behavior descriptions.
- All frontmatter has `title`, `cwd`, `estimateMinutes`, `parallelGroup` (matching leading NN).
- All PRDs have sections in order: Goal → Acceptance criteria → Implementation notes → Out of scope.
- `parallelGroup` values: 110 (research), 111 (bootstrap), 112 (engine), 113 (state+board+clues), 114 (daily+freeplay+themes), 115 (animations+hints), 116 (publish).

---

## Wave-2 candidates

The following items were explicitly deferred to "v2" across the PRD chain — each is a self-contained PRD:

| Candidate | Source PRD | Estimated scope |
|-----------|-----------|-----------------|
| Color picross (multi-color cells) | research anchor | Large — new engine type |
| Mega picross (two-puzzle overlap) | research anchor | Large — new layout |
| UGC puzzle submission | research anchor | Medium — server + moderation |
| Adaptive hint cost (expert = free hints) | hints PRD | Small — config change |
| "Show where I went wrong" hint | hints PRD | Small — mistake detection path |
| "Give up / show solution" button | hints + state PRDs | Tiny — surface existing `reveal()` action |
| Cloud save sync | state PRD | Medium — requires Turso row per user |
| Host-kit token upstream (`v0.7.3`) | publish PRD | Small — if host-kit is reachable |
| Triple Threat achievement polish | publish PRD | Small — if cross-game infra generalized |
| Daily seed expansion beyond 30 | daily PRD | Ongoing — editorial |
| Hint history / replay | hints PRD | Medium |
| Cross-game hint pedagogy unification | hints PRD | Large — host-kit upgrade |
| Performance tuning beyond 80 KB budget | publish PRD | Profile first |

Recommended wave-2 priority order: give-up button (unlocks blocked users) → adaptive hint cost → cloud save → host-kit token upstream.
