# MindSwiffer market research + Bilko-Minesweeper design brief

Reference doc that grounds the MindSwiffer PRD set (41–46). Read this before picking up any of those PRDs — it's the "why" behind every UI choice. Every subsequent PRD references this file, not the internet.

## Top 8 Minesweeper apps surveyed (2026)

Sourced from current web, iOS App Store, and known long-running titles. We're calling out **8 features** per app — the ones that show up most prominently in their UX or that are worth stealing / refusing.

### 1. minesweeper.online

The de-facto competitive standard for web Minesweeper. Free, ad-supported; premium removes ads and unlocks cosmetics.

1. **Global leaderboards with per-difficulty time rankings** — separate boards for Beginner, Intermediate, Expert, and Custom; top 10 shown live in sidebar.
2. **Custom grid creator** — arbitrary W×H with mine count slider; shareable via URL.
3. **Replay system** — every solved game has a full replay (cursor path, timestamps, clicks).
4. **Non-customizable chord click** — left+right mouse simultaneously reveals all unflagged neighbors of a satisfied number, accelerating expert play.
5. **"NF" (no-flag) mode** — advanced scoring bracket for players who solve without ever placing a flag.
6. **BV/s metric** — "Board Value per second", the competitive community's speed-adjusted quality score.
7. **Mobile pinch-to-zoom** — the board scales to any viewport; panning is fluid.
8. **No no-guess option** — puzzles are classically random; 50/50 corners exist and are accepted as part of expert play.

### 2. Microsoft Minesweeper

Pre-installed on Windows; available on Xbox via Microsoft Casual Games. Free with optional cosmetics via Xbox Game Pass.

1. **Daily Challenges** — one Beginner/Intermediate/Expert puzzle per day with a shared timer, streak counter, and calendar archive.
2. **Adventure Mode** — a themed story-mode campaign (Jungle, Undersea, etc.) with custom mine layouts and collectible rewards; unique among Minesweeper ports.
3. **Cloud save via Microsoft account** — streak and completion history sync across Windows devices.
4. **Multiple themes and board skins** — wooden, space, holiday; unlocked through play or Game Pass subscription.
5. **Speed Minesweeper** — a timed sprint mode where boards auto-generate and correct cells are auto-scored.
6. **Achievements tied to Xbox profile** — "Boom!" for first mine hit, "Defused" for 100 wins, etc.
7. **Full accessibility / screen-reader support** — announced moves, announced neighboring mine counts, keyboard-only play.
8. **XP and levelling system** — wins and dailies contribute to a persistent level bar shown on the home screen.

### 3. Google Doodle Minesweeper (Google Search)

The classic 1996 Minesweeper reimagined as an interactive Google Doodle; ephemeral (lives at google.com when triggered). Minimal and no-account.

1. **Three difficulty tiles on entry** — Easy, Medium, Hard depicted as illustrated scenes, not raw number grids.
2. **Zero-chrome board** — no timer, no counter; the entire experience is just the grid and a mine count badge.
3. **Illustrated mine sprite** — styled as a cartoon bomb, consistent with Doodle visual language.
4. **No chord click** — deliberate simplicity; click + right-click only.
5. **Keyboard-inaccessible** — mouse/touch only; no tab focus, no keyboard reveal.
6. **Touch flag via long-press** — correctly implemented on mobile.
7. **One-page, no-navigation** — exit means full page back; there is no main menu.
8. **No save, no streak** — purely ephemeral; closing the tab loses the game permanently.

### 4. Cardgames.io Minesweeper

Broad-appeal browser game hub. Free, ad-supported; Solitaire Grand Harvest DNA.

1. **Instant play, no account** — cold-start to first cell click in under 3 seconds.
2. **Three classic sizes** — Beginner, Intermediate, Expert; no custom grid.
3. **Optional auto-flag** — toggle that flags unrevealed cells that the engine determines are definitely mines; a training-wheel feature.
4. **Right-click to flag, right-click again to mark ?** — three-state cell cycling (empty → flag → question mark → empty).
5. **Animated win state** — fireworks overlay and an elapsed-time badge on puzzle complete.
6. **Persistent best times in localStorage** — no account required; survives browser sessions via localStorage.
7. **Desktop-only feel on mobile** — pinch-to-zoom works but the grid renders at desktop density; not truly touch-optimized.
8. **Adjacent mine count on hover (desktop)** — hovering an unrevealed cell shows a tooltip with how many mines the cursor is adjacent to; a controversial "lite hint" not present in competitive clients.

### 5. Minesweeper Q (iOS)

