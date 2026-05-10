# Etch design rules — quick reference

The 5 rules from the "Bilko-Etch design philosophy" section of [`etch.md`](etch.md). Copied verbatim. PRDs link here instead of quoting the rules in full each time.

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
