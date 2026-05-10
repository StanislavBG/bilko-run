# Cellar market research + Bilko-Cellar design brief

Reference doc that grounds the Cellar PRD set (the third Bilko Game Studio entry, after Sudoku and MindSwiffer). Read this before picking up any of those PRDs — it's the "why" behind every UI choice. Every subsequent PRD references this file, not the internet.

> **Cellar** is Bilko's clean-room reimplementation of FreeCell — the 1978 Paul Alfille / 1995 Microsoft Windows solitaire that taught a generation what "deterministic, shared, deal-numbered solitaire" looks like. Original IP, original sprites, original name. Mechanics 1:1 with the Microsoft `seed → LCG → 8 cascades` contract so any deal number from any FreeCell client maps to the same Cellar board.

## TL;DR

- **What it is**: a 52-card open-information solitaire played on 8 cascades + 4 free cells + 4 foundations. ~99.999 % of deals are solvable; everything you need to win is face-up from move zero. Pure planning, zero luck, zero reflex.
- **Why it's the right pick**: it slots into the Bilko Game Studio shape perfectly (single-screen, deterministic seed, ≤5 min/session, strategy-rich, exhaustively documented), there's no card-game in the Bilko lineup yet, and the deal-number contract gives us a 50-year-old shared-state retention loop for free.
- **The Bilko twist**: Cellar ships **only solvable deals** (verified with a bundled atomic-move solver before any deal hits the player), a **3-tier hint that names the technique** (Good Sudoku model, ported to FreeCell — "Free a peer", "Build down to expose Ace", "Supermove of 5"), and a **Daily Cellar** with day-of-week ramp keyed off the deterministic deal-number space — same retention loop as Bilko-Sudoku and Bilko-MindSwiffer.

## The original (cited)