Premium-feel iOS remake by a solo developer. One-time purchase ($1.99). Regularly cited in "best iPhone Minesweeper" roundups.

1. **Haptic feedback** — distinct patterns for reveal (light), flag (medium), mine hit (error), win (success).
2. **Three-finger tap to restart** — gesture-native; no confirmation dialog.
3. **Custom color themes** — six hand-crafted palettes with accurate dark-mode variants; no skeuomorphic chrome.
4. **Flag/chord mode toggle** — a single-tap button switches between "tap reveals" and "tap flags" modes, solving the iOS ambiguity without long-press delay.
5. **Configurable long-press delay** — 200 ms / 350 ms / 500 ms; power users set it low, newcomers set it high.
6. **Game Center leaderboard** — best times per difficulty, globally ranked.
7. **Per-session statistics** — mines found, mines hit, accuracy %, time.
8. **No no-guess mode** — classic random generation; 50/50 guess situations are present and acknowledged in the App Store description as "part of Minesweeper."

### 6. iSweeper (iOS)

Long-running iOS touch variant by Niels van Kampen. Free with ads; $0.99 to remove.

1. **Tap-to-flag-first default** — unlike most apps, the default interaction is flag on tap, reveal on long-press (reversible in settings). Optimizes for cautious casual play.
2. **Color-blind mode** — replaces the standard 8-color number palette with shapes + colors, satisfying WCAG AA.
3. **Auto-open on first tap** — the first click always reveals a safe cell and flood-fills at least 9 cells, eliminating first-move luck.
4. **Animated mine counter** — the remaining-mine badge ticks down with a spring animation as flags are placed.
5. **Zoom mode** — double-tap a region to lock zoom at 2× for precise flag work on large grids.
6. **Statistics with histograms** — win distribution over 30 days, best time trend line per difficulty.
7. **iPhone widget** — "Today's score" compact widget showing win/loss streak.
8. **No daily puzzle** — every game is a freshly generated random grid; no shared-puzzle retention hook.

### 7. Minesweepergame.com (no-guess mode)

A niche web Minesweeper client focused specifically on no-guess (deducible) puzzle generation. Free, no account.

1. **No-guess generator as the default, not an option** — the site's headline feature; every puzzle is provably solvable without guessing.
2. **"Classic mode" opt-in toggle** — players who want the traditional random experience can enable it; the game remembers the preference.
3. **Generator transparency** — a seed is shown for every puzzle and can be replayed by pasting into any standard Minesweeper engine.
4. **Server-side generation** — puzzles are generated server-side, validated via constraint propagation, and delivered as a board string; client never rolls its own mines.
5. **Minimal UI** — no themes, no sounds, no leaderboards; the no-guess feature is the entire value proposition.
6. **No daily** — purely on-demand; no shared puzzle cadence, no streak.
7. **No mobile optimization** — desktop-only effective; touch-unfriendly cell density.
8. **Open generation algorithm linked in footer** — references academic papers on no-guess Minesweeper generation (Cicero / Kyber constraint propagation).

### 8. Hexcells / Tametsi (Steam; adjacent genre)

Logic-deduction sweepers that replace randomness with designed puzzles. PC/Mac only (Steam). Hexcells: $2.99; Tametsi: $4.99.

1. **Every puzzle is author-designed** — no generator; each level is a hand-crafted deduction chain. Serves as the proof-of-concept that "zero guesses" is viable at scale.
2. **Hexagonal grid (Hexcells) / triangular tiling (Tametsi)** — non-square topologies create new constraint shapes impossible on a standard grid.
3. **Column and diagonal hints** — in addition to adjacency counts, cells may show counts for entire rows, columns, or diagonals of the hex grid.
4. **Non-contiguous hint shapes** — a "ring" hint counts mines in a radius-2 shell, not just adjacency; teaches players that constraint propagation generalizes.
5. **Progressive puzzle unlock** — chapters gate on completion count; you can't skip ahead.
6. **Mistake limit as difficulty selector** — some Hexcells+ puzzles have a "0 mistakes allowed" hard mode where any wrong flag ends the run.
7. **No timer pressure on most levels** — completion is the goal, not speed; removes anxiety that makes casual players give up.
8. **Steam Workshop support (Tametsi)** — community-contributed puzzle packs; the longest-tailed content model in the genre.

---

## Synthesized feature catalog

Every recurring feature, grouped. **Bold** = in scope for MindSwiffer v1. *Italic* = explicitly deferred.

