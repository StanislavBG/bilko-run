# Etch market research + Bilko-Etch design brief

**Implementation status (as of 2026-05-10):** This brief is the source-of-truth for the Etch PRD chain (110–116) currently scheduled in `~/.claude/session-manager/scheduled-plans/prds/`. Sibling repo target: `~/Projects/Bilko-Etch/`. Canonical URL: `bilko.run/projects/etch/`. Five new visual tokens land in `@bilkobibitkov/host-kit` `styles/game-tokens.css`: `--clue-size`, `--cross-mark`, `--clue-done`, `--major-line`, `--reveal-glow`. The "no-guess" guarantee from MindSwiffer transfers to Etch — every puzzle is solvable by line-by-line deduction at its declared difficulty.

Reference doc that grounds the Etch PRD set (47–52, TBA). Read this before picking up any of those PRDs — it's the "why" behind every UI choice. Every subsequent PRD references this file, not the internet.

Etch is the Bilko-house re-implementation of the **nonogram** (a.k.a. Picross, Griddler, Hanjie, Paint-by-Numbers): a logic puzzle where the player fills cells in a grid using row and column digit-clues until a hidden pixel picture emerges. It is the third entry in the Bilko Game Studio after [Sudoku](../sudoku-research.md) and [MindSwiffer](../mindswiffer-research.md), and the first one whose end-state is a *picture*, not a number grid.

Slug: **etch**. Canonical URL: `bilko.run/projects/etch/`. Sibling repo: `~/Projects/Bilko-Etch/`.

---

## TL;DR

1. **What it is:** A pure-logic nonogram. Row and column clues describe runs of filled cells; the player deduces which cells are filled vs. blank until a pixel picture is revealed. Five sizes (5×5 to 20×20), classic mono-color rules, daily puzzle, streak, calendar archive.
2. **Why it's the right pick:** Mario's Picross (1995, Game Boy) gives us a defensible 1995–2005 era anchor with NP-complete depth, well-documented constraint-propagation generators, hand-curatable taste at small sizes, and a finish-state that makes a *very good Wordle-style share tile*. It is the most logic-deduction-rich genre after Sudoku and Sweeper that we have not yet shipped.
3. **The Bilko twist:** A **unique-solution-by-deduction guarantee** (every Etch puzzle is solvable line-by-line with no backtracking — i.e. no probing/no guessing — at its declared difficulty), plus a **hand-curated Daily picture** that is a small Bilko-flavored pixel scene rather than another generic smiley/cat/duck. The same "no-guess" promise that anchors MindSwiffer, applied to a different genre.

---

## The original (cited)

