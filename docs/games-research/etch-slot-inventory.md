# Etch slot inventory — parallel agent conflict-avoidance contract

Each Etch PRD runs as an independent agent in its own Claude session. To avoid two agents creating or overwriting the same file simultaneously, this document is the **single source of truth** for slot ownership. Before writing any file under `src/slots/`, an agent must check this table, confirm the slot is assigned to its own PRD number, and touch no other slot. Agents that need to *import* from another slot do so by interface contract only — they import the slot's exported hook or component, never edit the file.

---

## Slot ownership

| File | Owned by PRD |
|---|---|
| `src/slots/EngineSlot.tsx` | `113-etch-state-persistence` (engine + state Provider) |
| `src/slots/BoardSlot.tsx` | `113-etch-ui-board` |
| `src/slots/CluesSlot.tsx` | `113-etch-ui-clues` |
| `src/slots/HudSlot.tsx` | `113-etch-state-persistence` (timer + difficulty + restart) |
| `src/slots/HintsSlot.tsx` | `115-etch-hints-system` |
| `src/slots/DailySlot.tsx` | `114-etch-daily-curated` |
| `src/slots/ModeSlot.tsx` | `114-etch-free-play` (mode selector + size picker) |
| `src/slots/ThemeSlot.tsx` | `114-etch-themes-a11y` |
| `src/slots/AnimationsSlot.tsx` | `115-etch-animations-haptics` |

---

## Typed event bus channel names

All agents must use these exact channel names and payload shapes when emitting or subscribing to the shared event bus. Inventing alternate names causes silent cross-agent bugs.

| Channel | Payload |
|---|---|
| `cellMarked` | `{ row, col, kind: 'fill' \| 'cross' \| 'clear' }` |
| `cellDragStart` | `{ row, col }` |
| `cellDragEnd` | `{ row, col }` |
| `modeToggled` | `{ primary: 'fill' \| 'cross' }` |
| `hintRequested` | `{ level: 1 \| 2 \| 3 }` |
| `newGame` | `{ mode: 'daily' \| 'free'; size: 'sketch'\|'beginner'\|'intermediate'\|'tall'\|'expert' }` |
| `puzzleSolved` | `{ mode: string; size: string; timeMs: number; mistakes: number; hintsUsed: number; isPersonalBest: boolean }` |
| `puzzleRevealed` | `{ mode: string; size: string }` |
| `unitCompleted` | `{ kind: 'row' \| 'col'; index: number }` |
| `themeChanged` | `{ mode: 'light' \| 'dark' \| 'system'; cb: boolean; hc: boolean }` |