### Core gameplay
- **Variable grid with mine counts: Sweep Lite 5×5/3, Beginner 9×9/10, Intermediate 16×16/40, Expert 30×16/99**
- **Left-click / tap to reveal; right-click / long-press to flag**
- **Chord click** — click a number whose flag count equals it → reveal all unflagged neighbors
- **Flood-fill on zero-cell reveal** — automatically cascades through all adjacent safe cells
- **No-guess generator (default)** — every puzzle is provably solvable by constraint propagation alone; never a 50/50 forced guess
- **Classic mode opt-in** — players who want traditional random mines can enable it
- *Hexagonal / triangular grid variants*
- *Custom grid (arbitrary W×H)*

### Hints & teaching
- **Three-tier hint system** — highlight a deducible region → narrow to a specific cell → reveal and name the technique (e.g. "constraint subset")
- **"Safe first click" guarantee** — first reveal always opens a safe cell, flood-filling at least 9 cells; no first-move luck
- **Mistake counter as soft fail-state** — configurable: off / 3 strikes; no instant game-over by default
- *Interactive deduction tutorial*
- *"NF mode" competitive bracket*

### Daily + retention
- **Daily puzzle, deterministic by date** — same board for all players that day; day-of-week scales difficulty (Mon easy → Sun expert, mirrors Good Sudoku model)
- **Streak counter with one weekly freeze** — matches the Sudoku PRD 38 shape
- **Calendar archive** — play any past daily
- *Seasonal events*

### Statistics + achievements
- **Per-difficulty: best time, average time, win rate, total wins**
- **Total games played, total mines found**
- **Streak and longest streak**
- **Achievements via PRD 30 platform game services** — first win, sub-30-sec Beginner, 7-day streak, Expert solve, cross-game "Puzzler" (1 Sudoku + 1 MindSwiffer)
- **Leaderboards via PRD 30** — best times per difficulty + daily shared board

### Persistence
- **Auto-save in-progress game; resume on launch**
- **Cloud save when signed in** via PRD 30 game services
- **Local-first; cloud opt-in**

### Visual & feel (Apple-grade)
- **Hairline grid** — `--grid-line-thin` between cells; `--grid-line-thick` for outer border
- **Classic 8-color number palette** — `--num-1` blue through `--num-8` grey; hairline only, no 1995 bevels
- **Cover/reveal animation** — clean `--duration-fade` fade-out of `--cell-cover` to `--cell-revealed`; no skeuomorphic depression
- **Flag plant animation** — spring-in at `--spring-fast` / `--duration-tap`
- **Confetti only on personal best** — completing a puzzle without a PB gets a silent check; beating your best time gets the confetti
- **Reduced-motion respects system setting**
- *Skins / cosmetic themes*

### Input
- **Tap and hold to flag (mobile)** — configurable delay in settings
- **Flag/reveal mode toggle button** — single-tap switches modes for players who dislike long-press
- **Keyboard: arrows + Space (reveal) + F (flag) + C (chord) + R (restart)**
- **No undo** — deliberate; one wrong click has consequences; Hexcells proved this is the correct stance for logic sweepers