Nonograms were invented twice in 1987, almost simultaneously, in Japan. **Non Ishida**, a Tokyo graphics editor, won a Tokyo Building Skyscraper Lights competition by designing pictures that would appear when specific office windows were lit; she then formalized the underlying grid-filling task into a paper puzzle. Independently, professional puzzle designer **Tetsuya Nishio** invented the same puzzles in another magazine the same year. Ishida published three "Window Art Puzzles" in 1988, met UK puzzle collector **James Dalgety** soon after, and Dalgety coined the name "**nonogram**" — "Non" (the inventor) + "gram" (diagram) — and brokered weekly publication in *The Sunday Telegraph* starting in 1990. *The Sunday Telegraph* later (1998) ran a reader competition to rebrand the puzzles, and the winning name was "**Griddlers**", which is why English-speaking communities still split between the two terms ([Wikipedia: Nonogram](https://en.wikipedia.org/wiki/Nonogram); [PlayPicross — Nonograms history](https://playpicross.com/en/blog/nonograms-history/); [Puzzle Museum — Griddlers history](https://www.puzzlemuseum.com/griddler/gridhist.htm); [NinjaPuzzles — Origins of Nonograms](https://ninjapuzzles.com/writing/the-fascinating-origins-of-nonogram-puzzles/)).

The puzzle's video-game lineage starts at our era anchor: **Mario's Picross** for Game Boy, developed by Jupiter Corp. and Ape Inc., published by Nintendo on March 14, 1995 in Japan and August 1995 elsewhere. Nintendo trademarked the name "**Picross**" — short for "picture crossword" — and shipped 256 puzzles split into four courses, with Mario chiseling cells like an archaeologist excavating a pixel fossil ([Wikipedia: Mario's Picross](https://en.wikipedia.org/wiki/Mario%27s_Picross); [MobyGames: Mario's Picross](https://www.mobygames.com/game/6033/marios-picross/)). Despite poor English-language sales (only Japan got the immediate sequels, *Mario's Super Picross* and *Picross 2*), the franchise endured: **Picross DS** (2007) was the first international Picross release in twelve years and resurrected the brand ([Wikipedia: Picross](https://en.wikipedia.org/wiki/Picross); [Wikipedia: Picross DS](https://en.wikipedia.org/wiki/Picross_DS)). From there Picross became Nintendo's quiet steady-eddie franchise — *Picross 3D* (2010), the *Picross e* series (3DS, 2013–2017), and the *Picross S* series (Switch, 2017–today, eight entries and counting), all developed by Jupiter — proving the genre is a permanent shelf-stable casual category that never had its own *Wordle moment* on the open web ([Wikipedia: Picross S](https://en.wikipedia.org/wiki/Picross_S); [Wikipedia: Picross 3D](https://en.wikipedia.org/wiki/Picross_3D)). The puzzle's computational backbone is equally well-attested: solving general nonograms is **NP-complete** ([Wikipedia: Nonogram — Computational complexity](https://en.wikipedia.org/wiki/Nonogram#Computational_complexity)), but constraint-propagation solvers (notably the **Batenburg & Kosters** "combining relaxations" approach, 2009) make small-grid generation, uniqueness checking, and difficulty grading tractable in practice ([Batenburg & Kosters 2009 — Solving Nonograms by combining relaxations](https://homepages.cwi.nl/~kbatenbu/papers/bako_pr_2009.pdf); [Constructing Simple Nonograms of Varying Difficulty (Leiden)](https://liacs.leidenuniv.nl/~kosterswa/constru.pdf); [Rosetta Code — Nonogram solver](https://rosettacode.org/wiki/Nonogram_solver)).

---

## Top 8 modern implementations surveyed (2026)

Sourced from current iOS App Store, Play Store, Steam, and major web nonogram clients, plus reference to long-running titles. **Six features** per app — the ones that show up most prominently in their UX or that are worth stealing / refusing.

### 1. Pixelogic — Studio Okayest

The reference Apple-leaning nonogram app; iOS / Android / web. Subscription (Pixelogic+) on top of a generous free tier. ([pixelogic.app](https://pixelogic.app/); [App Store: Pixelogic](https://apps.apple.com/us/app/pixelogic-daily-nonograms/id318667196))

1. **6,000+ logic-only puzzles** spanning easy → expert with a guarantee that every puzzle has a unique deductive solution.
2. **Two new daily puzzles every day** with persistent worldwide statistics and a multi-year archive (older years are a paid unlock).
3. **Built-in puzzle creator** with an integrated solvability checker — players can submit puzzles for inclusion as community dailies.
4. **Calm monetization**: no constant ads, no third-party privacy tracking; free play with a daily-play cap, removed by Pixelogic+ subscription.
5. **First-class dark mode and customization** — colors, fill style, cross style, click-vs-drag behavior all toggleable.
6. **Cross-platform sync** — start on phone, finish on web, history preserved.

### 2. Nonograms Katana — ucdevs

Long-running Android-first community client; iOS, Android, Amazon, web. ([nonograms-katana.com](https://nonograms-katana.com/); [Play Store: Nonograms Katana](https://play.google.com/store/apps/details?id=com.ucdevs.jcross); [App Store: Nonograms Katana](https://apps.apple.com/us/app/nonograms-katana/id1037710023))

1. **1,001 free puzzles** sorted from 5×5 to 50×50, every one **machine-verified for unique solutions** ("logically solvable without guessing").
2. **Both monochrome and colored** nonograms in the same app; difficulty does not depend on color count.
3. **User-generated puzzles** with a community share/submit pipeline, plus the tools to build your own and check solvability locally.
4. **Power-user assists**: auto-cross-out completed numbers, auto-fill of trivially-determined lines, multiple cell-mark glyphs (cross / dot / circle), undo/redo, lockable number bars.
5. **15 free hints per puzzle** by default; VIP subscription bumps to 20 and adds a "view answer" escape hatch.
6. **Cloud save + achievements + leaderboards** — best times tracked per puzzle, not per difficulty.

### 3. Nonogram.com — Easybrain

The Easybrain casual-game treatment of nonograms (same publisher as Sudoku.com), free with ads, $4.99/mo or lifetime to remove. ([Play Store: Nonogram.com](https://play.google.com/store/apps/details?id=com.easybrain.nonogram))

1. **Six difficulty buckets** — fast / easy / medium / hard / expert / master — paralleling the Sudoku.com hierarchy.
2. **Daily Challenge calendar** with one puzzle per day; calendar archive is browsable, missed days are recoverable for a "ticket" cost.
3. **Seasonal events with collectible trophy art** — limited-time event puzzles award a themed badge that lives in a trophy room.
4. **Mistake counter as a soft fail-state** — three wrong fills = game over for the run, must restart.
5. **Pencil-mark assistant** — once a row's run is satisfied, the row's clue numbers are auto-grayed; once a column is exhausted, ditto.
6. **Cross-device sync** via Easybrain account; phone / tablet / web all share state.

### 4. Picross S series — Jupiter (Nintendo Switch)

The current commercial flagship; Picross S1 (2017) through Picross S9+ (2024+), all by the original Jupiter studio. ([Wikipedia: Picross S](https://en.wikipedia.org/wiki/Picross_S))

1. **Five modes per release** — Picross (mistake-penalty mode), Mega Picross (multi-row clues), Color Picross, Clip Picross (a single mega-puzzle assembled from many small ones), and Time Attack.
2. **High-contrast color palette toggle** for Color Picross — added in Picross S5 specifically for color-vision-deficient players, now standard.
3. **Mistake penalty** in classic mode: the timer jumps forward (originally 2 / 4 / 8 minutes per error in Picross DS; tuned per release).
4. **Free Mode opt-in** for veterans — no error feedback, no penalties, "find your own mistakes."
5. **Multiplayer co-op** (added in Picross S8) — up to 4 players sharing a single puzzle on a single screen.
6. **Joy-Con 2 mouse support** (Picross S on Switch 2) — pixel-level pointer for large grids.

### 5. Picross DS — Jupiter / Nintendo (2007)

Original-recipe nonogram on the touchscreen. The reference for "what mobile nonograms feel like" before mobile phones got good. ([Wikipedia: Picross DS](https://en.wikipedia.org/wiki/Picross_DS))

1. **Normal Mode with escalating mistake penalty** — first wrong fill +2 minutes, second +4, third +8.
2. **Free Mode** with no penalties — generally used for harder puzzles where guessing-by-process-of-elimination would be punished too harshly in Normal.
3. **Daily Picross** — five 7×7 puzzles per day with a 5-second-per-mistake penalty, the first "daily nonogram" in a commercial product.
4. **Hint button** — reveals one full row and one full column for free, no time penalty; can only be invoked once per puzzle.
5. **Grid sizes 5×5 → 25×20**, unlocked progressively in groups of 15 puzzles.
6. **DS download play + custom-puzzle sharing** — players could build a grid and beam it to a friend's DS.

### 6. Puzzle-nonograms.com — Puzzle Madness

The "minimal-chrome web" nonogram client; ad-supported with Patreon/ad-removal upsell. The desktop-keyboard reference. ([puzzle-nonograms.com](https://www.puzzle-nonograms.com/))

1. **5×5 through 25×25** grid sizes, organized as static categories (no procedural difficulty bucketing).
2. **Special Daily, Weekly, and Monthly puzzles** — three retention cadences instead of one.
3. **Drag-to-fill / drag-to-cross** input on desktop, very fluid for large grids.
4. **Coordinate helper overlay** — column letters and row numbers along the edges, toggleable, helpful on 25×25 boards.
5. **Hall of Fame leaderboard per puzzle** — solve time ranked among other site users.
6. **Localized into 30+ languages** but functionally one product everywhere.

### 7. Griddlers.net — iGridd / Griddlers Team

The longest-running nonogram community; 290,000+ user-created puzzles, browser-only, ad-supported with subscription. ([griddlers.net](https://www.griddlers.net/home))

1. **Massive UGC pool** — 293k+ user puzzles plus the daily Griddler-of-the-day curated by the team.
2. **Many variants** — classic, multi-color, triangular ("triddler"), B/W with edge clues, multi-puzzle composite scenes.
3. **Community rating system** — players score puzzle quality and composition, surfacing the best UGC over time.
4. **Per-user solve history and stats**, exportable; the community's competitive backbone.
5. **Tournament events** — timed group competitions on a rotating schedule.
6. **Visual aesthetic firmly stuck in 2008** — dense info grid, table layouts, browser-default fonts; the *opposite* of Apple-grade.

### 8. Picross 3D / Picross 3D: Round 2 — HAL Laboratory / Jupiter (2010 / 2016)

Adjacent-genre reference: Picross taken to three dimensions. Sculpture instead of painting. ([Wikipedia: Picross 3D](https://en.wikipedia.org/wiki/Picross_3D))

1. **Cube-axis hints** — each row of a cubic block has hint counts on the X, Y, and Z axes; player chips away cubes to reveal a 3D model.
2. **Two-tool input**: chisel (definitely-empty) vs. paint (definitely-full), with a mistake counter.
3. **365+ puzzles** — explicitly framed as "one a day for a year."
4. **Tool-mode toggle as a gesture** rather than a separate button — proved tap+modifier works on touch.
5. **Round 2 (2016) added colored blocks** that transform into curved/cut shapes when filled — proved players accept *additional* clue dimensions if introduced gradually.
6. **"Construction mode"** lets players design their own 3D models with a built-in solvability checker — same UGC pattern as Pixelogic.

---

## Synthesized feature catalog

Every recurring feature, grouped. **Bold** = in scope for Etch v1. *Italic* = explicitly deferred.

### Core gameplay

- **Rectangular grid** with row clues at the left and column clues at the top (numbers represent runs of consecutive filled cells, in order, separated by at least one empty cell)
- **Five fixed grid sizes**: 5×5 (Sketch), 10×10 (Beginner), 15×15 (Intermediate), 15×20 (Tall), 20×20 (Expert)
- **Two cell states the player marks**: filled (black) or crossed-out (definitely empty, "X")
- **Three physical cell states overall**: unmarked, filled, crossed-out
- **Drag-to-fill** and **drag-to-cross** for fast bulk editing
- **Auto-cross-completed-clues**: when a row's run is fully satisfied, its clue numbers gray out (Easybrain pattern)
- **Auto-cross-completed-line**: when a row is fully solved, its remaining unmarked cells auto-X (Katana pattern, optional toggle)
- **Undo / redo** with unlimited per-puzzle history
- *Colored nonograms (multi-color)*
- *Mega Picross (multi-row clues, Picross S Mega mode)*
- *Triangular / hex grids (Griddlers Triddler)*
- *3D Picross (HAL territory, hard to do in <300KB)*

### Hints & teaching

- **Hint button (one per puzzle, free)** — reveals one fully-correct row + one fully-correct column at the player's choice; consumed permanently
- **Three-tier hint progression** (mirroring Sudoku/MindSwiffer):
  1. Highlights a deducible line (row or column) where progress is currently available
  2. Names the technique (e.g. "overlap", "forced-edge", "completed-clue")
  3. Reveals the next single deducible cell
- **Mistake counter as soft fail-state** — configurable: off / 3 / 5 strikes, default off (Etch defaults to "find your own mistakes" because the puzzle is *deterministic*: a bad fill propagates contradictions you'll find anyway)
- **Solver-verified line check (post-solve)** — on completion, the engine confirms the puzzle had a unique deductive solution at the declared difficulty (transparency / build trust)
- *Inline tutorial campaign on technique names*
- *Auto-fill-trivial (Katana's auto-fill of forced lines without player consent)* — explicitly rejected in the design rules below

### Daily + retention

- **Daily puzzle, deterministic from the date** — every player gets the same grid that day
- **Day-of-week difficulty ramp** — Mon = Sketch, Tue–Wed = Beginner, Thu = Intermediate, Fri = Tall, Sat–Sun = Expert (mirrors Good Sudoku and MindSwiffer)
- **Streak counter** with one weekly freeze (mirrors Sudoku PRD 38)
- **Calendar archive** — play any past daily; missed dailies don't break streak retroactively but can be solved for personal completion
- **Wordle-style share tile** — completed image rendered as a small grid of squares + the date + the time, sharable via the platform Web Share API
- *Seasonal event puzzles*
- *Tournaments*

### Curation & content

- **Hand-curated Daily picture set** — the daily puzzle's pixel art is selected from a curated library of ~365 Bilko-flavored scenes (one year's worth at launch); generator does the cell construction, but the *image* is hand-picked
- **Procedurally-generated practice puzzles** — non-daily Free Play uses a constraint-propagation generator with uniqueness verification (no human curation required)
- *User-generated puzzles*
- *Puzzle creator with solvability checker*

### Statistics + achievements

- **Per-difficulty: best time, average time, win rate, total wins**
- **Total puzzles solved, total cells filled, total time played**
- **Streak, longest streak, dailies completed**
- **Achievements via PRD 30 platform game services** — first solve, sub-1-min Sketch, sub-5-min Beginner, 7-day daily streak, all-five-sizes-in-a-day, "no-hints" 20×20 expert, cross-game "Triple Threat" (1 Sudoku + 1 MindSwiffer + 1 Etch)
- **Leaderboards via PRD 30** — per-difficulty best times + daily shared board

### Persistence

- **Auto-save current puzzle; resume on launch**
- **Per-user save sync** via PRD 30 game services (one save slot for in-progress + per-difficulty stats)
- **Local-first; cloud opt-in** when signed in

### Visual & feel (Apple-grade)

- **Hairline grid lines** — `--grid-line-thin` between cells; `--grid-line-thick` for outer border and 5-cell major grid lines (every 5 cells along both axes, classic nonogram convention for visually parsing larger grids)
- **Filled cell** uses `--ink` with the existing `--cell-radius` for a tiny rounding (matches Sudoku/MindSwiffer)
- **Crossed cell** renders an `X` glyph in a muted ink-mix tone, never a colored highlight
- **Clue numbers** use the existing `--mark-font`, sized at `--clue-size` (a new token, see below)
- **Active row + column highlight** — a `--cell-peer` tint on the row and column of whichever cell the cursor or last-tap is on; helps players track which clue they're working on
- **Completed-clue fade** — once a row's clues are satisfied, the clue numbers fade from `--ink` to a muted ink-mix tone
- **Reveal animation** — on solve, the cross-marks fade out at `--duration-fade`, leaving only the picture; then the picture's bounding box pulses once at `--spring-fast` / `--duration-win`
- **Confetti only on personal best** — same rule as MindSwiffer; a normal solve gets a quiet check, a PB gets confetti
- **Reduced-motion respects system setting**

### Input

- **Tap to fill, long-press to cross** (mobile default)
- **Mode-toggle button** in the action strip — one tap switches "tap = fill" ↔ "tap = cross", solving the long-press-delay annoyance for power users (Minesweeper Q / iSweeper pattern)
- **Drag from any cell** continues the same mark across the dragged path (fill or cross, whichever the start cell became)
- **Two-finger swipe** to scroll on grids that exceed viewport (only ever the case on 20×20 in landscape on small phones)
- **Keyboard: arrow keys move the cursor; Space fills; X crosses; Z undoes; Y redoes; H requests hint; R restarts**
- **No swipe-to-undo gesture** — too easy to trigger accidentally during drag-fill

### Platform integration

- **Hosted at bilko.run/projects/etch/** as static-path sibling
- **Brand chrome** via `@bilkobibitkov/host-kit` `<GameShell>` (eyebrow, title, theme, footer)
- **Free, no ads, login-optional**
- **Analytics via `/api/analytics/event`** (same-origin, PRD 27)
- **Cross-game "Triple Threat" achievement** — solves at least 1 Sudoku + 1 MindSwiffer + 1 Etch on the same Bilko account

---

## Difficulty bracket table

| Name | Grid | Max clue length | Target solve time | Generator constraint | Notes |
|---|---|---|---|---|---|
| **Sketch** | 5 × 5 | 5 | < 90 s | Single-pass deduction (no overlap technique required) | First-time players; the "ahh I get it" tutorial size |
| **Beginner** | 10 × 10 | 8 | 3–6 min | Overlap + forced-edge only | Casual; a coffee-break game |
| **Intermediate** | 15 × 15 | 12 | 8–15 min | Overlap + forced-edge + completed-clue elimination | The default Daily on Wed |
| **Tall** | 15 × 20 | 14 | 12–20 min | Same as Intermediate, larger search | Phone-friendly portrait orientation |
| **Expert** | 20 × 20 | 18 | 18–35 min | All techniques up to 2-line constraint propagation; never requires lookahead | The Sat/Sun daily; "no-guess" promise applies |
| **Daily** | scales | scales | scales | All-no-guess | Mon = Sketch, Tue–Wed = Beginner, Thu = Intermediate, Fri = Tall, Sat–Sun = Expert |

The **no-guess constraint applies to every difficulty**, including Free Play. Etch will never ship a puzzle that requires a player to make a tentative fill and check for contradictions ("probing") to solve; the engine refuses to publish such a puzzle. This is the equivalent of MindSwiffer's no-guess Minesweeper guarantee, applied to a different genre.

---

## Bilko-Etch design philosophy

Distilled into 5 rules. Every PRD acceptance criterion ties back to one of these.

### 1. The hidden picture is the reward, not a level prop

The generator does not commit to a picture *first* and then build a puzzle around it. That path leads to puzzles that are unsolvable without guessing (because the picture isn't logic-friendly) or to boring puzzles (because the picture is a 50/50 dot field). Instead: the **Daily image** is hand-picked from a curated library of pre-validated logic-friendly Bilko pixel scenes; **Free Play images** are emergent — the generator constructs a puzzle that is provably solvable by deduction, then *whatever picture comes out*, comes out. The reward of solving is the moment the picture resolves; it does not have to be a duck. (Many of the best Picross DS puzzles are abstract patterns.)

### 2. No auto-fill the player did not ask for

Nonogram apps love to "help" by auto-filling forced lines once the player satisfies a row. Etch refuses this by default. The auto-cross-completed-clue (gray out the *clue number* once it's satisfied) is on by default because it does not change the board state; the auto-fill (placing X marks the player did not type) is a per-user preference, off by default. Reason: the player is *playing* the puzzle, and the joy of nonograms is the moment your eye sees the next deducible mark. Don't steal that.

### 3. Restraint over skeuomorphism

No 1995 Game Boy chrome. No Mario chiseling. No "+2:00" floating digit when you misclick. Hairline grid lines, system font, the same `--ink`/`--paper` token system the other Bilko games use. The 5-cell major grid lines are a classic nonogram visual aid (every commercial product has them) and are the *only* visual chrome we add beyond the cell grid itself. The game looks like it was designed in 2026, not skinned on top of a 1995 .gb ROM.

### 4. Honest about what the player needs to know

The hint system is three-tier (highlight line → name technique → reveal cell). Etch teaches the technique vocabulary: "overlap" is the cornerstone (a row's clue is wider than half the line, so the middle is forced); "forced-edge" is when a clue starts close enough to an edge to determine the first cell; "completed-clue" is when remaining cells in a line must be empty because the clue total + gaps fits exactly. Every hint at level 2 names the technique. Pulled from Good Sudoku's pedagogy.

### 5. No dark patterns

No "watch an ad to keep your streak." No "buy 3 hints for $0.99." No timed offers. No streak-anxiety push notifications. No leaderboard FOMO banners. Etch is free, calm, and ad-free. The bilko.run host pays its bills via the paid tools; Etch's job is to be good.

---

## Mechanics spec

The full game-state and rule machine. All numbers cited.

### Board and clue model

A puzzle is a tuple **(W, H, R, C)** where W is width in cells, H is height in cells, R is the list of H row clues (each clue is an ordered list of positive integers — the lengths of the runs of filled cells in that row, left-to-right), and C is the list of W column clues (each an ordered list, top-to-bottom). Empty rows / columns get the clue `[0]` rendered as a single `0`. The solution is a binary matrix S ∈ {0,1}^(H×W) such that for every row i, the maximal runs of 1s in S[i] equal R[i] in order, and likewise for every column.

Cell display states:
- `.` unmarked (initial)
- `■` filled (player's `1`)
- `×` crossed-out (player's commitment to `0`)

Crossed and filled are mutually exclusive; either can be reverted to unmarked via undo or by re-tapping in the appropriate mode.

### Generator algorithm

The generator runs in three phases: **construct**, **verify**, **classify**. The total budget per puzzle generation is ≤ 200 ms on a mid-range mobile (target measured on a 2022 Pixel 6a in Chrome).

**Construct (random for Free Play; load-from-library for Daily):**
- For Free Play: sample a random binary matrix S of the requested size with target fill density d ∈ [0.40, 0.55] (the well-attested sweet spot for "interesting" nonograms; cited at MiniWebtool generator and corroborated by Pixelogic's own writeup of their 5×5 enumeration).
- For Daily: load a pre-validated S from the curated library, indexed by `(date.toISOString().slice(0,10), difficulty)`.
- Compute R and C by scanning runs.

**Verify (uniqueness + deductibility, both required):**
- Run the in-house solver — a Batenburg-Kosters style line-solver that does per-line constraint propagation (compute the set of all valid fillings for one line consistent with its clues, intersect them to determine forced cells), repeated until no line yields new information ([Batenburg & Kosters 2009](https://homepages.cwi.nl/~kbatenbu/papers/bako_pr_2009.pdf)).
- If the solver completes the board with **no backtracking required**, the puzzle is *deductive* (the no-guess promise is satisfied).
- If the solver gets stuck, the puzzle is rejected (Free Play: regenerate; Daily: error and fall back to the previous day's puzzle, since the curated library should not contain unsolvable puzzles).
- A second pass with a slow-but-complete backtracking solver verifies **uniqueness** (only one S satisfies the clue set). If multiple solutions exist, the puzzle is rejected.

**Classify (assign difficulty to Free Play puzzles):**
- Track the *most advanced technique* the line-solver had to invoke to make progress at any step.
- Sketch: only "completed-clue" or "trivially-full-line" needed.
- Beginner: also requires "overlap" and "forced-edge".
- Intermediate: also requires "completed-clue elimination" (when a clue's runs fit only one way given existing marks).
- Tall / Expert: also requires multi-line constraint propagation (one line's fills determining marks across multiple other lines via column-then-row interplay).
- A puzzle is classified at the lowest difficulty whose technique set is sufficient.

**Solver guarantees (precise wording for the marketing copy):** Every Etch puzzle has exactly one solution and is solvable by line-by-line deduction at its declared difficulty. No puzzle requires you to make a tentative fill and check for contradictions ("probing" or "guess-and-check"). If you ever feel forced to guess, you missed a deduction — open a hint.

### Scoring formula

Score per solved puzzle = `base × difficulty × pace × hint_factor × no_mistake_factor`, rounded to the nearest 10.

- `base = 100`
- `difficulty = { Sketch: 1, Beginner: 2, Intermediate: 4, Tall: 5, Expert: 8 }`
- `pace = clamp(target_time / actual_time, 0.5, 2.0)` — solving in half target time doubles the pace bonus; solving in twice target halves it; floor at 0.5 prevents zero-scoring
- `hint_factor = 1.0 - 0.1 × hints_used` (each hint = 10% reduction; first hint is the "free" row+column reveal which counts as one hint use)
- `no_mistake_factor = 1.05` if mistakes_made == 0, else 1.0
- Daily puzzles award the same score as a regular puzzle of the matching difficulty, plus a flat **+50 daily bonus** and **+25 streak bonus per consecutive day** (uncapped — the bonus IS the streak motivation).

### Win / lose conditions

- **Win:** every cell in S that is `1` is marked filled, and no cell that is `0` is marked filled. Crosses on `0` cells are not required for win — Etch will silently auto-X any `0` cells that remain unmarked at the moment of win, as a courtesy. (Some apps require explicit X on every empty cell to win; we don't.)
- **Soft lose (mistake mode on, default off):** the configurable mistake counter reaches its limit (3 or 5). The board does not reset; the player can choose to continue (no further wins this session) or restart.
- **No hard lose by default.** Without mistake mode, the player simply solves the puzzle, however slowly and with however many hints.
- **Reveal-on-give-up:** a "show solution" button is always available, but once tapped, the puzzle is marked `revealed` (does not count toward stats, daily streak, or score, but unlocks the picture so the player isn't held hostage by curiosity).

### Level progression

There is no level-unlock gating. All five sizes are available from the first launch. The Daily is always available. New Free Play puzzles generate on demand at the difficulty the player picks. (We deliberately reject the Picross DS / Pixelogic "unlock progressively in chapters" model — that's a console-game holdover that doesn't match casual web behavior.)

### Edge cases catalog

- **Empty row / column:** clue is rendered as `0` (single character) in the clue bar. The generator avoids these in puzzles ≤ Beginner because they make small grids trivial; they are permitted in Intermediate+ where they create useful "must be all empty" deductions.
- **Single-run row that fills the line:** the entire row is forced from the start; the line-solver fills it in pre-pass. This is a valid deductive step, just degenerate.
- **Clue-line longer than the visible bar:** at 20×20 a clue could in principle be `[1,1,1,1,1,1,1,1,1,1]` (10 numbers stacked above one column). The clue bar is sized to accommodate the maximum-length clue for the current grid, computed at generation time, with a minimum of 6 stacked numbers on the column bar and 4 on the row bar.
- **Drag across mode-toggle:** if the player starts a drag in fill mode and hits the mode-toggle button mid-drag, the drag commits to fill (start state wins). Mode-toggle is ignored mid-gesture.
- **Drag from a `1`-correct cell into a `0`-correct cell:** the drag fills both cells. The `0`-correct fill counts as a mistake (if mistake mode is on); the `1`-correct fill is correct. Drag does not pre-validate.
- **Conflicting fill on a known-correct crossed cell:** if the player has already crossed cell (i,j) and then taps it in fill mode, the cross is removed and the cell becomes filled. If that fill is incorrect, mistake counter increments.
- **Auto-X on win:** silent, instant, no animation; we don't want the win moment to be drowned out by 200 cells flipping at once. The picture's reveal animation overlays the board immediately.
- **First-tap-on-fresh-puzzle:** no special treatment (unlike MindSwiffer's safe-first-click). Nonograms have no hidden-mine equivalent; the first tap is just a tap.
- **Hint requested on already-solved row/column:** hint reveals a *different* row/column where progress is available. If no progress is available anywhere (i.e. the puzzle is fully determined and just needs the player to fill the rest), level-3 hint reveals a single cell.
- **Resume a Daily that's mid-solve when a new day rolls over (00:00 in user's local TZ):** the in-progress Daily completes for *yesterday's* date and counts toward yesterday's streak slot. The new Daily appears on the home screen but the old one stays openable until won, lost, or revealed. Streak bookkeeping uses `daily_completed_for_date`, not "completed today".
- **Solver bug fallback:** if the verification solver ever rejects a curated Daily image (should never happen, library is pre-validated), the engine logs an analytics event `etch.daily.curated_rejected` with the date and falls back to the previous day's puzzle for today as well. Telemetry alerts on this.
- **Two players race to share-tile post:** the share tile is local-only; nothing prevents two players from posting it. There's no leaderboard race for "first to share."
- **Date math edge cases (leap day, DST):** the daily key is `YYYY-MM-DD` in the user's local timezone, derived from `Intl.DateTimeFormat().resolvedOptions().timeZone`. A player traveling across timezones can in principle play "today" twice (once in each tz); the streak bookkeeping accepts the first completion per date and ignores duplicates.

---

## Visual specs

Etch consumes the following tokens from `@bilkobibitkov/host-kit/styles/game-tokens.css` (the canonical token set introduced in PRD 40 for MindSwiffer; verified against `~/Projects/Bilko-Sudoku/node_modules/@bilkobibitkov/host-kit/styles/game-tokens.css`). **Five new tokens** are introduced for nonogram-specific surfaces; they are added to the host-kit token sheet, not redefined locally.

### Tokens reused from host-kit

| Token | Used in Etch for |
|---|---|
| `--paper` | Board background, page background |
| `--ink` | Filled cell color, clue text |
| `--grid-line-thin` | Cell-to-cell dividers (1 px) |
| `--grid-line-thick` | Outer board border + 5-cell major grid lines (2 px) |
| `--grid-color-thin` | 1-px grid line color (12% ink mix) |
| `--grid-color-thick` | 2-px grid line color (36% ink mix) |
| `--cell-radius` | Filled-cell corner rounding (2 px) |
| `--grid-radius` | Outer board corner rounding (12 px) |
| `--mark-font` | Clue digit font (system rounded sans) |
| `--mark-given` | Clue digit weight (600) |
| `--cell-peer` | Active-row / active-column tint |
| `--conflict` | Mistake-fill highlight (when mistake mode is on) |
| `--spring-fast` | Reveal pulse, clue fade |
| `--spring-medium` | Mode-toggle transitions |
| `--duration-tap` | Single-cell fill animation (120 ms) |
| `--duration-fade` | Cross fade-in / clue gray-out (220 ms) |
| `--duration-win` | Reveal pulse on solve (720 ms) |

### New tokens introduced for Etch (added to host-kit `game-tokens.css`)

| Token | Default value | Dark-mode value | Used for |
|---|---|---|---|
| `--clue-size` | `clamp(10px, 2.4vmin, 16px)` | (same) | Clue digit font size; smaller than `--mark-size` because clues stack vertically/horizontally |
| `--cross-mark` | `color-mix(in oklch, var(--ink) 32%, transparent)` | `color-mix(in oklch, var(--ink) 36%, transparent)` | The `×` glyph color for player-marked empty cells; muted so filled cells dominate visually |
| `--clue-done` | `color-mix(in oklch, var(--ink) 28%, transparent)` | `color-mix(in oklch, var(--ink) 32%, transparent)` | Color for clue digits whose run has been satisfied; fades out without disappearing |
| `--major-line` | `var(--grid-color-thick)` | (same) | Color for the 5-cell major grid lines (alias of `--grid-color-thick`, kept distinct in case we ever want to differentiate) |
| `--reveal-glow` | `color-mix(in oklch, var(--entered) 18%, transparent)` | `color-mix(in oklch, var(--entered) 24%, transparent)` | The pulse color around the picture frame on solve |

That's five, the maximum we promised ourselves. None of the existing tokens needed overrides.

### Cell sizing

- Cell side length is computed from the available board width: `cell_size = floor((board_width - (grid_lines + clue_bar_width)) / W)`.
- Minimum cell size: 14 px (any smaller and tap targets fail WCAG AA touch target — 24×24 effective with padding).
- Maximum cell size: 36 px (any larger and 5×5 puzzles waste screen).
- On 20×20 in landscape on a 360-px-wide phone, cell size hits the 14-px minimum; the board overflows horizontally and the player two-finger-pans. The clue bar stays sticky to the top/left.

### Animation timings

| Event | Duration | Easing | Reduced-motion fallback |
|---|---|---|---|
| Cell fill (tap or drag) | `--duration-tap` (120 ms) | `--spring-fast` | Instant |
| Cell cross | `--duration-tap` (120 ms) | `--spring-fast` | Instant |
| Clue gray-out (run satisfied) | `--duration-fade` (220 ms) | `--spring-medium` | Instant |
| Mistake highlight (mistake mode on) | 600 ms (300 in, 300 out) | `--spring-medium` | Single 200ms color flash |
| Reveal pulse on solve | `--duration-win` (720 ms) | `--spring-fast` | Single fade-in of picture frame, no pulse |
| Confetti on personal best | 1.6 s | (canvas-driven physics) | Not shown |

All transitions respect `@media (prefers-reduced-motion: reduce)` and degrade to the fallback column. Confetti is suppressed entirely under reduced-motion.

### Color palette summary

Etch is **monochrome by design**. There is no per-clue color, no per-row palette, no rainbow theming. Filled cells are `--ink`, empty cells are `--paper`, crosses are `--cross-mark`. The active row/column highlight is a faint `--cell-peer` tint. The only color in the game is the `--reveal-glow` pulse on solve. Dark mode swaps `--ink` and `--paper` automatically via the host-kit dark-mode block. Color-vision-deficient players have no accessibility issues because color is never load-bearing.

---

## Layout (mobile-first ASCII)

```
┌─────────────────────────────────────┐
│  Bilko · Etch                  ⚙    │  ← GameShell chrome (host-kit, slim)
├─────────────────────────────────────┤
│  Beginner · 02:14 · ↺  · 10×10      │  ← HUD strip
│  (difficulty)(timer)(restart)(size)
│                                     │
│           ┌─────────────────┐       │
│           │ 2 1 3 4 1 2 5 1 │       │  ← column clues (max 6 stacked)
│           │ 1 3   2 1 3   2 │       │
│           │     1 1   1 2   │       │
│           │       1     1   │       │
│  ┌──────┐ ├─┬─┬─┬─┬─┬─┬─┬─┬─┤       │
│  │ 3 1  │ │■│×│■│■│■│×│×│■│×│■│     │
│  │ 1 4  │ ├─┼─┼─┼─┼─┼─┼─┼─┼─┤       │
│  │ 5    │ │×│×│■│■│■│■│■│×│×│×│     │
│  │ 2 2  │ ├─┼─┼─┼─┼─┼─┼─┼─┼─┤       │  ← row clues (left) +
│  │ 1 1 1│ │■│×│■│ │ │×│■│×│ │×│     │     board (right)
│  │ 4    │ ├─┼─┼─┼─┼─┼─┼─┼─┼─┤       │
│  │ 2 3  │ │ │ │ │ │ │ │ │ │ │ │     │
│  │ 1 2  │ ├─┼─┼─┼─┼─┼─┼─┼─┼─┤       │
│  │ 3    │ │ │ │ │ │ │ │ │ │ │ │     │
│  │ 5    │ ├─┼─┼─┼─┼─┼─┼─┼─┼─┤       │
│  └──────┘ │ │ │ │ │ │ │ │ │ │ │     │
│           └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘     │
│                                     │
│  [ Mode: FILL ]   [ Hint ]   [↶][↷] │  ← action strip
│                                     │
│  Made by Bilko · bilko.run          │  ← GameShell footer
└─────────────────────────────────────┘
```

**Mobile interaction model:**
- Default mode: tap = fill, long-press = cross (configurable delay).
- Mode-toggle button in action strip switches to: tap = cross, long-press = fill.
- Drag from any cell continues the same mark across the dragged path.
- Pinch-to-zoom is disabled (we want viewport stable); two-finger pan scrolls the board within its scrollport on 20×20 grids.
- Tap on a clue digit (in either bar) highlights its line — useful for confirming "which row am I working on."

**Desktop additions:**
- Left-click = fill, right-click = cross. (Reuse mouse-button convention from MindSwiffer for muscle-memory consistency across the Bilko Game Studio.)
- Click+drag = continue same mark.
- Hover highlights the row+column of the hovered cell with a `--cell-peer` tint.
- Keyboard: `Arrow` keys move the cursor cell; `Space` fills; `X` crosses; `Z` undoes; `Y` redoes; `H` requests hint; `R` restarts; `1-5` selects size; `M` toggles mode; `D` jumps to today's Daily.

---

## Controls

### Touch (mobile)

| Gesture | Default action | After mode-toggle |
|---|---|---|
| Tap a cell | Fill | Cross |
| Long-press a cell (≥ 350 ms, configurable 200/350/500) | Cross | Fill |
| Drag from a cell | Continue the start cell's commit type across the drag path | (same) |
| Two-finger pan | Scroll within the board scrollport (20×20 only) | (same) |
| Tap on a clue digit (top or left bar) | Highlight that clue's line | (same) |
| Tap on the mode-toggle button | Switch fill ↔ cross default | n/a |
| Tap on the hint button | Begin three-tier hint progression | (same) |
| Tap on the restart icon | Confirm dialog → restart current puzzle | (same) |

### Mouse + keyboard (desktop)

| Input | Action |
|---|---|
| Left-click cell | Fill |
| Right-click cell | Cross |
| Left-click + drag | Bulk-fill across drag path |
| Right-click + drag | Bulk-cross across drag path |
| Hover cell | Highlight its row + column |
| `↑ ↓ ← →` | Move cursor cell |
| `Space` | Fill cursor cell |
| `X` | Cross cursor cell |
| `Backspace` / `Delete` | Clear cursor cell |
| `Z` (or `Cmd/Ctrl-Z`) | Undo last move |
| `Y` (or `Cmd/Ctrl-Shift-Z`) | Redo |
| `H` | Request hint |
| `R` | Restart puzzle (with confirm) |
| `M` | Toggle fill ↔ cross default mode |
| `D` | Jump to today's Daily |
| `1` … `5` | Select size: Sketch / Beginner / Intermediate / Tall / Expert |
| `Esc` | Close any open modal (settings, hint dialog, restart confirm) |

### Screen reader

- Each cell exposes `role="gridcell"` with `aria-label="Row 3, column 7, empty"` / `"…, filled"` / `"…, crossed"`.
- The whole board is a `role="grid"` with `aria-rowcount` and `aria-colcount` matching W/H.
- Clue bars are not focusable themselves; the active cell announces the relevant row clue and column clue as part of its `aria-describedby` text: `"Row clue: 3, 1. Column clue: 2, 1, 3."`
- The hint button's three tiers each fire a polite `aria-live` announcement: `"Hint level 1: deduction available in row 4."` → `"Hint level 2: technique is overlap."` → `"Hint level 3: cell at row 4, column 6 is filled."`
- Mode-toggle announces: `"Fill mode."` / `"Cross mode."`
- Win announces: `"Solved in 4 minutes 32 seconds. Personal best."` (if PB) or `"Solved in 4 minutes 32 seconds."`
- The reveal pulse is purely visual; the screen reader hears nothing.

---

## Scoring + difficulty

### Score breakdown (worked example)

A player solves a Wednesday Daily (Intermediate, 15×15) in 9:30, using one hint and making zero mistakes.

```
base                = 100
difficulty          = 4   (Intermediate)
target_time         = 600 s    (10 min)
actual_time         = 570 s    (9:30)
pace                = clamp(600 / 570, 0.5, 2.0) = 1.05
hints_used          = 1
hint_factor         = 1.0 - (0.1 × 1) = 0.9
mistakes            = 0
no_mistake_factor   = 1.05
daily_bonus         = +50
streak_bonus        = +25 × streak_days

raw   = 100 × 4 × 1.05 × 0.9 × 1.05 = 396.9
round = 400
total = 400 + 50 + 25 × streak_days
```

A solve at exactly target time, no hints, no mistakes: `100 × 4 × 1.0 × 1.0 × 1.05 = 420`, rounded to 420. Daily bonus adds 50.

Score is shown post-solve only; never as a live HUD element. We don't want players grinding a puzzle for high score; the puzzle is the puzzle.

### Difficulty bracket recap

| Day | Daily size | Difficulty | Target time |
|---|---|---|---|
| Mon | 5 × 5 | Sketch | 90 s |
| Tue | 10 × 10 | Beginner | 4 min |
| Wed | 10 × 10 | Beginner | 4 min |
| Thu | 15 × 15 | Intermediate | 10 min |
| Fri | 15 × 20 | Tall | 14 min |
| Sat | 20 × 20 | Expert | 25 min |
| Sun | 20 × 20 | Expert | 25 min |

This deliberately mirrors Good Sudoku's "easier earlier in the week, hardest on Sunday" rhythm and matches MindSwiffer's day-of-week ramp. A Bilko regular who plays all three games can knock out three Mon dailies in under 5 minutes total; Sunday is a 30–60 min commitment across the trio for the deeply engaged.

### Stats surface (settings → "Your Etch")

- Total puzzles solved
- Total cells filled (a vanity metric, but a fun one — like Apple Health's total-distance-walked)
- Total time played (Apple Health vibe — encourages reflection, not pressure)
- Per-difficulty: best time, average time, win rate, total wins
- Daily streak, longest daily streak
- Daily completion calendar (color-coded: solved / revealed / not played)
- Achievements earned (with date)

No leaderboard rank surface in v1. (Leaderboards are PRD 30 territory; can be added later without rework.)

---

## What we deliberately copy vs reject

| From | Copy | Reject |
|---|---|---|
| Pixelogic | Calm monetization (no ads, optional subscription model — we go further: no subscription either), unique-solution guarantee, daily puzzle cadence, dark mode | Subscription paywall, daily-play cap on free tier, multi-year archive paywall, puzzle creator (deferred) |
| Nonograms Katana | Logically-solvable guarantee on every puzzle, multiple cell-mark glyphs (we use 2: filled + cross, not 4), undo/redo, customizable long-press delay, achievements | Colored variant in v1 (deferred), in-app VIP subscription, "view answer" hint (replaced with our 3-tier hint system + give-up reveal) |
| Nonogram.com (Easybrain) | Auto-cross-completed-clue (gray out satisfied clue numbers — does not change board state), six-difficulty hierarchy (we collapse to five) | Mistake-counter game-over by default, seasonal events with collectible trophies, ads, ad-removal IAP, ticket economy for missed dailies |
| Picross S | High-contrast / color-vision toggle (we go further: monochrome only, never load-bearing color), Free Mode no-error-feedback (we make this the default and call it "find your own mistakes") | Mega Picross / Color Picross modes (deferred / out-of-scope), 5 modes per release (we ship one mode), console-style level unlock chapters |
| Picross DS | Daily Picross concept, hint that reveals row+column (we keep this as one of the 3 hint tiers — first hint at level 1 is roughly this), 5×5 → 25×20 size range (we cap at 20×20 for browser perf and tap-target reasons) | Escalating mistake penalty (+2/+4/+8 minutes) — punitive and console-game-coded; mini-games unlocked as rewards; downloadable classic puzzles paywall |
| puzzle-nonograms.com | Drag-to-fill on desktop, 5-cell major grid lines, coordinate helper (we make this always-on for ≥ 15-cell sizes) | Three retention cadences (special daily / weekly / monthly — we ship one daily, period), ad-supported model, 2008-era visual aesthetic |
| Griddlers.net | The community trust signal of "every puzzle has a unique solution" (universal in the genre, table stakes), "puzzle of the day" framing | UGC pool of 290k puzzles in v1 (deferred to a possible v2 community feature), variant proliferation (triddler / multi-color / composite scenes), 2008 table-layout UI |
| Picross 3D / Round 2 | The proof that "nonogram principles generalize to other constraint shapes" (we keep this in our back pocket as a v3 expansion path), the 365-puzzles-per-year framing | 3D rendering (impossible in <300 KB gz), tool-mode toggle as gesture-modifier (we use a button), construction mode |

---

## Differentiation: what is uniquely Bilko about this

1. **Hand-curated Daily picture set + emergent Free Play pictures.** Nobody in the genre splits curation that way. Every commercial nonogram app either:
   - hand-picks every puzzle (Picross S, Picross DS) — quality but expensive and slow to refresh,
   - or generates everything procedurally (Pixelogic Free Play, most web clients) — fast but the dailies feel arbitrary.
   - Etch hand-picks the **Daily** image (one a day, ~365 a year, one weekend a quarter to refill the library — manageable solo workload) and lets Free Play be procedurally infinite. The Daily becomes a small Bilko-flavored pixel scene with personality (a coffee cup, the bilko.run logo at 20×20, a wave glyph), not another stock duck.

2. **No-guess guarantee shared across games.** Sudoku, MindSwiffer, and Etch all promise the same thing: "Solvable by thinking, never by guessing." This is the Bilko Game Studio's brand position. No other puzzle-game publisher (Apple Arcade included) makes this guarantee across multiple titles, because each title is owned by a different studio. Bilko owns all three.

3. **Wordle-style share tile that *is* the picture.** The completed Etch picture, rendered at native resolution as squares + emoji, is the share artifact: a tiny pixel art that everyone shares without giving away the answer process (only the picture, the date, and the time). No other nonogram app ships a Wordle-grade share tile because the genre predates Wordle and most apps still use screenshot-and-share. Etch's tile is an ASCII-block + emoji string that renders correctly in iMessage, Slack, X, and Telegram.

4. **Triple-Threat cross-game achievement.** Solving 1 Sudoku + 1 MindSwiffer + 1 Etch in a Bilko account unlocks a Bilko-wide profile badge. No commercial casual-puzzle publisher cross-links its games this way because they live in different App Stores under different SKUs. bilko.run is the shared chrome that makes this possible.

5. **Free + ad-free + login-optional, on a personal-brand site.** Etch competes directly with App Store titles ($3.99 / mo subscriptions) without an install barrier, subscription, or IAP. Etch's monetization is zero; the host's paid tools subsidize it.

6. **Built in N PRDs by parallel agents in one session.** The build-in-public story mirrors Sudoku and MindSwiffer. Blog post writes itself.

---

## Why this game over the alternatives I considered

I shortlisted six candidates in the puzzle / logic / deduction category (excluding Sudoku and Minesweeper, both already shipped). Etch (nonogram) won. Here's the loss table:

### Lights Out — rejected

The 5×5 push-the-light-and-its-neighbors-to-toggle puzzle (Tiger Electronics, 1995). Era-perfect, browser-trivially-implementable, and the math is gorgeous (it's a linear system over GF(2) — every solvable Lights Out puzzle has either 1 or 4 solutions, and there's a closed-form linear-algebra solver). But:

- **Solve time is sub-2-minutes for any human who has played it twice**, even on 7×7. There's no daily-puzzle retention loop because the player essentially memorizes the technique and then it's mechanical.
- **No deduction depth**: once you know "chase the lights" (solve the top row, propagate down, fix the bottom row using one of 16 button-press combinations), every Lights Out puzzle plays identically.
- **No share-tile moment**: the win state is a blank grid. Wordle's tile works because the *grid* tells the story; Lights Out's win is the absence of grid.
- Lights Out would be a great *bonus mode* inside another game (we could ship a 5×5 Lights Out as the Bilko-wide "easter egg button" some day) but not a main course.

### Pipe Dream / Pipemania — rejected

The 1989 Lucasfilm Games puzzle where the player lays down random pipe pieces from a queue ahead of a flowing flooz. Era-anchored (the 1989 Amiga release plus countless 90s-2000s clones), browser-trivially-implementable.

- **Has a real-time element**: the flooz advances on a timer, so the player is always racing the clock. This is a *reflex / pattern-matching* hybrid, not pure deduction. The brief explicitly calls for logic-deduction-rich (the spine of Sudoku/MindSwiffer); Pipe Dream is the wrong axis.
- **Random piece queue makes it luck-dependent**, which conflicts with our "solvable by thinking, never by guessing" brand.
- Pipe Dream is a great *arcade* candidate; it's not a puzzle candidate. We could ship it as a Game Studio "Arcade" subline some day (Boat Shooter is the prior art), but not against this brief.

### Slitherlink — rejected (close second)

The Nikoli loop puzzle: cells with numbers indicate how many of their four edges are part of a single closed loop. Logic-deduction-rich, has a "no-guess" tradition, daily-puzzle-friendly, fits a single screen.

- **Citation gap for the 1995–2005 era**: Slitherlink originated in *Puzzle Communication Nikoli* in 1989 (Japanese magazine); its widely-recognized digital era is post-2005 (apps from 2010+). There is no canonical 1995–2005 browser-runnable reference comparable to Mario's Picross. The brief asked for 1995–2005 era anchor; Slitherlink fails it.
- **Visual is harder to make beautiful** at small sizes. Slitherlink looks great at 15×15+ but cramped at 5×5; nonograms scale gracefully across all our target sizes.
- **No mass-market "I've heard of this" recognition**. Picross has Mario; Slitherlink has Nikoli purists. Bilko's audience is broader.
- Strong v2 candidate — possibly the next entry after Etch.

### Hashi (Bridges) — rejected

Connect islands with bridges (1 or 2 per pair) such that the bridge count matches each island's number and all islands form a connected graph. Beautiful logic, no-guess generators well-attested.

- **Same era-citation gap as Slitherlink** — Nikoli, 1990s magazine, digital era is post-2005.
- **Generation is brittle at small sizes**: meaningfully interesting Hashi puzzles tend to need 8–10 islands minimum, which means 12×12+ grids; harder to fit on small phones in portrait.
- **Visual chrome is more elaborate**: islands are circles with text, bridges are 1px or 2px lines that cross orthogonally and never diagonally — three distinct visual elements vs. nonogram's two (cell + clue digit). Etch is simpler.
- Possible v3 candidate.

### Klotski / sliding-block puzzles — rejected

The 1932 wooden sliding-block puzzle ("Daughter in the Box"); the 1990s era saw browser-Java reimplementations and Microsoft's Klotski clone.

- **Single-puzzle-per-day cadence is awkward**: Klotski has very few "interesting" puzzles total (the canonical ones are well-known and number in the dozens), so a daily-cadence game runs out of curated content fast or has to fall back to procedurally-generated puzzles that all feel similar.
- **Solve-by-search not solve-by-deduction**: humans don't solve Klotski by reasoning about which moves are forced; they solve it by attempting move sequences and backtracking. The brief asks for logic-deduction-rich; Klotski is more like chess endgame practice.
- **No good share-tile**: the win state is "the big block is in the bottom slot," which is hard to render in 5 emoji.

### Mahjong solitaire — rejected

The 144-tile pattern-matching game; everywhere on Windows, mobile, browser since the 1980s.

- **Pattern-matching, not logic deduction**: the player scans for matching tile pairs that are currently free; there's no "I can deduce X" moment. Optimization decisions exist (which pair to remove next) but they're shallow.
- **Visual budget**: 144 tile faces with distinct symbols (bamboo / characters / dots / winds / dragons / flowers / seasons) explodes the asset budget. Either we ship distinctively-Bilko tile art (large illustrator workload) or we use generic symbols (looks generic).
- **Doesn't share Sudoku/MindSwiffer's brand thesis** about "thinking, not guessing" because Mahjong solitaire isn't about thinking, it's about pattern speed.

### Verdict

Nonogram (Etch) wins on every constraint:
- Era anchor: Mario's Picross 1995, perfect.
- Logic-deduction depth: NP-complete in general, line-solvable in practice for our chosen sizes; deduction techniques have names ("overlap", "forced-edge", "completed-clue") that map to a 3-tier hint system.
- Mechanic documented: Wikipedia, Batenburg-Kosters paper, Rosetta Code, Pixelogic blog, Nonograms Katana FAQ.
- Single screen, ≤5 min: Sketch (5×5) is sub-90-seconds; Beginner (10×10) is the daily-driver session length.
- Visual minimalism native to the form: cells + clue digits, nothing else.
- Share-tile-friendly: the picture itself is the share artifact.
- Brand fit: the "no-guess generator" thesis from MindSwiffer transfers cleanly.
- No trademark: "Etch" is one syllable, evokes the Mario "chiseling" verb, and is not used as a puzzle-game brand by any commercial product I could find.

---

## Open questions (for Bilko / designer call)

1. **Daily-image curation cadence and authorship.** Hand-picking ~365 small pixel scenes is a real workload, even if each is 5–20 minutes. Do we (a) build the library in one weekend sprint of 50–80 scenes and procedurally fill the rest until we catch up, (b) hire a pixel artist on Fiverr to deliver in batches of 30, or (c) use AI image-to-pixel tooling (e.g. piskel + a Sonnet pipeline) to turn keyword prompts into validated grids? This decision shapes the launch date and the brand voice of the dailies.

2. **20×20 on small phones — how aggressive do we get with horizontal scrolling?** At 14 px/cell on a 360-px viewport, a 20×20 board doesn't fit; the player must two-finger-pan. Alternatives: (a) reduce Expert max to 18×18 (loses some "this is a real expert puzzle" feeling), (b) force landscape orientation for Expert (annoying UX hop), (c) live with two-finger pan and make the column clue bar sticky-top. I lean (c). Confirm.

3. **Mistake mode default: off (per design rule 4) or on with 5 strikes (per Easybrain convention)?** The brief defaults are ambiguous. I went with off — matching MindSwiffer's "no undo, the puzzle is fair so the consequence stands" stance. But Etch is *more* forgiving than MindSwiffer (you can always X your way back from a wrong fill once you notice the contradiction), so an "on by default" stance is defensible. Want to A/B-decide this one in usage data after launch?

4. **Triple-Threat achievement — does it require *Daily* solves or any solves?** Solving 1 Sudoku Free Play + 1 MindSwiffer Free Play + 1 Etch Free Play is achievable in 5 minutes total of low-effort play. Solving today's Daily of all three is a real commitment (15–60 min depending on day-of-week). The first feels like a participation badge; the second feels like a real flex. Lean toward "first" for v1 (lower friction, more players unlock it, more share moments), upgrade-path to a "Triple-Threat Daily" badge on top later. Confirm.

5. **Color Picross: deferred forever or eventual v2?** Color nonograms (each clue digit is colored, runs of the same color must be contiguous, runs of different colors do not require a separating empty cell between them) double the clue density and add a strong visual layer. The market clearly wants it (Picross S5 added a high-contrast toggle specifically because Color Picross is so popular). But it'd push the solver complexity up and break the monochrome aesthetic that ties Etch to Sudoku and MindSwiffer. I'd mark this as "design v2 separately, possibly as a sister tool 'Etch Color' rather than a mode in Etch." Confirm direction.

---

## References

- [Wikipedia: Nonogram](https://en.wikipedia.org/wiki/Nonogram) — invention history, complexity, variants
- [Wikipedia: Mario's Picross](https://en.wikipedia.org/wiki/Mario%27s_Picross) — 1995 era anchor
- [Wikipedia: Picross](https://en.wikipedia.org/wiki/Picross) — Nintendo trademark, series timeline
- [Wikipedia: Picross DS](https://en.wikipedia.org/wiki/Picross_DS) — modes, mistake-penalty model, Daily Picross origin
- [Wikipedia: Picross 3D](https://en.wikipedia.org/wiki/Picross_3D) — adjacent-genre reference
- [Wikipedia: Picross S](https://en.wikipedia.org/wiki/Picross_S) — current commercial flagship, high-contrast mode
- [PlayPicross — Nonograms history](https://playpicross.com/en/blog/nonograms-history/) — Non Ishida + Tetsuya Nishio biography
- [Puzzle Museum — Griddlers history](https://www.puzzlemuseum.com/griddler/gridhist.htm) — 1990 Sunday Telegraph publication, 1998 "Griddlers" rebrand
- [NinjaPuzzles — Origins of Nonograms](https://ninjapuzzles.com/writing/the-fascinating-origins-of-nonogram-puzzles/) — corroborating history
- [MobyGames — Mario's Picross](https://www.mobygames.com/game/6033/marios-picross/) — 1995 release verification
- [Batenburg & Kosters 2009 — Solving Nonograms by combining relaxations (PDF)](https://homepages.cwi.nl/~kbatenbu/papers/bako_pr_2009.pdf) — solver algorithm citation
- [Constructing Simple Nonograms of Varying Difficulty (Leiden, PDF)](https://liacs.leidenuniv.nl/~kosterswa/constru.pdf) — generator + difficulty grading reference
- [Rosetta Code — Nonogram solver](https://rosettacode.org/wiki/Nonogram_solver) — implementation reference, multiple languages
- [Pixelogic](https://pixelogic.app/) — modern app survey #1
- [Pixelogic — Every 5×5 Nonogram](https://pixelogic.app/every-5x5-nonogram) — combinatorial enumeration writeup
- [App Store: Pixelogic](https://apps.apple.com/us/app/pixelogic-daily-nonograms/id318667196)
- [Nonograms Katana](https://nonograms-katana.com/) — modern app survey #2
- [App Store: Nonograms Katana](https://apps.apple.com/us/app/nonograms-katana/id1037710023)
- [Play Store: Nonograms Katana](https://play.google.com/store/apps/details?id=com.ucdevs.jcross)
- [Play Store: Nonogram.com (Easybrain)](https://play.google.com/store/apps/details?id=com.easybrain.nonogram) — modern app survey #3
- [puzzle-nonograms.com](https://www.puzzle-nonograms.com/) — modern app survey #6
- [Griddlers.net](https://www.griddlers.net/home) — modern app survey #7
- [MiniWebtool — Nonogram generator](https://miniwebtool.com/nonogram-generator-picross/) — fill-density sweet-spot citation (25–55%)
- [Sumplete blog — Free Nonogram Games 2026](https://sumplete.com/blog/best-free-nonogram-games) — cross-reference for app survey
- [docs/sudoku-research.md](../sudoku-research.md) — sibling design brief; Etch mirrors its structure
- [docs/mindswiffer-research.md](../mindswiffer-research.md) — sibling design brief; "no-guess" thesis lineage
- `~/Projects/Bilko-Sudoku/node_modules/@bilkobibitkov/host-kit/styles/game-tokens.css` — token definitions verified locally (`--ink`, `--paper`, `--cell-radius`, etc.)