**Paul Alfille** wrote the first computer FreeCell in **1978** in TUTOR for the PLATO educational system at the University of Illinois, while a medical student there. He derived it from Baker's Game (an 1880s patience that built down by *suit*) by changing the build rule to alternating colors — which paradoxically made the game both **easier to win and more strategic**, because every legal move is now a placement decision rather than a suit lookup. Alfille's PLATO version already supported variable cascades (4–10 columns) and variable cells (1–10), ranked tournament leaderboards, and hand-curated "challenge" deals — every hook the modern web FreeCell market still uses, prefigured on a 512×512 monochrome plasma display in 1978. ([Wikipedia — FreeCell](https://en.wikipedia.org/wiki/FreeCell), [Solitaire Central — Paul Alfille](http://www.solitairecentral.com/inventors/PaulAlfille.html), [The Minds Behind FreeCell](https://www.freesolitaire.com/posts/posts-blogs/the-minds-behind-freecell))

**Jim Horne** played Alfille's PLATO version at the University of Alberta, wrote a shareware MS-DOS port in 1988, joined Microsoft, and bundled FreeCell into the **Win32s sample pack for Windows 3.1 in 1992**, then **every Windows release since Windows 95**. Horne's two structural decisions are why FreeCell is in this brief at all: he **numbered the deals 1–32 000** (a 16-bit `int` constraint of the era) using the Microsoft C standard-library `rand()` LCG with the deal number as seed — making every deal **shareable across machines and decades** — and he claimed publicly that "every game is winnable", which kicked off **Dave Ring's Internet FreeCell Project** (Aug 1994 – Apr 1995, ~100 Usenet volunteers, 100 deals each), the first large-scale crowdsourced verification of a closed problem space. They proved 31 999 / 32 000 deals solvable; the lone holdout, **deal #11982**, was later confirmed unsolvable by ≥8 independent solvers and is the most famous "impossible" puzzle in computer-game history. ([Microsoft FreeCell — Wikipedia](https://en.wikipedia.org/wiki/Microsoft_FreeCell), [Slashdot — How Windows FreeCell gave rise to online crowdsourcing](https://games.slashdot.org/story/12/04/12/1418240/how-windows-freecell-gave-rise-to-online-crowdsourcing), [The Gameological Society — Unbeatable](http://gameological.com/2012/04/unbeatable/), [solitairelaboratory.com FreeCell FAQ](http://solitairelaboratory.com/fcfaq.html))

The game endured because it sits in a rare design pocket: **complete information, deterministic, 99.999 % solvable, no time pressure, no opponent, ≤5 min/session, fits one screen, and the deal numbers are a shared social object**. Sudoku has the first six. Minesweeper has none of the last two — every Minesweeper grid is private. FreeCell is the only mainstream pre-2005 solitaire where "I beat #617 in 87 moves" is a sentence two strangers can verify. That property is the reason it deserves to be rebuilt, not nostalgic preservation.

## Top 8 modern implementations surveyed (2026)

Sourced from current iOS App Store, Play Store, web roundups (solitaired.com, solitairebliss.com, hardcoredroid.com), and the long-standing competitive web clients. **6 features per app** — the ones that show up most prominently in their UX or are worth stealing / refusing.

### 1. Microsoft Solitaire Collection — FreeCell mode

The reference port. Free with rewarded ads; $1.99/mo or $9.99/yr to remove. Bundles Klondike, Spider, FreeCell, TriPeaks, Pyramid behind one Xbox-Live-tied wrapper. ([Microsoft Solitaire Collection on App Store](https://apps.apple.com/us/app/microsoft-solitaire-collection/id1153724038))

1. **Daily Challenges per game** — one Easy/Medium/Hard/Expert FreeCell deal per day with a shared timer, streak, and crown-grid calendar.
2. **Star Club** — themed deal collections (e.g. "Springtime FreeCell") that ship 30+ curated deals each, gated to subscribers.
3. **Cloud save via Microsoft / Xbox Live account** — streak, deal completion, and in-progress board sync across Windows / iOS / Android / Xbox / web.
4. **Multiple themes & card backs** — wooden, holiday, retro Win98; unlocked through play or Game Pass.
5. **Adventure mode** — themed campaign maps with custom layouts; unique to MSC, not in any other FreeCell.
6. **"Numbered Deals" entry** — type any number 1–1 000 000 to load that exact Microsoft deal; preserves the 1995 contract.

### 2. FreeCell Solitaire by MobilityWare (iOS / Android)

The #1 dedicated FreeCell on the Play Store. Free + ads; $1.99/mo or $9.99/yr ad-free. ([MobilityWare FreeCell on Play](https://play.google.com/store/apps/details?id=com.mobilityware.freecell))

1. **Daily Challenge calendar with crown badges** — one deal per day, monthly badge for solving every day.
2. **Goals system** — XP-bearing tasks like "win 3 games today" or "solve in under 4 minutes"; gated to a level bar.
3. **Numbered-deal selector** — supports the classic 1–1 000 000 Microsoft deal-number entry.
4. **Unlimited undo with move counter** — every undo bumps the move counter so "fewest moves" leaderboards remain meaningful.
5. **Hint button** — single-tap suggests one valid move (animated arrow); no technique naming.
6. **Auto-complete** — when the board is provably solvable from current state, a single button sweeps every remaining card to the foundations.

### 3. Solitaired FreeCell (web + iOS)

Ad-light web-first FreeCell with a "500 + variants" parent platform. Free; no premium tier. ([Solitaired FreeCell](https://solitaired.com/freecell))

1. **Web-first cold start** — playable from URL in <2 s, no account, no app.
2. **Statistics dashboard** — best time, fewest moves, win rate, longest streak, all per-difficulty.
3. **Variants under one roof** — Baker's Game, Eight Off, Seahaven Towers all reachable from the FreeCell page.
4. **Replay last deal** — one-click "play this deal again" after a loss; preserves the seed.
5. **Light cognitive-game framing** — marketing copy leans hard on "good for your brain", informs the visual restraint.
6. **Unlimited undo** — no penalty, no move-counter bump (more permissive than MobilityWare).

### 4. Green Felt FreeCell

Long-running web hub (early-2000s aesthetic) with a serious player community. Free, ad-light, no account. ([Green Felt FreeCell](https://greenfelt.net/freecell))

1. **Keyboard-first power play** — rank keys (1–9, 0, J, Q, K) combine with suit/color keys (h, d, s, c, r, b) to highlight specific cards; mouse becomes optional.
2. **Auto-supermove** — drag any valid run; the engine computes the supermove count and animates the constituent atomic moves.
3. **"Today's deal" cron** — one deal/day shown on the homepage; community shares solutions in the comments.
4. **Win-streak ladder** — anonymous per-day leaderboard for "longest streak this week".
5. **Bug-report inline link** — the footer has a one-click "this deal seems impossible" report; community-curated unsolvability flags.
6. **No theme system** — green felt forever; the constraint is the brand.

### 5. Cardgames.io FreeCell

Broad-appeal browser hub. Free + ads. ([Cardgames.io FreeCell](https://cardgames.io/freecell/))

1. **Instant play, no account** — cold-start to first card drag in under 3 s.
2. **Unlimited undo with move-counter penalty** — every undo +1 move, so "fewest moves" badge demands restraint.
3. **Move counter and timer always on** — both visible at top of board; cannot be disabled.
4. **Drag-only input** — no tap-tap mode; mobile players must drag, which is awkward on small screens.
5. **Animated win sequence** — fireworks + cascading auto-complete to foundations.
6. **localStorage best times** — survives sessions without an account, no cloud sync.

### 6. FreeCell by Brainium Studios (iOS / Android)

Premium-feel mobile FreeCell, same studio as the well-regarded Brainium Sudoku. Free + ads; one-time IAP to remove. ([Brainium FreeCell help center](https://brainium.helpshift.com/hc/en/8-freecell/))

1. **Minimalist visuals** — flat cards, hairline borders, generous padding; no skeuomorphic felt.
2. **Tap-tap input as default** — tap source card → tap destination; drag is supported as a secondary path.
3. **Per-cell glow on legal target** — when a card is selected, all legal landing spots glow softly.
4. **Beginner / Standard / Advanced difficulty filters** — *deal pre-screening*: "Beginner" filters to deals the bundled solver rates as easy.
5. **Hint button cycles through legal moves** — repeated taps step through every legal move from current state, ranked by solver heuristic.
6. **Statistics with histograms** — time-distribution chart per difficulty, win-rate sparkline.

### 7. FreeCell Pro (Dinobyte Studios, Android)

Power-user FreeCell aimed at the competitive crowd. Free + ads. ([FreeCell Pro discussions](https://www.hardcoredroid.com/the-best-freecell-solitaire-apps-for-mobile-devices/))

1. **Numbered deal entry up to 8 billion** — extends past the Microsoft 1 M to FreeCell-Pro's 8.6 B deal space (Pringle/Fish 2018 corpus).
2. **Solver-rated difficulty for any deal** — paste a deal number, see "estimated difficulty: hard, ~280 nodes searched".
3. **Customizable card faces & backs** — community-contributed art packs.
4. **Autoplay button with adjustable speed** — when board is provably won, sweeps cards at 50 / 100 / 200 ms per card.
5. **Move-history scrubber** — drag a slider to step backwards/forwards through the move history; replay any saved game.
6. **No daily, no streak** — pure on-demand single-deal play; opposite end of the spectrum from MobilityWare.

### 8. FreeCell.io / FreeCellProject.com — competitive web

Two sibling competitive-web FreeCell clients (similar feature set). Free, ad-supported, account-required for ranked play. ([FreeCell Project](https://www.freecellproject.com/en/about))

1. **Per-deal global leaderboard** — top-100 fastest and fewest-moves per deal number, refreshed live.
2. **"Race the clock" mode** — a randomly chosen solvable deal, players compete on the same seed for 24 h.
3. **Integer move-count metric** — fewest moves is the canonical score, not time; selects for planning over speed.
4. **Spectator replays** — every leaderboard entry has a click-through atomic-move replay.
5. **Friend duels** — challenge a specific friend on a specific deal; both play independently, results compared on completion.
6. **Solver-as-coach** — after a loss, the in-app solver shows the move you should have made at the inflection point.

---

## Synthesized feature catalog

Every recurring feature, grouped. **Bold** = in scope for Cellar v1. *Italic* = explicitly deferred.

### Core gameplay
- **Standard 8-cascade FreeCell layout** — 8 columns face-up (4×7 + 4×6 cards), 4 free cells, 4 foundations.
- **Build down by alternating color in cascades; build up by suit on foundations.**
- **Single-card moves; supermove macro** — engine computes max moveable run = `(1 + empty cells) × 2^(empty cascades)` and animates atomic moves under the hood. (Wikipedia, Solitaire Stack rules quick-reference)
- **Auto-move to foundations** — cards safe to send up are auto-moved (configurable: always / never / smart-only-when-safe).
- **Unlimited undo / redo** — full move-history per deal; redo survives until a new move is made.
- **Numbered-deal selector** — type any number 1–1 000 000, get the exact Microsoft deal (LCG-compatible).
- *Variants: Eight Off, Baker's Game, Seahaven Towers*
- *Custom layouts (variable cells/cascades)*

### Hints & teaching
- **Three-tier hint system** — *highlight a region* → *narrow to a specific source/destination pair* → *make the move and name the technique*. Techniques: "Free a peer", "Build down to expose Ace", "Supermove of N", "Park to free cell", "Foundation safe-up". Modeled on Good Sudoku.
- **Solvability-rated deals** — every deal is run through the bundled solver before being shown; the difficulty bracket comes from the solver's node-count, not a static table.
- **Solver-as-coach on loss** — when a player declares "I'm stuck" or loses, the engine shows the last move at which a winning line still existed.
- *Inline technique tutorials*

### Daily + retention
- **Daily Cellar — deterministic by date** — same deal for all players that day; day-of-week scales difficulty (Mon easy → Sun hardest). Mirrors Sudoku/MindSwiffer Daily contract.
- **Streak counter with one weekly freeze** — same shape as the Sudoku PRD set.
- **Calendar archive** — play any past Daily.
- *Per-day shared leaderboard*
- *Friend duels*

### Statistics + achievements
- **Per-difficulty: best time, best move-count, average time, win rate, total wins.**
- **Two scoring axes: time and move-count.** Players choose which they care about (some care neither, just want to finish).
- **Total games played, total cards moved.**
- **Streak and longest streak.**
- **Achievements via PRD 30 platform game services** — first win, sub-3-min Easy, 7-day streak, solve a Hard, sub-100 moves on Easy, beat the bundled solver's move-count, cross-game "Puzzler" (1 Sudoku + 1 MindSwiffer + 1 Cellar).
- **Leaderboards via PRD 30** — best time + best move-count per difficulty + Daily.

### Persistence
- **Auto-save in-progress deal; resume on launch.**
- **Cloud save when signed in** via PRD 30 game services.
- **Local-first; cloud opt-in.**

### Visual & feel (Apple-grade)
- **Hairline cards** — `--card-radius` 8px, hairline border, no felt texture, no shadow stack.
- **Two-color suit palette** — `--suit-red` and `--suit-black`; rank in SF Pro Rounded.
- **Free-cell + foundation slots** are open rounded rectangles with the slot label inside them at low opacity.
- **Cascade fan** — vertical card overlap of 24% of card height; tightens to 18% if the cascade exceeds 12 cards.
- **Spring-in on supermove** — the entire run animates as a unit at `--spring-fast` / `--duration-tap`, even though atomic moves are happening underneath.
- **Foundation pop** — a sub-200ms scale-bounce when a card lands on its foundation; bigger pop when it completes a foundation.
- **Confetti only on personal best** — beating PB time or PB move-count triggers it; a normal win is a quiet check.
- **Reduced-motion respects system setting.**
- *Skins, cosmetic card backs, themed decks*

### Input
- **Tap-tap mode (default)** — tap source → tap destination; the engine resolves which cells to move through.
- **Drag mode** — drag a card or a legal run; ghost preview shows landing spot.
- **Double-tap to send to foundation** — fast-track for late-game flicking.
- **Keyboard (desktop)** — arrow keys move cursor between cascades / cells / foundations; Enter selects; Space sends to foundation if legal; U undoes, R restarts, H hints.
- **Long-press cascade header** — collapses that cascade to its top card for tight-board overview (mobile only).
- *Apple Pencil*

### Platform integration
- **Hosted at bilko.run/projects/cellar/** as static-path sibling.
- **Brand chrome** via `@bilkobibitkov/host-kit` `<GameShell>`.
- **Free, no ads, login-optional.**
- **Analytics via `/api/analytics/event`** (same-origin, PRD 27).
- **Cross-game "Puzzler" achievement** extended — solve at least 1 Sudoku + 1 MindSwiffer + 1 Cellar.

---

## 5 design rules for Bilko-Cellar

Distilled into 5 rules. Every PRD acceptance criterion ties back to one of these.

### 1. Every deal is winnable (and we prove it)

Cellar **never ships a deal it hasn't proven solvable.** The bundled atomic-move solver (TypeScript port of Shlomi Fish's `fc-solve` core, MIT-licensed reference) runs over every generated deal before it's stored or shown. The Daily Cellar is solver-verified. The numbered-deal mode warns explicitly when the player asks for one of the 8 known unsolvable Microsoft deals (#11982, #146692, #186216, #455889, #495505, #512118, #517776, #781948) and offers the deal anyway with a "you have been warned" badge. (Source: [solitairelaboratory.com FreeCell FAQ](http://solitairelaboratory.com/fcfaq.html), [online-solitaire.com 11982 deep-dive](https://online-solitaire.com/blog/freecell-and-its-unsolvable-games-game-11982-and-the-99-999/))

### 2. Open information is the ethic

Every card is face-up. There is no hidden state. There is therefore no excuse for a "loot box" mechanic, no "premium hint pack", no "watch ad to undo". The game tells the player everything; the player thinks. Cellar's monetization is zero. The bilko.run host pays its bills via the paid tools (Page Roast, Ad Scorer, etc.); Cellar's job is to be *good*.

### 3. The supermove is the syntax

FreeCell's signature beat is the moment a player realizes "I can move 7 cards as a unit because I have 2 cells and 1 empty cascade free." That insight is the *fun*. Cellar promotes it: drag a 7-card run onto a legal target and the engine accepts it; the visual animates the atomic moves so the player **sees** the cells being borrowed and returned. Educational AND fluent. No competing app makes the supermove visible; we will.

### 4. Restraint over felt

No green felt. No skeuomorphic 1995 rounded-rectangle cards-with-hard-shadows. No cartoon back patterns. Hairline white cards on a near-paper background; rank + suit in the Bilko system font; suit colors are the only chroma on the board. The game looks like it was designed in 2026, not skinned on top of a 1992 .exe.

### 5. The deal number is a social object

The deal number is *the* unit of identity in FreeCell. Cellar treats it as a first-class URL: `bilko.run/projects/cellar/?deal=617` deep-links to that exact deal. Sharing a deal is sharing a sentence: "I beat #617 in 87 moves." That's the entire retention loop and we lean on it instead of inventing a worse one.

---

## Mechanics spec

Exhaustive. This is the contract the engine PRDs implement against.

### Board

- **8 cascades** indexed 0–7. Cascades 0–3 receive 7 cards; cascades 4–7 receive 6 cards. Total 52.
- **4 free cells** indexed 0–3. Each holds at most one card of any rank/suit.
- **4 foundations** indexed by suit (♠ ♥ ♦ ♣). Each builds Ace → King in suit.

### Deal generation (Microsoft-compatible LCG)

Cellar implements **the exact Microsoft FreeCell LCG and dealing order**, so any deal number from any FreeCell client (Microsoft, MobilityWare, Green Felt, FreeCell.io) maps to the same Cellar board. This is the "social object" promise from rule 5.

LCG parameters (Microsoft C `rand()` family, 32-bit signed): ([Rosetta Code — Deal cards for FreeCell](https://rosettacode.org/wiki/Deal_cards_for_FreeCell), [Wikipedia — Linear congruential generator](https://en.wikipedia.org/wiki/Linear_congruential_generator))

```
state₀     = dealNumber                    # 1 ≤ dealNumber ≤ 1_000_000
stateₙ₊₁  = (stateₙ × 214013 + 2531011) mod 2³¹
randₙ     = stateₙ₊₁ >> 16                 # take bits 16..30, 15-bit unsigned
randₙ_mod = randₙ mod k                    # k = remaining card count, 52..1
```

Dealing procedure:

```
deck = [0, 1, 2, …, 51]    # standard order: ♣A=0, ♦A=1, ♥A=2, ♠A=3, ♣2=4, … ♠K=51
for i in 0..51:
  k    = 52 - i
  r    = nextRand() mod k
  pick = deck[r]
  deck[r] = deck[k - 1]
  emit pick to cascade (i mod 8)
  shrink deck by 1
```

Each emitted card lands at the bottom (visible) end of cascade `i mod 8`. The first card emitted goes to cascade 0; card 8 goes to cascade 0 again, second-from-top, etc. After 52 emissions, cascades 0–3 hold 7 cards, cascades 4–7 hold 6.

Cellar's engine exposes `deal(dealNumber: number): Cascade[8]` and a parallel `dealFromString(seed: string): Cascade[8]` for non-numeric daily seeds (the Daily uses `YYYY-MM-DD` hashed to a number in the 1–1 000 000 space, then routed through the LCG so the daily is also Microsoft-compatible if anyone cares to look up the resulting deal number).

### Move legality

A move from source `S` to destination `D` of card `c` (or run starting at `c`):

| Destination | Legal if |
|---|---|
| Empty cascade | always (single card or supermove of any size that fits the supermove cap) |
| Non-empty cascade | top card of `D` is one rank higher and opposite color of `c`, AND run from `c` to top of `S` is itself a valid alternating-color descending sequence |
| Empty free cell | `c` is the top card of `S`, single-card move only |
| Non-empty free cell | never |
| Foundation of suit `t` | `c.suit == t` AND foundation top is `c.rank - 1` (Ace plays to empty foundation) |

### Supermove cap

`maxRun = (1 + emptyCells) × 2^emptyCascades`

— with the standard adjustment that **the destination cascade does not count as empty for its own purposes** (i.e. moving a 5-card run *onto* an empty cascade uses the formula with `emptyCascades − 1`). The engine animates atomic moves so the player can see the cell-borrowing pattern. ([FreeCell rules — Solitaire Stack](https://solitairestack.com/freecell-rules), [FreeCell — Wikipedia](https://en.wikipedia.org/wiki/FreeCell))

### Auto-move to foundation

After every player move, the engine evaluates "safe auto-move":

```
A card c can safely auto-move to its foundation if:
  ranks of both opposite-color foundations ≥ c.rank − 1
  OR c.rank ≤ 2          # 2s always safe once Ace is up
```

This is the standard FreeCell auto-play heuristic: it never moves a card the player might still need underneath an opposite-color sequence. ([How to Play FreeCell — Brainium](https://brainium.helpshift.com/hc/en/8-freecell/), [Solitaire Stack strategy](https://solitairestack.com/strategy))

Three settings:

- **Always**: any legal foundation move auto-fires (matches Win95 default).
- **Safe** (Cellar default): only auto-fires when the heuristic above passes. Most modern apps.
- **Never**: player must drag every foundation move (matches competitive scoring on FreeCell.io).

### Solver

Cellar bundles an **atomic-move solver** in TypeScript, derived from public reference implementations (Shlomi Fish's `fc-solve` algorithmic notes; MIT/Expat). ([Freecell Solver](https://fc-solve.shlomifish.org/), [Architecture document](https://fc-solve.shlomifish.org/arch_doc/fcs_arch_doc.raw.html))

- **Search**: best-first (A*-like), with state hashing for cycle detection.
- **Heuristic** (lower is better): `4 × (52 − sum(foundation_ranks)) + sum(buried_aces) × 8 + outOfPlaceColor_count`. Optimized for "make foundation progress" rather than "minimize moves" — players don't care about optimal move count, they care about *whether* a deal is solvable.
- **State**: `(cascade-tuples, sorted free-cell tuple, foundation-rank-tuple)`; sorting the free cells gives 4! = 24× state-space compression.
- **Termination**: returns `{solvable: true, moves: AtomicMove[]}` or `{solvable: false}` after exploring up to 200 000 nodes (configurable). Empirically resolves >99.99 % of deals in <50 ms on a modern phone.

The solver runs:

1. **At deal-generation time** — every Daily Cellar + every difficulty-bracket generated deal is solver-verified before storage.
2. **At hint time** — the solver searches from the *current* state for a winning line; if one exists, the next move on that line becomes the level-3 hint.
3. **At loss time** — if the player declares "stuck" or runs out of legal moves, the solver reports either "still winnable, try …" or "no winning line from this position; the last winning move was N moves ago".

### Difficulty brackets

Difficulty is **inferred from solver behavior on each candidate deal**, not from a static table:

| Bracket | Solver nodes (approx) | Filter |
|---|---|---|
| **Easy** | < 500 | ~25 % of all solvable deals |
| **Standard** | 500 – 5 000 | ~55 % |
| **Hard** | 5 000 – 50 000 | ~18 % |
| **Master** | 50 000 – 200 000 | ~2 % |
| **Daily** | scales by day-of-week | Mon/Tue Easy, Wed/Thu Standard, Fri Hard, Sat/Sun Master |

The bracket is not a different game — it's a filter on which deal numbers are surfaced. Power users can still type any deal number directly, including the famously hard ones (#31465 is a known "hardest" candidate). ([solitairelaboratory.com — Lists of difficult and easy deals](http://www.solitairelaboratory.com/fclists.html))

### Win condition

All 52 cards on foundations.

### Lose condition

There is **no automatic lose** in classic FreeCell. The player can always undo, restart, or play to exhaustion. Cellar offers an optional **soft-lose**: when no legal move exists from the current position AND the solver returns `{solvable: false}` from the current state, a non-blocking toast offers `Undo · Restart · Concede`. The toast is dismissable and never auto-fires the loss.

### Edge cases

- **First move**: any card can move to any legal destination. There is no "safe first move" to engineer — every card is face-up from move 0.
- **Empty cascade as supermove destination**: the cap formula uses `emptyCascades − 1`. The engine validates this and rejects illegal supermoves with a soft red flash.
- **Foundation reverse**: by default, cards on the foundation **can be pulled back** into a cascade if legal (the Microsoft default). Configurable: `foundationLocked: false` (default, classic) or `true` (modern competitive).
- **Move to / from free cell**: only single-card moves; the engine never "supermoves through" a free cell (the supermove cap formula already accounts for free-cell capacity).
- **Same-color stack on a cascade**: the engine accepts the *placement* (the destination is irrelevant to source legality) but only treats the bottom card as movable as a unit. The visible run ends at the first color break.
- **Drag-into-self**: dragging a card from cascade `i` onto cascade `i` is a no-op; the engine snaps the card back without consuming an undo slot.
- **Auto-complete on win**: when the board's free cells are empty and every cascade is a single descending alternating-color run, "auto-complete" is offered as a single button that animates all remaining cards to foundations (configurable speed: 50 / 120 / 240 ms per card).
- **Move-counter semantics**: a supermove counts as **N atomic moves** for scoring purposes. An undo counts as **+1 move** (not −1) — matches the cardgames.io and FreeCell.io conventions for "fewest moves" leaderboards.

---

## Visual specs

Cellar consumes the following tokens from `@bilkobibitkov/host-kit/styles/game-tokens.css`. **It needs to add 6 new tokens to host-kit** for card-game primitives that don't exist yet (Sudoku and MindSwiffer don't render cards). These are called out below; the PRD that adds them is part of the Cellar set, not a host-kit refactor done elsewhere.

### Reused (already in host-kit)

| Token | Used for |
|---|---|
| `--ink` | Card text (rank, suit), foundation slot label |
| `--paper` | Background of board, card face background |
| `--mark-font` | Rank / suit typography |
| `--mark-size` | Rank glyph size on cards |
| `--cell-active` | Highlight for selected source card |
| `--cell-peer` | Highlight for legal destinations on hover/select |
| `--conflict` | Illegal-move soft red flash |
| `--grid-radius` | Outer board corner rounding |
| `--spring-fast` | Card placement spring, supermove animation |
| `--spring-medium` | Cascade collapse / expand |
| `--duration-tap` | Card move animation (120 ms) |
| `--duration-fade` | Selection-glow fade (220 ms) |
| `--duration-win` | Foundation completion pop (720 ms) |

### New (added to host-kit by Cellar PRD)

| Token | Default | Used for |
|---|---|---|
| `--card-radius` | 8 px | Per-card corner rounding |
| `--card-border` | `color-mix(in oklch, var(--ink) 14%, transparent)` | Hairline card border |
| `--card-shadow-rest` | `0 1px 0 rgba(0,0,0,0.04)` | Stationary card |
| `--card-shadow-lift` | `0 6px 16px rgba(0,0,0,0.10)` | Dragged card |
| `--suit-red` | `#dc2626` | ♥ ♦ rank + pip color |
| `--suit-black` | `#1c1c1e` | ♠ ♣ rank + pip color (matches `--ink`) |

Dark mode (`@media prefers-color-scheme: dark`) overrides `--card-border` to `color-mix(in oklch, var(--ink) 22%, transparent)`, `--suit-red` to `#ff453a`, and leaves `--suit-black` to track `--ink`. No other overrides needed.

### Dimensions

- **Card aspect ratio**: 5:7 (matches standard playing cards; widely used on web FreeCell).
- **Card width on mobile (portrait)**: `calc((100vw - 2 × edge_padding) / 8 - 4px)` — 8 cascades fill the width with 4 px gutter.
- **Cascade fan offset (rest)**: 24 % of card height — top of next card sits 24 % below top of card above.
- **Cascade fan offset (compact)**: 18 % when cascade depth > 12 cards. Engine recomputes per-cascade per move.
- **Free-cell + foundation slot height**: 1.0 × card height (so the top row matches a card slot exactly).
- **Top row gap**: free cells (4 slots) — gap — foundations (4 slots), centered. The "gap" is the visual separator and doubles as the location for hint indicators.

### Animation timings

| Event | Duration | Easing |
|---|---|---|
| Single card move | `--duration-tap` (120 ms) | `--spring-fast` |
| Supermove (per atomic step) | 80 ms | `--spring-fast`, staggered 40 ms apart |
| Card lift on drag start | 120 ms | `--spring-medium` |
| Selection glow appear | `--duration-fade` (220 ms) | linear |
| Foundation pop | 240 ms | `--spring-fast` |
| Foundation completion (King lands) | `--duration-win` (720 ms) | `--spring-fast` w/ scale 1.0 → 1.06 → 1.0 |
| Win confetti (PB only) | 1 600 ms | linear |
| Auto-complete sweep | configurable 50 / 120 / 240 ms per card | linear |

### Reduced motion

All animations respect `@media (prefers-reduced-motion: reduce)` and degrade to instant transitions, **with one exception**: supermoves still animate atomically (even at 0 ms per step) because the visible step-through is the educational beat. Players who want instant supermoves can also toggle `Settings → Show supermove steps: off`.

---

## Layout (mobile-first)

```
┌────────────────────────────────────────┐
│  Bilko · Cellar                   ⚙    │  ← GameShell chrome (host-kit, slim)
├────────────────────────────────────────┤
│  #00617 · 02:14 · 47 mvs · ↺ · Easy   │  ← HUD strip
│  (deal#) (timer) (move count) (restart) (difficulty)
│                                        │
│  ┌──┬──┬──┬──┐    ┌──┬──┬──┬──┐        │  ← top row
│  │  │  │  │  │    │A♠│  │  │  │        │     free cells (4)  +  foundations (4)
│  └──┴──┴──┴──┘    └──┴──┴──┴──┘        │
│                                        │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐      │  ← cascades 0..7, fanned downward
│  │7♥││K♣││3♦││9♣││5♥││J♦││2♠││Q♥│      │
│  │  ││  ││  ││  ││  ││  ││  ││  │      │
│  │6♣││Q♦││..││..││..││..││..││..│      │
│  │  ││  ││  ││  ││  ││  ││  ││  │      │
│  │5♦││J♣││..││..││..││..││..││..│      │
│  │  ││  ││  ││  ││  ││..││..││..│      │
│  │..││..││..││..││..│└──┘└──┘└──┘      │
│  │..││..││..││..││..│                  │
│  │..││..││..││..││..│                  │
│  └──┘└──┘└──┘└──┘└──┘                  │
│                                        │
│  [ Hint ]  [ Undo ]  [ Auto-complete ] │  ← action strip (Auto-complete only when board can sweep)
│                                        │
│  Made by Bilko · bilko.run             │  ← GameShell footer
└────────────────────────────────────────┘
```

**Mobile interaction model:**
- Default: **tap-tap**. Tap a card → its legal destinations glow → tap a destination.
- Drag is supported: drag a card or a legal run; ghost preview shows the landing spot; release on a glowing target commits.
- Double-tap a cascade-top card → if a foundation move is legal, send to foundation.
- Long-press a cascade header → collapse to top card only (mobile-only space saver).

**Desktop additions:**
- Click = select / commit (tap-tap), drag = drag-and-drop (drag mode).
- Keyboard: `← → ↑ ↓` move cursor across cascades / cells / foundations; `Enter` selects / commits; `Space` sends current card to foundation if legal; `U` undo, `R` restart, `H` hint, `Esc` deselects.
- Right-click a card → "Send to foundation" context option (when legal).

---

## Controls

### Touch (mobile)

| Action | Gesture |
|---|---|
| Select card | Tap |
| Move to legal target | Tap (after select) |
| Drag-and-drop | Touch-down + drag + release |
| Send to foundation | Double-tap card |
| Park to free cell | Tap card → tap empty free cell |
| Restart | Tap restart icon in HUD |
| Hint | Tap Hint button |
| Undo | Tap Undo button |
| Auto-complete | Tap Auto-complete button (only visible when sweepable) |
| Collapse cascade | Long-press cascade header (mobile only) |
| Open settings | Tap gear in GameShell chrome |

### Keyboard (desktop)

| Action | Key |
|---|---|
| Move cursor | `← → ↑ ↓` |
| Select / commit | `Enter` or `Space` (Space prefers foundation if legal) |
| Send to foundation | `F` |
| Park to free cell | `C` |
| Undo | `U` (or `Ctrl/Cmd + Z`) |
| Redo | `Ctrl/Cmd + Shift + Z` |
| Restart | `R` |
| Hint (cycle 3 tiers) | `H` |
| Auto-complete | `A` (only when offered) |
| New deal | `N` |
| Specific deal number | `D` then type number then Enter |
| Deselect | `Esc` |

### Screen reader

- The board exposes itself as `role="application"` with a live region announcing every move: *"Five of hearts moved to six of clubs."*
- Each cascade is `role="group"` with `aria-label="Cascade 3, 6 cards, top: queen of diamonds"`.
- Each free cell is `role="region"` with `aria-label="Free cell 2, empty"` or `aria-label="Free cell 2, holds king of spades"`.
- Each foundation is `role="region"` with `aria-label="Hearts foundation, top: 7 of hearts"`.
- Cursor mode is the default for screen-reader users (configurable; on by default if `prefers-reduced-motion: reduce` is set, which is a reliable proxy for assistive-tech users).
- The hint button announces the technique name: *"Hint: free a peer. Move five of hearts to free cell 2 to expose six of clubs."*
- Win announcement: *"Cellar complete. 47 moves, 2 minutes 14 seconds. New personal best."*

---

## Scoring + difficulty

### Difficulty brackets

| Name | Solver nodes | Surfaced share | Notes |
|---|---|---|---|
| **Easy** | < 500 | ~25 % | First-time players, mobile quick games |
| **Standard** | 500–5 000 | ~55 % | The mainline, matches most apps' "Medium" |
| **Hard** | 5 000–50 000 | ~18 % | Requires intentional cell management |
| **Master** | 50 000–200 000 | ~2 % | The 31 465-class deals |
| **Daily** | scales | — | Mon/Tue Easy · Wed/Thu Standard · Fri Hard · Sat/Sun Master |

Brackets are populated **lazily on demand**: the engine generates a candidate deal number from the LCG, runs the solver, and either accepts it into the bracket cache or drops it. Cache hit rate is ~99 % after a few sessions; cold-start uses pre-baked seeds shipped with the bundle.

### Scoring

Two axes, both shown, neither penalizes the other.

**Time score** — wall-clock from first move to last move; pause stops the clock; the timer's purpose is to track personal bests, not pressure the player.

**Move score** — total atomic moves; supermoves count as N; undo counts as +1; restart resets to 0. Encourages planning over thrashing; matches the cardgames.io / FreeCell.io competitive convention.

**Personal bests** — `bestTime[difficulty]`, `bestMoves[difficulty]`. Beating either triggers the subdued PB confetti (once per session per axis); beating both at once triggers a slightly louder pop and a "double PB" badge.

**No leaderboard FOMO**: per-difficulty PB is displayed in stats, but no live ranking, no "you're 14 423rd in the world" banner.

### Daily Cellar

- **One deal per day**, deterministic from `YYYY-MM-DD`.
- **Day-of-week scaling**: Mon/Tue Easy · Wed/Thu Standard · Fri Hard · Sat/Sun Master. Mirrors Sudoku and MindSwiffer.
- **Calendar archive**: tap any past date to play that day's deal. Offline-first via localStorage; cloud-synced when signed in.
- **Streak**: increments on Daily completion. One free "freeze" per week prevents streak-break for one missed day. Same shape as Sudoku PRD 38.
- **No leaderboard, no shared time** in v1 (deferred to a PRD 30 follow-up).
- **Share-tile** on completion: `Cellar 2026-05-09 · Hard · 03:42 · 142 moves · 🟩🟩🟨` (the squares encode time / move bracket vs. solver-optimal).

---

## Copy / reject table

| From | Copy | Reject |
|---|---|---|
| Microsoft Solitaire Collection | Daily challenges, numbered-deal entry (1–1 M), cloud save, calendar archive | XP / level bar, Star Club paywall, Adventure mode, Game Pass cosmetics |
| MobilityWare FreeCell | Daily crown badges, numbered-deal selector, hint with arrow, auto-complete button | Goals/quests system (XP-bait), ad-supported tier, subscription gate |
| Solitaired (web) | Web-first <2 s cold start, statistics dashboard, replay-this-deal | Variant grab-bag (we ship one game), no-premium-tier copy (we go further: no monetization at all) |
| Green Felt | Keyboard-first power play, auto-supermove with atomic animation, deal-share inline | "Today's deal" community comments (no community in v1), green-felt aesthetic (we go hairline-modern), bug-report inline (we run a closed-source solver as ground truth) |
| Cardgames.io | Move counter always visible, undo penalty (+1 move), localStorage persistence | Ad-supported, drag-only input (no tap-tap), no daily, no cloud |
| Brainium FreeCell | Tap-tap default, per-card legal-target glow, minimalist visuals, beginner deal pre-screening | Ad-supported, Brainium account, IAP for ad removal |
| FreeCell Pro | Solver-rated difficulty for any deal, autoplay speed selector, move-history scrubber (deferred) | Customizable card-art packs (skin grind), 8 B deal space (1 M is enough), no daily |
| FreeCell.io / FreeCell Project | Per-deal numbered identity, integer move-count metric, solver-as-coach on loss | Account-required ranked play, friend duels (deferred), live per-deal leaderboard FOMO, ad-supported |

---

## Differentiation: what is *uniquely* Bilko about this

1. **Solver-verified deals + solver-as-coach** — most popular FreeCell clients (Microsoft, MobilityWare, Cardgames.io, Solitaired) ship the raw Microsoft 1–1 M deal space and let the player discover the 8 unsolvable ones the hard way. The competitive clients (FreeCell.io) have solvers but use them post-hoc. **Cellar is the first FreeCell where the solver is part of the player's UX**: it pre-validates every Daily, it powers the level-3 hint with technique naming (Good Sudoku model), and it tells you on loss exactly when the deal stopped being winnable. That's defensible (it requires shipping a real solver, not a heuristic), shippable in v1 (`fc-solve` reference is MIT and ports cleanly to TypeScript in <2 KB gz of code), and brand-coherent ("solvable by thinking, never by guessing" is now Bilko's verbatim tagline across MindSwiffer + Cellar).

2. **The supermove is animated atomically** — every existing FreeCell either disallows multi-card moves entirely (purist) or animates them as a single jump (everyone else). Cellar animates the **constituent atomic moves** at 80 ms each, so the player *sees* the cells being borrowed and returned. It's the educational beat that explains the supermove formula visually instead of in a help screen.

3. **Daily Cellar with day-of-week ramp** — Microsoft has Daily Challenges, but they're four difficulty buckets per day (one each). MobilityWare has Daily, but it's flat. **Cellar has one deal per day, scaled by day**, mirroring Bilko-Sudoku and Bilko-MindSwiffer. The cross-game weekly cadence is the platform's retention shape; FreeCell joining it strengthens the platform.

4. **Cross-game "Puzzler" achievement, extended** — solving 1 Sudoku + 1 MindSwiffer + 1 Cellar unlocks the Bilko-wide Puzzler badge. No app store cross-links Sudoku, Minesweeper, and FreeCell because they live in three separate purchase silos; bilko.run is the shared chrome that makes the cross-link possible.

5. **Free + ad-free + login-optional + open monetization story** — Cellar competes directly with App Store FreeCells without an install barrier, subscription, or IAP. It is hosted on a personal-brand site that already serves 12 paid tools; that's the part that pays. The blog post writes itself: "I rebuilt FreeCell in a weekend with parallel agents. It's free forever. Here's why."

6. **Built in N PRDs by parallel Sonnet agents in one session** — same build-in-public story arc as Sudoku and MindSwiffer. Once Cellar ships, the Bilko Game Studio has a three-game shape and the next entry slots in cleanly.

---

## Why this game over the alternatives I considered

I evaluated four rejected candidates in the strategy/casual/solitaire/abstract category, all 1995–2005 era, all browser-runnable today.

### Rejected: Spider Solitaire (Windows ME, 2003)

- **Pro**: ships with Windows since ME, very recognizable, deep strategy at 4-suit difficulty.
- **Pro**: hidden-information component (face-down cards in the cascades) is a fresh design surface vs. Sudoku/MindSwiffer.
- **Con**: hidden information makes the no-guess promise impossible — Spider has irreducible luck. That breaks the Bilko Game Studio "solvable by thinking" tagline.
- **Con**: solvability is much lower (~30–50 % at 4-suit on random deals); the solver-verified-deals trick doesn't scale.
- **Con**: 10 cascades + 5 deal piles is a denser visual than 8 cascades + 4+4 top row; harder to fit cleanly on a phone.
- **Verdict**: brand-incoherent with the Bilko line. Cellar wins.

### Rejected: Sokoban / "Pusher"

- **Pro**: pure single-player puzzle, single screen, fully deterministic, well-documented (Boxxle, XSokoban level corpora; PSPACE-complete proof).
- **Pro**: tile-pushing is novel input vs. card-tapping or grid-marking.
- **Con**: requires a hand-curated level pack to be any good. Generators exist but produce mostly tedious puzzles; the famous packs are licensed.
- **Con**: the puzzle is *hard*. A 5-minute play session gets you through one easy level or stuck on a medium one. The retention loop is "next level" not "next deal", which doesn't match the Daily/streak shape.
- **Con**: visual is grid-of-tiles which overlaps too much with MindSwiffer.
- **Verdict**: deferred. Could be entry #5 or #6 if we build a curation pipeline. Cellar wins this round.

### Rejected: Reversi / Othello / "Flip-Flop"

- **Pro**: 8×8 board, perfect-information, beautiful symmetry, alpha-beta AI is well-trodden territory (WZebra, Edax engines, MIT-licensed reference code abundant).
- **Pro**: strategy depth is enormous; pros study endgames for years.
- **Con**: requires an opponent. AI-vs-player breaks the solitaire feel; same-deal-everyone-in-the-world doesn't apply (every game is unique because the AI's responses depend on player moves).
- **Con**: the Daily / shared-deal retention loop doesn't map. We could do "puzzle of the day: black to move, mate in 6", but that's a different genre (chess puzzle) and demands a much more sophisticated curation pipeline.
- **Con**: ≤5-min sessions are hard — a typical Othello game takes 5–15 min; cutting it short feels bad.
- **Verdict**: misfit for the Bilko Game Studio "deterministic shared puzzle" shape. Saved for a "vs AI" sub-line if we ever launch one.

### Rejected: Klondike Solitaire ("Patience")

- **Pro**: the most-played solitaire on earth, immediate name recognition.
- **Pro**: ships with every Windows since 3.0; the truest "1995–2005 single-screen mini-game".
- **Con**: solvability is ~80 % even with three-card draw, ~95 % at one-card draw — well below FreeCell's 99.999 %. The "no unwinnable deals" promise is much weaker.
- **Con**: hidden cards in the tableau make the open-information ethic untrue.
- **Con**: the Microsoft deal-numbering convention exists but is far less famous; the social-object value is lower.
- **Con**: design space is identical to FreeCell (cascades + foundations + waste) but with weaker mechanics. Picking Klondike over FreeCell is the inferior call on every dimension.
- **Verdict**: FreeCell strictly dominates. Cellar wins.

### Rejected: Mahjong Solitaire ("Shanghai")

- **Pro**: huge installed base (Windows 7+ Shanghai, Asian portals).
- **Pro**: tile-matching is visually distinctive.
- **Con**: requires culturally specific tile art (bamboos, characters, flowers) that's hard to do well and harder to do legally — even clean-room redesign treads close to copyrighted set-design choices.
- **Con**: 144 tiles in a 3D layout doesn't fit a phone screen without zoom/pan.
- **Con**: "game tree" is shallow — the strategy is mostly "match what's accessible"; deep play exists but isn't the median experience.
- **Verdict**: visual / cultural / tactile barriers too high for a v1 Bilko game.

**Cellar wins** on: solvability promise (99.999 %), open information ethic, Microsoft deal-number social object (50-year-old shared identifier), single-screen fit, ≤5-min sessions, mature solver / generator / academic literature, and the platform-shape match with Sudoku + MindSwiffer.

---

## Open questions

These are the calls a designer / Bilko need to make before PRDs are written.

1. **Is the solver bundle worth the byte cost?** A TypeScript port of `fc-solve` core, even minified, is probably 8–15 KB gz. That's well inside the 300 KB budget — but it's the single biggest line item. Alternative: ship pre-baked solver verdicts for all 1 M Microsoft deals as a 1 MB compressed lookup table (decompresses to ~125 KB in memory) and skip the in-browser solver entirely, losing only the live "stuck → coach" feature. **Bilko call**: full solver (live coach + dynamic difficulty) vs. lookup table (smaller, faster cold start, no live coach)?

2. **Foundation lock — default on or off?** Microsoft's classic FreeCell allows pulling cards back from foundations (default *off*: foundations are not locked). Modern competitive clients lock foundations once a card lands. The lock-off default is more permissive (helps casual players); lock-on default is more honest about scoring. **Bilko call**: default to classic (unlocked) and offer a setting, or default to locked and offer a setting?

3. **Day-of-week ramp — mirror Sudoku or invert it?** Sudoku and MindSwiffer go Mon-easy → Sun-hard (Good Sudoku model). FreeCell may want the *opposite* — the hardest-to-quit deals on Mondays when players have time after work, and easier deals on weekends when sessions are shorter and more interrupted. There's no precedent either way in the FreeCell market. **Bilko call**: mirror the Sudoku/MindSwiffer ramp for cross-game consistency, or invert it for FreeCell-specific behavior?

4. **Atomic-move animation: gift or distraction?** The "see the supermove step through" beat is design rule 3, but in a fast-played power session it can feel like the game is moving in slow motion. We default it on, but should the toggle live in **Settings** (low discoverability, principled) or as an **HUD button** (high discoverability, tempting)? The HUD button risks normalizing instant-supermoves and undermining the educational beat. **Bilko call**: setting-only, or surface in HUD?

5. **Accept any Microsoft deal number, even the 8 unsolvables, or block them?** Block-them protects the "every deal is winnable" promise but breaks the "any deal number works" promise. Allow-with-warning preserves both at the cost of a (rare) UX confrontation. The same question applies to deals that the solver labels Master+ (e.g. node count > 200 000) — do we surface them at all? **Bilko call**: allow with warning (recommended), or block (purist)?

---

## References

- [FreeCell — Wikipedia](https://en.wikipedia.org/wiki/FreeCell) — Paul Alfille (1978), PLATO, supermove formula, solvability, Internet FreeCell Project
- [Microsoft FreeCell — Wikipedia](https://en.wikipedia.org/wiki/Microsoft_FreeCell) — Jim Horne port, Win32s 1992, Windows 95+, deal numbering, 1 M expansion
- [Solitaire Central — Paul Alfille](http://www.solitairecentral.com/inventors/PaulAlfille.html) — biography, PLATO origin, design intent
- [The Minds Behind FreeCell (FreeSolitaire blog)](https://www.freesolitaire.com/posts/posts-blogs/the-minds-behind-freecell) — Alfille → Horne lineage
- [Slashdot — How Windows FreeCell Gave Rise to Online Crowdsourcing](https://games.slashdot.org/story/12/04/12/1418240/how-windows-freecell-gave-rise-to-online-crowdsourcing) — Internet FreeCell Project as proto-Mechanical-Turk
- [The Gameological Society — "Unbeatable" (deal #11982 history)](http://gameological.com/2012/04/unbeatable/) — narrative of the impossible deal
- [solitairelaboratory.com — FreeCell FAQ](http://solitairelaboratory.com/fcfaq.html) — deal numbering history, Don Woods' 1994 study, dealing-algorithm provenance
- [solitairelaboratory.com — Lists of difficult and easy deals](http://www.solitairelaboratory.com/fclists.html) — hardest deal #31465; 199 hard-with-3-cells deals
- [online-solitaire.com — Deal #11982 deep dive](https://online-solitaire.com/blog/freecell-and-its-unsolvable-games-game-11982-and-the-99-999/) — solvability analysis, the 8 unsolvable Microsoft deals (#11982, #146692, #186216, #455889, #495505, #512118, #517776, #781948)
- [FreeCell Solver — Shlomi Fish (fc-solve)](https://fc-solve.shlomifish.org/) — atomic-move solver, MIT-licensed reference for our TypeScript port
- [FreeCell Solver — Architecture document](https://fc-solve.shlomifish.org/arch_doc/fcs_arch_doc.raw.html) — heuristic design, state hashing
- [FreeCell Solver — Features list](https://fc-solve.shlomifish.org/features.html) — meta-move vs. atomic-move trade-offs
- [Rosetta Code — Deal cards for FreeCell](https://rosettacode.org/wiki/Deal_cards_for_FreeCell) — LCG parameters in 50+ languages, dealing-order spec
- [Linear congruential generator — Wikipedia](https://en.wikipedia.org/wiki/Linear_congruential_generator) — Microsoft C `rand()` parameters (214013, 2531011, 2³¹)
- [FreeCell rules — Solitaire Stack](https://solitairestack.com/freecell-rules) — supermove formula authoritative source
- [How to Play FreeCell — Wikipedia rules](https://en.wikipedia.org/wiki/FreeCell#Rules) — auto-move-to-foundation heuristic
- [FreeCell Strategy Guide — Solitaire Stack](https://solitairestack.com/strategy) — technique vocabulary for the hint system
- [Microsoft Solitaire Collection — App Store](https://apps.apple.com/us/app/microsoft-solitaire-collection/id1153724038) — daily, star club, cloud save
- [MobilityWare FreeCell — Play Store](https://play.google.com/store/apps/details?id=com.mobilityware.freecell) — goals system, daily crown badges
- [Solitaired FreeCell](https://solitaired.com/freecell) — web-first, statistics dashboard, no-premium model
- [Green Felt FreeCell](https://greenfelt.net/freecell) — keyboard-first, auto-supermove with atomic animation
- [Cardgames.io FreeCell](https://cardgames.io/freecell/) — undo-as-penalty move-counter convention
- [Brainium FreeCell help center](https://brainium.helpshift.com/hc/en/8-freecell/) — tap-tap default, beginner pre-screening
- [FreeCell Project (FreeCell.io sibling)](https://www.freecellproject.com/en/about) — competitive web, per-deal leaderboard, solver-as-coach
- [Hardcore Droid — Best FreeCell Solitaire Apps for Mobile](https://www.hardcoredroid.com/the-best-freecell-solitaire-apps-for-mobile-devices/) — FreeCell Pro, market context
- [Solitaire Bliss — Best Solitaire Apps of 2026](https://www.solitairebliss.com/blog/best-solitaire-app) — current market overview, monetization comparison
- [Apple Human Interface Guidelines — Games](https://developer.apple.com/design/human-interface-guidelines/games)
- `docs/sudoku-research.md` — sibling design brief; Cellar mirrors its structure
- `docs/mindswiffer-research.md` — sibling design brief; Cellar inherits the no-guess / Daily / streak shape
- `~/Projects/Bilko-Host-Kit/styles/game-tokens.css` — token definitions Cellar consumes; new `--card-*` and `--suit-*` tokens added by a Cellar-set PRD