### Platform integration
- **Hosted at bilko.run/projects/mindswiffer/** as static-path sibling
- **Brand chrome** via `@bilkobibitkov/host-kit` `<GameShell>`
- **Free, no ads, login-optional**
- **Analytics via `/api/analytics/event`** (same-origin, PRD 27)
- **Cross-game "Puzzler" achievement** — unlocks when a user has solved at least 1 Sudoku + 1 MindSwiffer

---

## Difficulty bracket table

| Name | Grid | Mines | Mine density | Notes |
|---|---|---|---|---|
| **Sweep Lite** | 5 × 5 | 3 | 12 % | Bilko-only; first-time players, mobile tutorial |
| **Beginner** | 9 × 9 | 10 | 12 % | Classic Windows spec |
| **Intermediate** | 16 × 16 | 40 | 16 % | Classic Windows spec |
| **Expert** | 30 × 16 | 99 | 21 % | Classic Windows spec |
| **Daily** | scales | scales | ~16 % | Mon = Beginner, Tue–Wed = Intermediate, Thu–Fri = Expert, Sat = Expert, Sun = Expert — same day-of-week ramp as Good Sudoku |

No-guess constraint applies to all difficulties. Classic-mode opt-in available on all except Daily (Daily is always no-guess).

---

## Bilko-MindSwiffer design philosophy

Distilled into 5 rules. Every PRD acceptance criterion ties back to one of these.

### 1. No 50/50s, ever

Default mode is no-guess. Every puzzle MindSwiffer ships is validated by constraint propagation before being presented to the player. The game pledges it: "Solvable by thinking, never by guessing." Classic (random) mode exists as an opt-in for veterans who want it, but it is not the default and never the Daily.

### 2. The cover IS the puzzle

An unrevealed cell is the densest information surface in the game. Its color, hover state, flag overlay, and tap feedback get more design love than the surrounding chrome. `--cell-cover` is never a dull grey; it has a hairline inner shadow and a faint surface texture. The moment of reveal — cover fading to `--cell-revealed` — is the game's main animation beat.

### 3. Restraint over skeuomorphism

No 1995 bevels. No smiley-face-with-sunglasses restart button. No LCD mine counter font. Hairline grid lines, system font, classic numerals in `--num-1`..`--num-8`. The game looks like it was designed in 2026, not skinned on top of a 1992 .exe.

### 4. One wrong click is the consequence, not the UI

There is no undo. The game expects players understand Minesweeper. No interactive onboarding; a single dismissible tooltip on the first cover-tap. Mistake counter (soft fail) is configurable; hard fail (instant game-over) is not on by default. Hexcells proved that players accept consequence when puzzles are fair.

### 5. No dark patterns

No timed offers. No streak-anxiety push notifications. No leaderboard FOMO banners. No "resume for 3 hints/day" gate. MindSwiffer is free, calm, and ad-free. The bilko.run host covers its bills via the paid tools; MindSwiffer's job is to be good.

---

## Visual specs

MindSwiffer consumes the following tokens from `@bilkobibitkov/host-kit/styles/game-tokens.css` (shipped in PRD 40). **No new CSS variables are defined in the MindSwiffer repo** — every visual decision maps to an existing token.

| Token | Used for |
|---|---|
| `--cell-cover` | Unrevealed cell background |
| `--cell-revealed` | Revealed safe cell background |
| `--mine` | Mine icon color (on lost-game expose) |
| `--flag` | Flag icon color + planted-flag indicator |
| `--num-1` | Adjacency count "1" — blue |
| `--num-2` | Adjacency count "2" — green |
| `--num-3` | Adjacency count "3" — red |
| `--num-4` | Adjacency count "4" — dark violet |
| `--num-5` | Adjacency count "5" — dark amber |
| `--num-6` | Adjacency count "6" — teal |
| `--num-7` | Adjacency count "7" — near-black |
| `--num-8` | Adjacency count "8" — mid-grey |
| `--grid-line-thin` | Cell dividers (1 px) |
| `--grid-line-thick` | Outer board border (2 px) |
| `--cell-radius` | Per-cell corner rounding (2 px) |
| `--grid-radius` | Outer board corner rounding (12 px) |
| `--mark-size` | Adjacency number font size |
| `--conflict` | Incorrect flag highlight on game-over |
| `--spring-fast` | Flag plant, chord-reveal spring |
| `--duration-tap` | Cover-fade on reveal (120 ms) |
| `--duration-fade` | Number fade-in after reveal (220 ms) |

Dark-mode variants (`--cell-cover` dark, `--cell-revealed` dark, etc.) are defined in `game-tokens.css` and activate automatically via `@media (prefers-color-scheme: dark)`. MindSwiffer overrides nothing.

---

## Layout (mobile-first)

```
┌────────────────────────────────────┐
│  Bilko · MindSwiffer          ⚙    │  ← GameShell chrome (host-kit, slim)
├────────────────────────────────────┤
│  💣 12  ·  01:43  · ↺  · Beginner │  ← HUD strip
│  (mines left) (timer) (restart) (diff selector)
│                                    │
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │                              │  │
│  │   Board (square, max 96vw)   │  │  ← hero — grid fills screen
│  │   cells scale to fill width  │  │
│  │                              │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│                                    │
│  [ Flag mode: OFF ]  [ Hint ]      │  ← action strip
│                                    │
│  Made by Bilko · bilko.run         │  ← GameShell footer
└────────────────────────────────────┘
```

**Mobile interaction model:**
- Default: tap = reveal, long-press = flag.
- Flag mode toggle in action strip switches to: tap = flag, long-press = reveal.
- No number pad (unlike Sudoku) — all interaction is direct on the board.
- Chord: tap a satisfied number to chord-reveal its neighbors (no modifier needed on mobile).

**Desktop additions:**
- Left-click = reveal, right-click = flag.
- Keyboard: `Arrow` keys navigate, `Space` reveals, `F` flags, `C` chords, `R` restarts, `1-4` select difficulty.

---

## What we deliberately copy vs reject

| From | Copy | Reject |
|---|---|---|
| minesweeper.online | Chord click, mobile pinch-to-zoom, custom grid (future), replay concept | BV/s metric (too competitive for casual), no-flag bracket, zero no-guess option |
| Microsoft Minesweeper | Daily challenge calendar, streak counter, cloud save, accessibility / keyboard nav | XP bar and levelling, Adventure Mode story campaign, cosmetic unlock grind, Game Pass paywall |
| Google Doodle | Illustrated entry tiles for difficulty selection, minimal chrome, tap-to-flag on mobile | Zero keyboard support, no save, no streak, completely ephemeral |
| Cardgames.io | Instant play cold-start (<3 s), three classic sizes, localStorage best times | Auto-flag training wheel (removes deduction), hover-tooltip mine count hint, desktop-only density |
| Minesweeper Q | Haptic feedback patterns, flag/reveal mode toggle, gesture-native restart, dark mode palettes | No no-guess mode (that's our headline), Game Center dependency |
| iSweeper | Color-blind number palette mode, auto-open safe first click, animated mine counter, zoom on large grids | Tap-first-flag default (too cautious for our UX), no daily retention hook |
| minesweepergame.com | **No-guess generator as default** (core steal), classic-mode opt-in toggle, seed transparency, server-side validation | No daily, no mobile optimization, no streak — we build on top of their concept |
| Hexcells / Tametsi | No-undo discipline, zero 50/50 design, mistake-limit as difficulty knob, "thinking not guessing" brand positioning | Hand-authored levels (we generate), Steam-only distribution, hex/triangle topology (future) |

---

## Differentiation: what is uniquely Bilko about this

1. **No-guess generator as the headline feature** — most popular Minesweeper clients (minesweeper.online, Cardgames.io, Microsoft, iSweeper, Minesweeper Q) ship classic random generation. The only no-guess competitors are niche (minesweepergame.com has no daily, no streak, no mobile) and the adjacent-genre Hexcells/Tametsi (PC-only, hand-authored). MindSwiffer is the first no-guess Minesweeper with a polished daily-puzzle + streak retention loop.

2. **Daily puzzle scaled by day-of-week** — borrowed from Good Sudoku but novel for Minesweeper. Monday's Beginner puzzle and Sunday's Expert puzzle share the same daily URL cadence, creating a weekly arc of difficulty that drives Mon–Sun engagement.

3. **"Sweep Lite" 5×5/3 difficulty** — no commercial Minesweeper ships a sub-Beginner grid. Bilko adds one explicitly for new players and mobile users who want a 30-second game. Lowers the "I've never played this before" barrier without dumbing down the core product.

4. **Cross-game "Puzzler" achievement** — solving 1 Sudoku + 1 MindSwiffer unlocks a Bilko-wide badge visible in the user's profile. No other casual game platform cross-links Sudoku and Minesweeper because they live in separate app stores; bilko.run is the shared chrome that makes this possible.

5. **Free + ad-free + login-optional, on a personal-brand site** — the game competes directly with App Store titles without an install barrier, subscription, or IAP. MindSwiffer's monetization is zero; the host's paid tools subsidize it.

6. **Built in 6 PRDs by parallel agents in one session** — the build-in-public story mirrors the Sudoku sprint. That's the blog post.

---

## References

- [minesweeper.online](https://minesweeper.online) — competitive web client
- [Microsoft Minesweeper (Microsoft Store)](https://www.microsoft.com/en-us/p/microsoft-minesweeper/) — daily challenges, adventure mode
- [Hexcells on Steam](https://store.steampowered.com/app/265890/Hexcells/) — designed no-guess deduction sweeper
- [Tametsi on Steam](https://store.steampowered.com/app/709920/Tametsi/) — extended constraint logic sweeper
- [minesweepergame.com no-guess mode](https://minesweepergame.com) — no-guess generator reference
- [Minesweeper Q on App Store](https://apps.apple.com/app/minesweeper-q/id1450482876) — premium iOS remake
- [iSweeper on App Store](https://apps.apple.com/app/isweeper/id306059608) — touch-first iOS variant
- [Cardgames.io Minesweeper](https://cardgames.io/minesweeper/) — browser quick-play
- [On Minesweeper no-guess generation (academic survey)](https://pwmarcz.pl/blog/kaboom/) — "Kaboom" analysis of 50/50 probability in classic Minesweeper
- [Kyber no-guess Minesweeper generator](https://github.com/nickmccullum/minesweeper-solver) — constraint propagation approach
- [Apple Human Interface Guidelines — Games](https://developer.apple.com/design/human-interface-guidelines/games)
- `docs/sudoku-research.md` — sibling design brief; MindSwiffer mirrors its structure
- `~/.claude/session-manager/scheduled-plans/prds/40-game-shell-host-kit.md` — PRD 40 token definitions (`--cell-cover`, `--num-1`..`--num-8`, etc.)
