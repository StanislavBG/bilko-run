# FizzPop market research + Bilko-FizzPop design brief

Reference doc that will ground the FizzPop PRD set (game #3 in the Bilko Game Studio after Sudoku and MindSwiffer). Read this before picking up any of those PRDs — it's the "why" behind every UI choice. Every subsequent PRD references this file, not the internet.

FizzPop is Bilko's renamed take on the **bubble-shooter / Puzzle Bobble** genre — a 1994 Taito arcade game whose "aim, match-3, pop" loop has remained the most-cloned puzzle mechanic on the open web for thirty-plus years. We pick it because, alone among the popular arcade-reflex genres of 1995–2005, it ports naturally to the Bilko **daily-puzzle + streak + calendar** retention pattern that Sudoku and MindSwiffer already share.

---

## TL;DR

**FizzPop is a single-screen aim-and-pop bubble shooter inspired by Taito's 1994 _Puzzle Bobble_ / _Bust-A-Move_, rebuilt as a calm, ad-free, mobile-first browser game.** Among action/arcade candidates from 1995–2005, it is the only genre whose levels can be shipped as **deterministic daily puzzles** (a designed 12-row layout + a fixed RNG seed for the bubble queue) — every other reflex game in that era is a high-score chase that fights the daily-calendar retention model. The Bilko twist is **"Daily Solvable"**: every daily puzzle ships with a guaranteed clear-the-board solution validated by an offline solver, so the daily is a logic-and-aim challenge — not a luck check — and the player always has a target to chase ("clear in N shots").

---

## The original (cited)

**Puzzle Bobble** (called **Bust-A-Move** in North America) was developed by Taito and released in arcades in **June 1994**, running on Taito's B-System hardware under the working title _Bubble Buster_; on **December 21, 1994** SNK published it on the Neo Geo MVS/AES, where its near-identical port introduced it to a global audience that the B-System cabinet had never reached ([Wikipedia — Puzzle Bobble](https://en.wikipedia.org/wiki/Puzzle_Bobble), [arcade-history.com](https://www.arcade-history.com/?n=puzzle-bobble&page=detail&id=21224)). The game was a spin-off of Taito's 1986 platformer _Bubble Bobble_ — the dragons Bub and Bob became the cannon-operating mascots — and it inherited the parent series' "characteristically cute Japanese animation and music" alongside a brand-new tile-matching mechanic ([Bubble Bobble Wiki — Puzzle Bobble](https://bubblebobble.fandom.com/wiki/Puzzle_Bobble)). Commercially it was a runaway hit: it was Japan's **second-highest-grossing arcade PCB software of 1995** behind only _Virtua Fighter 2_ ([Wikipedia — Puzzle Bobble](https://en.wikipedia.org/wiki/Puzzle_Bobble)). The arcade contained 32 levels (later expanded to 100 in the SNES home version), built around a fixed-position pointer at the bottom of the screen, a rotating cannon, and a periodically descending ceiling that compressed the play field as turns elapsed ([bitvint.com — Puzzle Bobble retrospective](https://bitvint.com/pages/puzzle-bobble-bust-a-move)).

The game endured because its core loop is mechanically perfect: **one input (angle), one consequence (snap into the hex grid or pop a cluster)**, with no hidden state. That clarity made it trivially adaptable. Taito alone shipped **_Puzzle Bobble 2_ in 1995** (PlayStation, Saturn, N64, GB, MS-DOS, Mac), **_Puzzle Bobble 3_ in September 1996** (introducing rainbow bubbles that adopt the colour of an adjacent burst), and **_Puzzle Bobble 4_ in December 1997** ([Wikipedia — Puzzle Bobble 2](https://en.wikipedia.org/wiki/Puzzle_Bobble_2), [Wikipedia — Puzzle Bobble 3](https://en.wikipedia.org/wiki/Puzzle_Bobble_3), [Wikipedia — Puzzle Bobble 4](https://en.wikipedia.org/wiki/Puzzle_Bobble_4)). Outside Taito, **Snood** (Dave Dobson, 1996) became the dominant Mac shareware port and a college-dorm phenomenon — selling over 200,000 units and earning the **2004 Shareware Industry Award for Best Action/Arcade Game** ([Wikipedia — Snood](https://en.wikipedia.org/wiki/Snood_(video_game))) — and **Frozen Bubble** (Guillaume Cottenceau, 2001, GPL-licensed Perl/SDL) became the canonical Linux clone, winning Linux Journal's "Favorite Linux Game" reader's choice **six times between 2003 and 2010** ([Wikipedia — Frozen Bubble](https://en.wikipedia.org/wiki/Frozen_Bubble)). The mechanic is now the dominant casual-puzzle pattern on the open web (Bubbleshooter.com, Arkadium, Cardgames.io) and the engine behind King's _Bubble Witch Saga_ trilogy on mobile.

---

## Top 8 modern implementations surveyed (2026)

Sourced from the current iOS App Store, Google Play, browser-game aggregators (CrazyGames, Poki, Arkadium), the open-source ecosystem (Frozen Bubble, the Rembound HTML5 reference), and the canonical 1990s Mac/PC retrospective sites. Six features called out per app — the ones that show up most prominently in their UX or that are worth stealing or refusing.

### 1. Bubbleshooter.com — Ilyon Dynamics

The de-facto "Google bubble shooter" result; the rebuild after the original 2002 site. Free in browser; mobile companion is the most-installed bubble shooter on Google Play (>500M downloads).

1. **9 rows × 17 columns** of mixed-color bubbles on a lavender background — exposes the playfield density up front so first-time players know the scope.
2. **5-shot pity timer**: every five non-popping shots adds a new row from the top; pity counter resets on a successful pop and decays (5 → 4 → 3 → 2 → 1) as more rows appear.
3. **Score multipliers**: 10× bonus for cascade bubbles knocked loose by a primary pop; **2× total** for clearing the field.
4. **Difficulty indicated in-game** with orange-on-yellow tile typography (no separate menu) — difficulty rises as cumulative score rises.
5. **Free, no account required**, no install — the canonical no-friction bubble shooter.
6. **Dedicated "Daily Challenge" sub-game** with themed playfields (Halloween, etc.) but **no calendar archive**: miss the day, lose the puzzle forever.

URL: [bubbleshooter.com](https://www.bubbleshooter.com/) · daily: [bubbleshooter.net/game/bubble-shooter-daily/](https://www.bubbleshooter.net/game/bubble-shooter-daily/)

### 2. Arkadium Bubble Shooter

The premium-feel browser version on Arkadium's portal (also licensed into Washington Post, USA Today, AARP games hubs).

1. **Endless levels** (no fixed level cap) with art that subtly varies as score climbs.
2. **Lightning bonus bubbles** that pop large numbers of bubbles on impact — the only pop-style power-up in the genre's mainstream web tier.
3. **Global leaderboard** ("see how your score compares against players worldwide") — competitive but optional.
4. **Save game** in localStorage so a tab close doesn't kill the run.
5. **Sponsor-message rewarded video** for "extra moves" — Arkadium's only monetization touch; no banner ads, no popups.
6. **Mouse-only on desktop**; touch-aim on mobile is precise but not mobile-first.

URL: [arkadium.com/games/bubble-shooter](https://www.arkadium.com/games/bubble-shooter/)

### 3. Frozen Bubble — Guillaume Cottenceau (2001, GPL-2.0)

The canonical open-source Linux clone, written in Perl + SDL. Still maintained; available on Flathub, F-Droid, and Steam (community port).

1. **100 hand-designed levels** + a built-in **level editor** — the only mainstream clone whose puzzles are author-designed rather than generator-spat.
2. **Multiplayer**: split-screen, LAN, and Internet for 2–5 players (extremely rare in the genre).
3. **Tux mascot**, fully GPL-2.0 art and music — every asset legally remixable.
4. **Awarded** Linux Journal Reader's Choice "Favorite Linux Game" six times (2003–2010); Linux Game Tome's Best Free Game 2003.
5. **Soundtrack composed in FastTracker II** by Matthias Le Bidan — chiptune-adjacent, beloved.
6. **Cross-platform via Java port**: Android, Symbian, gp2x, Windows Phone 7, and current desktop platforms via Flatpak.

URL: [frozen-bubble.org](https://www.frozen-bubble.org/) · code: [github.com/kthakore/frozen-bubble](https://github.com/kthakore/frozen-bubble) · Wikipedia: [Frozen Bubble](https://en.wikipedia.org/wiki/Frozen_Bubble)

### 4. Snood — Dave Dobson (1996, Mac shareware → 1999 Windows)

The college-dorm classic; the original Bubble Shooter on a Mac. Dave Dobson, then a graduate student in geology, wrote it as a learning project and a gift for his wife; Steve Wozniak has cited it as a personal favorite.

1. **Danger Meter** (not a ceiling): every shot fills a meter; when it hits the top, the entire field drops one row. Clearing chunks resets the meter — turning the game from "race against time" into "earn breathing room."
2. **Seven character "Snoods"** (Jake, Midoribe, Mildred, Spike, Zod, Geji, Sunny) — distinct shapes per color, fully colorblind-accessible by default in 1996.
3. **Special pieces**: Numbskull (worthless filler), Stone (unpoppable obstacle), Wildcard (matches any color), Rowbuilder (adds a row on contact).
4. **Modes**: Classic, Puzzle, Journey (campaign), Time Attack, Puzzle Solver — a five-mode taxonomy almost no modern clone matches.
5. **"Forget Life, Play Snood"** tagline — the genre's first viral marketing line.
6. **>200,000 paid units sold**; Shareware Industry Award Best Action/Arcade 2004.

URL: [Internet Archive — Snood download](https://archive.org/details/Snood_20180218) · Wikipedia: [Snood](https://en.wikipedia.org/wiki/Snood_(video_game))

### 5. Smarty Bubbles — Famobi

Mid-tier browser/mobile clone, widely white-labeled across casual-game portals (CrazyGames, Bubbleshooter.net, SilverGames, AddictingGames).

1. **Three modes**: **Arcade** (escalating difficulty), **Zen** (no time pressure, no row drops), **Challenge** (countdown timer).
2. **5-bubble pity timer** identical to bubbleshooter.com.
3. **High Score persistence** in localStorage; no account required.
4. **Bounce-aim line preview** drawn off the side walls — a "lite hint" not present in competitive ports.
5. **No daily puzzle**, no streak, no calendar.
6. **Banner-ad-monetized** white-label embeds; the host site decides ad density.

URL: [crazygames.com/game/smarty-bubbles](https://www.crazygames.com/game/smarty-bubbles)

### 6. Bubble Witch 3 Saga — King

The biggest commercial bubble-shooter franchise on mobile. Free-to-play with aggressive IAP and lives-system gating. Continuation of the 2012 _Bubble Witch Saga_ lineage.

1. **Hundreds of levels** on a saga-style world map; level gating drives session frequency.
2. **Per-level objectives** beyond "clear the board": rescue ghosts, drop a Stella icon to a fixed point, hit special targets.
3. **Magical power-ups** purchased or earned: charm bubble, lightning bolt, magic beam, rainbow.
4. **Energy/lives system** (5 hearts, refilling slowly) — a textbook dark pattern: you literally cannot keep playing without paying or waiting.
5. **Facebook social graph** for leaderboards, life-gifting, and level-completion comparisons.
6. **Map-based progression** — the "Saga" UI invented by King for Candy Crush, applied to bubble shooting.

URL: [play.google.com — Bubble Witch 3 Saga](https://play.google.com/store/apps/details?id=com.king.bubblewitch3) · how-to: [bubblewitch3.zendesk.com](https://bubblewitch3.zendesk.com/hc/en-us/articles/115001528305-How-do-I-play-Bubble-Witch-3-Saga)

### 7. Bubbits — indie battle royale variant (2025+)

A new-school multiplayer bubble shooter (browser + Steam demo) that reframes the genre as competitive PvP. Worth surveying because it represents the "where the genre is heading" extreme.

1. **25-player real-time battle royale** — players send junk bubbles to opponents on big pops; last cannon standing wins.
2. **Daily Challenge** as a high-score arcade race against a global leaderboard, "completable in under 10 minutes."
3. **Adventure Mode** with islands, stars, bosses, and a per-island leaderboard.
4. **Chill Mode** for low-pressure solo play.
5. **Heavy customization** (cannon skins, playfield backgrounds, badges, seals) — cosmetic-IAP monetization model.
6. **Cross-platform account linking** with mid-game-join for spectators-turned-players.

URL: [bubbits.io](https://bubbits.io/)

### 8. Rembound HTML5 Bubble Shooter Tutorial — Erik van der Wal

Not a shipping game but the **canonical open-source reference implementation** every web-clone author has read. Quoted in OpenGenus tutorials and referenced by half the StackOverflow answers in the genre. Worth surveying as the codebase that defines what "vanilla Canvas2D bubble shooter" means in 2026.

1. **Hex grid via 2D array with row-parity offset** — even rows aligned, odd rows shifted by `tilewidth/2`, neighbors via a row-parity-conditional 6-offset lookup table.
2. **Circle-circle collision** with combined-radii distance check; no spatial partitioning required at this grid size.
3. **`atan2`-based mouse aim**, restricted to 8°–172° to prevent shooting downward.
4. **BFS cluster detection** from the snapped bubble; floating-bubble removal via "any cluster not touching row 0 falls."
5. **7 bubble colors**, fixed; last row reserved for game-over detection.
6. **Time-based movement** (`dt`-scaled velocity) — the right architecture for a 60 fps Canvas2D loop.

URL: [rembound.com/articles/bubble-shooter-game-tutorial-with-html5-and-javascript](https://rembound.com/articles/bubble-shooter-game-tutorial-with-html5-and-javascript) · derivative: [iq.opengenus.org — Bubble Shooter in HTML/CSS/JS](https://iq.opengenus.org/bubble-shooter-game-in-html/)

---

## Synthesized feature catalog

Every recurring mechanic across the 8, deduped into a flat list. **Bold** = in scope for FizzPop v1. *Italic* = explicitly deferred.

### Core gameplay

- **Hexagonal grid (rows shift half-tile every other row), 8 columns × ≤14 rows visible**
- **Match-3+ same-color cluster pops on snap**
- **Cascading drop**: any bubble cluster no longer connected to row 0 falls and scores
- **Aim cannon at fixed bottom-center pivot**, 8°–172° range
- **Wall bounces** (bubbles ricochet off left/right edges; never off top until snap)
- **Next-bubble preview** (one bubble queued visibly to the side of the cannon)
- **Color count scales with difficulty** (4 → 5 → 6 → 7 colors)
- *Color of fired bubble is restricted to colors still on the board* (Puzzle Bobble rule — defer to v1.1; in v1 the queue is deterministic from a per-day seed and may include any color)
- *Two-player VS / battle royale*

### Pressure mechanics (the "you're losing slowly" beat)

- **Ceiling drop on a configurable cadence** — Puzzle Bobble's classic mechanic: every N shots, the entire field shifts down by one row
- **Pity-timer drop** — Bubbleshooter.com's variant: missed shots accumulate, drop a row when full, counter shrinks each cycle (5→4→3→2→1)
- **Danger meter** — Snood's variant: shots fill a meter, meter-full triggers row drop, clearing bubbles depletes the meter
- *Dynamic ceiling tied to remaining bubble density*

**FizzPop v1 ships pity-timer (5/4/3/2/1).** It's the most player-readable ("I get 5 free misses, then 4...") and the easiest to expose in HUD copy. Ceiling-drop and danger-meter are deferred to v1.1 as alternative modes.

### Specials & power-ups

- **Rainbow / wildcard bubble** — adopts the color of an adjacent burst (Puzzle Bobble 3, Snood Wildcard) ✓
- **Stone / indestructible bubble** — never pops, falls only on cascade (Snood Stone) — *defer*
- **Bomb bubble** — explodes a 7-hex radius (Bubble Witch) — *defer*
- **Lightning bubble** — clears all bubbles of one color (Arkadium) — *defer*
- **Anchor bubble** — locks a column's row-drop (FizzPop-original idea) — *defer*

**FizzPop v1 ships ONE special: the rainbow wildcard.** It's the only special in every era of the genre (1996 Snood through 2026 Bubble Witch) and it's the single most teachable special-bubble interaction. More specials get added in v1.1 only if v1 daily-puzzle solve rates are too high.

### Daily + retention

- **Daily puzzle, deterministic by date** — hand-designed playfield + per-day RNG seed for the bubble queue, identical for every player worldwide
- **Daily-Solvable guarantee** — every daily puzzle is validated by an offline solver to be clearable in ≤ N shots; the player is told N
- **Streak counter** with one weekly freeze (mirrors Sudoku PRD 38 / MindSwiffer)
- **Calendar archive** — play any past daily; missed days don't break streak retroactively
- *Seasonal events*

### Difficulty + scoring

- **Three difficulty brackets** (Beginner / Intermediate / Expert) for endless mode
- **Score = base pop + cascade multiplier + clear-board bonus**
- **Clear-the-board bonus** (2× total, mirroring Bubbleshooter.com)
- **Cascade multiplier** (10× per cascade bubble — mirrors Bubbleshooter.com; clamped at 50× to avoid runaway scores)
- *Per-shot accuracy stat (% of shots that popped at least one)*
- *BV/s-style competitive metric*

### Hints & teaching

- **Aim-line preview** (visible by default; toggle off in settings for "no-hint" bracket)
- **Bounce-aim preview** (off by default — it makes the game trivial)
- **First-shot tutorial** — single dismissible tooltip on first play; no walkthrough
- *Three-tier hint that names the optimal shot ("Pop the green cluster at column 4 to drop 8")*

### Persistence

- **Auto-save in-progress game; resume on launch**
- **Local-first; cloud opt-in** via Bilko account (PRD 30 game services)
- **Per-difficulty stats**: best score, average score, total wins, total games

### Visual & feel

- **Hex grid, hairline cell separation** (no skeuomorphic 1995 chrome)
- **7 bubble colors** with **shape + color** distinction (colorblind-safe by default — Snood's lesson)
- **Cannon pivots smoothly** with input (CSS transform, no physics)
- **Bubble travel: time-based, 60 fps**, ~700 px/s on desktop, scales with viewport
- **Pop animation: spring-out + fade**, 220 ms total
- **Cascade animation: gravity drop with subtle bounce** at bottom
- **Confetti only on clear-the-board on a personal best** (mirrors MindSwiffer rule)
- **Reduced-motion respects system setting** — animations collapse to instant
- *Themed playfields / seasonal skins*

### Input

- **Touch (mobile)**: drag anywhere on the playfield to set angle, lift to fire; tap "next" pill to swap with queued bubble
- **Mouse (desktop)**: aim with cursor position, click to fire; right-click swaps with queue
- **Keyboard**: ←/→ rotate cannon, Space fires, S swaps with queue, R restarts, 1/2/3 selects difficulty
- **Gamepad**: left stick aims, A fires, B swaps, Start pauses (tested on standard XInput pad)

### Platform integration

- **Hosted at bilko.run/projects/fizzpop/** as static-path sibling
- **Brand chrome** via `@bilkobibitkov/host-kit` `<GameShell>` (eyebrow, title, footer)
- **Loop driven by `useGameTimer`** from host-kit (60 fps tick callback)
- **Free, no ads, login-optional**
- **Analytics via `/api/analytics/event`** (same-origin, PRD 27)
- **Cross-game "Puzzler" achievement** extends to **"Puzzler Triple"**: solving ≥1 Sudoku + ≥1 MindSwiffer + ≥1 FizzPop daily

---

## 5 design rules for FizzPop

Distilled from sudoku-research's "Grid is the hero / No celebration without earning it" template. Every PRD acceptance criterion ties back to one of these.

### 1. The aim line is the conversation

The aim line — the dotted/solid trajectory between the cannon and the predicted snap point — is the entire UI for player intent. It must update at 60 fps, snap precisely to the predicted hex cell, and visibly bounce off walls (when the bounce-preview is on). Everything else in the chrome is supporting cast. If the aim line is laggy, jittery, or off by half a hex, no other polish recovers the game.

### 2. The puzzle is solvable, the queue is not luck

The daily puzzle ships with a guaranteed solution. The bubble queue is deterministic from the day's seed but is not curated to make the solution easy. This is the genre's single biggest unsolved tension: classic Puzzle Bobble can give you a green bubble when there are no greens left and force you to "park" it as a future obstacle. FizzPop's deal: **the puzzle has a clear-the-board solution; whether you find it is on you, not the RNG.** The daily HUD shows "Cleared by N shots" as the par to chase.

### 3. The hex IS the game

Cells are 1.6× the visual weight of the cannon, the queue, the score readout. No background art behind the playfield in v1; just a hairline-bordered honeycomb on `--paper`. Snood proved cute mascots scale; Frozen Bubble proved Tux scales; Bilko's bet is that **restraint also scales**. The bubble is the hero. The hex grid is its stage.

### 4. Color + shape, always

Every bubble color is paired with a glyph (●, ◆, ▲, ■, ✚, ★, ◐). Snood shipped this in 1996. Half the modern web clones still ship color-only and break for ~8% of male players. FizzPop ships shape-by-default with a "color only" toggle for veterans who prefer it; the default is accessible.

### 5. No dark patterns

No lives system. No "wait 5 minutes for a heart" screen. No power-up purchase. No timed offers. No streak-anxiety push notifications. No "watch a video for 3 extra moves." No banner ads. King's _Bubble Witch Saga_ proved how dark this genre can get; FizzPop is the apology. The bilko.run host pays its bills via the paid tools; FizzPop's job is to be good.

---

## Mechanics spec

Exhaustive. Everything below is a contract for the v1 implementation.

### World dimensions

| Dimension | Value | Notes |
|---|---|---|
| Logical playfield | 8 columns × 14 rows visible | Standard Puzzle Bobble width; SNES used 8 |
| Hex tile diameter | 64 logical px | Renders at `clamp(36px, 11vmin, 64px)` actual |
| Row height | `tile_diameter * sqrt(3)/2` ≈ 55.4 px | Hex packing math; matches Rembound reference |
| Row offset (odd rows) | `tile_diameter / 2` = 32 px | Half-tile shift for honeycomb appearance |
| Bubble radius (collision) | 30 logical px | Slightly under tile diameter for forgiveness |
| Cannon pivot | bottom-center, fixed | y = bottom of playfield + 32 px |
| Aim-line length | Max 1200 logical px or until first collision | Drawn as 8 px dashed line |
| Game-over line | y = top of last row | Bubble snapping into row 14 → game over |

### Tick rate

- **Logical tick: 60 Hz** via `useGameTimer` from `@bilkobibitkov/host-kit`.
- **Render: rAF-aligned**, decoupled from logic tick via accumulator pattern.
- **Bubble travel speed: 700 logical px/s on desktop**, scales with `tile_diameter / 64` so mobile travel time stays constant.
- **Pause** on `document.visibilitychange` (tab background) and on a paused-overlay tap.
- **Time complexity per tick**: O(active bubbles) for collision (typically 1, max 2 in flight) + O(grid) only on snap. No nested loops over the grid in steady state.

### Input model

- **Mobile**: continuous touch — drag on playfield sets angle (cursor at touch point); release fires. Tap-and-release at the same point also fires (with last-known angle).
- **Desktop mouse**: cursor position sets angle continuously; left-click fires; right-click swaps queue.
- **Keyboard**: arrow keys rotate cannon at 0.8°/frame held; Space fires; S swaps; R restarts; Esc opens settings overlay.
- **Gamepad**: left stick X-axis sets angle (deadzone 0.15); A fires; B swaps; Start pauses.
- **Accessibility**: full keyboard play possible; screen reader announces "Cannon at angle X degrees, next bubble: blue circle, queue: red triangle."

### Collision rules

1. In-flight bubble updates position each tick: `pos += velocity * dt`.
2. Wall collision: if `pos.x - radius < playfield.left` or `pos.x + radius > playfield.right`, reflect velocity.x (bounce). No bounce off ceiling — top contact triggers snap.
3. Bubble-bubble collision: distance from in-flight center to any grid bubble center ≤ `2 * radius` triggers snap.
4. Snap algorithm:
   - Compute the ideal `(row, col)` from world position via row-parity-aware grid math.
   - If target cell is occupied, walk to the nearest empty neighbor of the colliding bubble (6 candidates).
   - If all 6 neighbors are occupied (rare; only happens on top-row contact), snap to the top-most empty cell directly above.
5. After snap, run cluster detection (BFS, O(grid)) from the new bubble.
6. If cluster size ≥ 3: pop the cluster, then run floating-bubble pass (BFS from row 0; anything not reached falls).

### Cluster detection algorithm

```
fn detect_cluster(grid, start):
  queue = [start]
  visited = {start}
  cluster = [start]
  color = grid[start].color
  while queue not empty:
    cell = queue.pop()
    for neighbor in hex_neighbors(cell, row_parity):
      if neighbor in grid and neighbor not in visited and grid[neighbor].color == color:
        visited.add(neighbor)
        cluster.append(neighbor)
        queue.append(neighbor)
  return cluster
```

Time: O(c) where c = cluster size. Space: O(c). No nested loop hazard.

Floating-bubble removal: identical BFS but seeded from every cell in row 0 simultaneously, marking reachable. Anything not reached falls.

### Scoring formula

```
pop_score        = cluster_size * 10
cascade_bonus    = floating_bubbles_count * 50
combo_multiplier = min(1 + (cascade_bonus / 200), 5)
clear_bonus      = (board_empty ? 2 : 1)
shot_score       = (pop_score + cascade_bonus) * combo_multiplier * clear_bonus
total_score      = sum(shot_score for each shot in run)
```

Examples:
- Pop a 3-cluster, no cascades: `3*10 = 30`.
- Pop a 5-cluster that drops 8 floaters: `(50 + 400) * (1 + 400/200) = 450 * 3 = 1350`.
- Final shot clears the board: previous calculation × 2.

### Win/lose conditions

| State | Trigger |
|---|---|
| **Win (Daily / Levels)** | All bubbles cleared from playfield |
| **Win (Endless)** | No win — play continues until lose |
| **Lose** | A snapped bubble's center y coordinate is below the game-over line (y = bottom of row 14) |
| **Lose (Daily)** | Same; daily can be retried; only first attempt counts for streak |

### Level / endless progression

**Daily mode**: one playfield per day, deterministic from the date string `YYYY-MM-DD` hashed into a seed. Playfield is hand-curated from a pool of 365 day-stamped layouts (rolled forward annually). Bubble queue is generated deterministically from the same seed. Solver-validated to be clearable in N shots; "par = N" displayed.

**Endless mode** (per difficulty):
- **Beginner**: 4 colors, 6 starting rows, pity timer 7→6→5→4→3→2→1.
- **Intermediate**: 5 colors, 8 starting rows, pity timer 5→4→3→2→1.
- **Expert**: 7 colors, 10 starting rows, pity timer 4→3→2→1.

In endless, the game continues indefinitely; row-drops always available via pity timer; high score is the metric.

**Levels mode** (deferred to v1.1): 100 hand-designed solo levels in the Frozen Bubble tradition, each with a per-level par.

### Edge cases

| Case | Rule |
|---|---|
| Wall bounce angle | Pure reflection (`velocity.x *= -1`); no friction; no spin |
| Bounce off top-of-playfield | Disabled — top contact triggers snap, never reflection |
| Snap into already-occupied cell | Walk to nearest empty neighbor (6-way); deterministic ordering |
| In-flight bubble queue depleted | Generator pulls next from PRNG seeded by daily seed |
| First shot of game | Always allowed at full pity counter |
| Self-color cluster of exactly 2 | No pop; bubble lands and waits for a third |
| Rainbow bubble snapped with no neighbors | Stays as rainbow until a colored neighbor lands; does not auto-pop |
| Rainbow bubble snapped adjacent to multiple colors | Adopts the color of the **largest adjacent same-color cluster**; ties broken by 12-o'clock-clockwise order |
| Cascade touches game-over line | Bubble already in motion: it falls and scores; does not lose the game |
| Window resize mid-game | Logical state preserved; render recalculates `tile_diameter` and rescales |
| Tab background | Loop pauses; resumes on focus |
| Settings opened mid-flight | Bubble freezes mid-air; resumes on close |
| Player aims into floor (angle outside 8°–172°) | Cannon clamps to bracket; no error feedback needed |
| Daily already completed today | "Today's puzzle: Cleared in N shots ✓ — play again for fun, doesn't affect streak" |

### Powerup table (v1)

| Power-up | Symbol | Behavior | Frequency |
|---|---|---|---|
| **Rainbow** | ◇ (transparent diamond outline) | On snap, adopts color of largest adjacent cluster; if no neighbors, remains rainbow | 1 per ~30 queue draws (3.3%) |

That's it. v1 ships exactly one special. v1.1 adds Stone, Bomb, Lightning if telemetry says daily completion is too easy.

---

## Visual specs

FizzPop consumes tokens from `@bilkobibitkov/host-kit/styles/game-tokens.css` first. We reuse the existing `--ink`, `--paper`, `--mark-*`, `--cell-radius`, `--grid-radius`, `--spring-fast`, `--duration-tap`, `--duration-fade`, `--conflict`. The 7 bubble colors and the cannon/aim tokens are net new and are added to `game-tokens.css` (PRD will spec the addition).

### Existing tokens reused

| Token | Used for |
|---|---|
| `--ink` | Cannon body, HUD text, aim-line color |
| `--paper` | Playfield background |
| `--mark-font` | HUD numerals, score readout |
| `--mark-size` | Score font size |
| `--cell-radius` (2 px) | Bubble inner-shadow radius (subtle ring) |
| `--grid-radius` (12 px) | Outer playfield border rounding |
| `--grid-line-thin` | Hex cell hairline outline (when shape mode is on) |
| `--spring-fast` | Pop animation, cannon swing |
| `--duration-tap` (120 ms) | Cannon-rotate, bubble-snap settle |
| `--duration-fade` (220 ms) | Pop fade, score-readout updates |
| `--duration-win` (720 ms) | Clear-the-board confetti |
| `--conflict` | Pity-counter "1 left" warning state |

### New tokens proposed (6 total)

These are the only net-new tokens. Each one is justified — not invented for cosmetic reasons.

| Token | Default | Why we need it |
|---|---|---|
| `--bubble-1` | `#2563eb` (blue) | Bubble color 1 — pairs with ● |
| `--bubble-2` | `#dc2626` (red) | Bubble color 2 — pairs with ◆ |
| `--bubble-3` | `#16a34a` (green) | Bubble color 3 — pairs with ▲ |
| `--bubble-4` | `#f59e0b` (amber) | Bubble color 4 — pairs with ■ |
| `--bubble-5` | `#7c3aed` (violet) | Bubble color 5 — pairs with ✚ |
| `--bubble-6` | `#ec4899` (pink) | Bubble color 6 — pairs with ★ |

Color 7 reuses `--num-7` (near-black) on `--paper`, paired with ◐ — no new token needed.

The cannon glow, aim-line color, and rainbow-bubble shimmer all derive from existing tokens via `color-mix(in oklch, ...)`. **No additional tokens for chrome.**

Dark mode: each `--bubble-N` flips to a 10% lighter OKLCH variant (defined in the same `@media (prefers-color-scheme: dark)` block in `game-tokens.css`).

### Sprite / cell sizing

- **Bubble sprite**: pure CSS / Canvas. No raster assets. Drawn as a circle with a 3-stop radial gradient (top-left highlight, mid body, bottom shadow) + 1 px inner-stroke + the glyph centered. Total cost: ~30 lines of Canvas2D.
- **Cannon**: SVG path; rotates via `transform: rotate(${angle}deg)`. Two layers: barrel (bottom) + base (foreground).
- **Aim line**: dashed `lineDash([4, 6])` Canvas2D stroke, 8 px wide, color = current bubble.
- **Hex cell outline** (shape-mode only): hairline polygon at the bubble's snap position; opacity 0 in color-only mode.

### Animation timings

| Event | Duration | Easing |
|---|---|---|
| Cannon rotate (per frame) | 16 ms (one tick) | linear |
| Bubble fire | continuous (700 px/s) | linear |
| Bubble snap | 120 ms | `--spring-fast` |
| Cluster pop (per bubble) | 220 ms | `--spring-fast` |
| Cluster pop (stagger) | 30 ms between bubbles | (cascade staggers, max 8 frames) |
| Floater fall | gravity-driven, ~400 ms typical | linear acceleration |
| Row drop (pity) | 320 ms | `--spring-medium` |
| Score-readout tick | 220 ms | `--duration-fade` |
| Confetti (clear-board PB) | 720 ms | `--duration-win` |
| Game-over fade | 480 ms | `--spring-medium` |

### Motion-reduction behavior

`@media (prefers-reduced-motion: reduce)`:
- Cannon rotation: instant snap to angle (no frame interpolation).
- Bubble fire: instant teleport from cannon to snap target (no travel animation).
- Pop animation: instant remove (no fade, no spring).
- Floater fall: instant remove (no gravity drop).
- Row drop: instant shift (no spring).
- Confetti: replaced by a single static "✓ Personal Best" badge for 720 ms.

Game is fully playable in reduced-motion mode with zero loss of fidelity.

---

## Mobile-first ASCII layout

```
┌────────────────────────────────────┐
│  Bilko · FizzPop              ⚙    │  ← GameShell chrome (host-kit)
├────────────────────────────────────┤
│  Beginner · 01:23 · Score 1,240    │  ← HUD strip
│  Pity ●●●○○                        │  ← pity counter (dots fill on miss)
│                                    │
│  ┌──────────────────────────────┐  │
│  │ ● ▲ ● ■ ◆ ▲ ■ ●              │  │  ← row 0  (top, anchored)
│  │  ▲ ● ◆ ◆ ▲ ■ ●               │  │  ← row 1  (offset by half-tile)
│  │ ■ ▲ ▲ ● ◆ ● ■ ◆              │  │  ← row 2
│  │  ◆ ● ■ ▲ ● ◆ ▲               │  │  ← row 3
│  │ ▲ ● ▲ ◆ ■ ▲ ● ◆              │  │  ← row 4
│  │  · · · · · · ·               │  │  ← rows 5–13 empty
│  │                              │  │
│  │           ╲ ╲ ╲              │  │  ← aim-line (dashed)
│  │             ╲                │  │
│  │              ●               │  │  ← cannon (color of next bubble)
│  │            ─[━]─             │  │
│  │              ╳   ◆ ← queue   │  │  ← bubble waiting in queue
│  └──────────────────────────────┘  │
│                                    │
│  ↺  Hint: aim line OFF             │  ← actions strip
│                                    │
│  Made by Bilko · bilko.run         │  ← GameShell footer
└────────────────────────────────────┘
```

### Mobile interaction model

- Drag anywhere in the playfield to aim; release to fire.
- Tap the queue pill (right of cannon) to swap current bubble with the next.
- Tap restart (↺) to abandon and restart current run; daily mode shows confirm.
- Tap settings (⚙) for color-only/shape-mode toggle, sound toggle, motion override.

### Desktop additions

- Mouse cursor sets angle continuously; left-click fires; right-click swaps queue.
- Keyboard: ←/→ rotate, Space fires, S swaps, R restarts, Esc settings.
- Hovering the queue pill reveals a tooltip with the queued bubble's color name (accessibility).

---

## Controls

### Touch (mobile / tablet)

| Gesture | Action |
|---|---|
| Drag on playfield | Set cannon angle (cursor follows touch point) |
| Release after drag | Fire bubble at current angle |
| Tap on playfield (no drag) | Fire at last-known angle |
| Tap queue pill | Swap current and queued bubble |
| Tap ↺ | Restart current run (confirm in Daily) |
| Long-press playfield | (reserved — no action in v1) |

### Mouse (desktop)

| Input | Action |
|---|---|
| Mouse position | Sets cannon angle continuously |
| Left click | Fire |
| Right click | Swap with queue |
| Middle click | (reserved) |
| Mouse wheel | (reserved) |

### Keyboard (desktop, full play)

| Key | Action |
|---|---|
| `←` / `→` | Rotate cannon left/right (0.8°/frame held; 4°/tap) |
| `Space` | Fire |
| `S` | Swap with queue |
| `R` | Restart |
| `Esc` | Settings overlay |
| `1` / `2` / `3` | Select Beginner / Intermediate / Expert (in mode-select screen) |
| `D` | Jump to Daily (in mode-select screen) |
| `?` | Show keyboard shortcuts overlay |

### Gamepad (XInput / standard mapping)

| Input | Action |
|---|---|
| Left stick X | Aim (analog, deadzone 0.15) |
| Left stick fine | Pressing in (L3) enables 4× slower rotation for precision |
| A button | Fire |
| B button | Swap with queue |
| Start | Pause |
| Select / Back | Restart |

---

## Scoring + difficulty

### Endless-mode brackets

| Bracket | Colors | Start rows | Pity timer | Color queue weighting | Notes |
|---|---|---|---|---|---|
| **Beginner** | 4 | 6 | 7→6→5→4→3→2→1 | Uniform across 4 colors | First-time and casual players |
| **Intermediate** | 5 | 8 | 5→4→3→2→1 | Uniform across 5 colors | Default |
| **Expert** | 7 | 10 | 4→3→2→1 | Weighted toward colors with fewer bubbles on board (Puzzle Bobble rule) | Long sessions, leaderboard chasing |

Color-queue weighting in Expert reproduces the original 1994 rule that "the color of bubbles fired is randomly generated and chosen from the colors of bubbles still left on the screen" — preventing the "useless bubble" problem where you get a green and there are no greens. Beginner and Intermediate use uniform random for simplicity; Expert is for veterans who want the original behavior.

### Daily mode

Mirrors Sudoku's day-of-week ramp. Player gets one playfield + one solver-validated par per day:

| Day | Playfield difficulty | Solver-validated par | Pity timer |
|---|---|---|---|
| **Mon** | Beginner | 12 shots | 7 (no escalation) |
| **Tue** | Beginner | 14 shots | 6 |
| **Wed** | Intermediate | 16 shots | 5 |
| **Thu** | Intermediate | 18 shots | 5 |
| **Fri** | Intermediate | 20 shots | 4 |
| **Sat** | Expert | 24 shots | 4 |
| **Sun** | Expert | 28 shots | 3 |

"Par" is the optimal-solver shot count. The HUD shows `Shots: 7 / 12` so the player always knows where they stand vs the puzzle's intended difficulty.

A **Daily Solvable badge** appears below the HUD: "✓ Solvable in ≤12 shots." This is the Bilko pledge — the daily is a thinking puzzle, not a luck check.

### Score formula (recap from mechanics)

```
shot_score = (cluster_size * 10 + cascade_count * 50)
           * min(1 + cascade_count/4, 5)         // multiplier capped at 5×
           * (board_empty ? 2 : 1)
total      = Σ shot_score
```

### Score brackets (per difficulty, to color the score readout)

Beginner endless: bronze 5k, silver 15k, gold 30k.
Intermediate endless: bronze 10k, silver 30k, gold 60k.
Expert endless: bronze 20k, silver 60k, gold 120k.

Daily score = inverse of shots used: `daily_score = max(0, par * 100 - shots_used * 50)`. Tied scores broken by elapsed time. Lower shots = higher score.

### Achievements (PRD 30 game services)

- **First Pop** — clear your first cluster.
- **Cascade Champion** — trigger a cascade ≥ 10 floating bubbles in one shot.
- **Solvable** — complete your first Daily within par.
- **Hex Master** — clear a board with 0 cells remaining.
- **Sub-Par** — complete a Daily in fewer shots than par.
- **Perfect Week** — complete all 7 Dailies in a calendar week.
- **No-Hint** — clear an Expert endless run with aim-line preview disabled.
- **Puzzler Triple** — solve ≥1 Sudoku + ≥1 MindSwiffer + ≥1 FizzPop daily (cross-game).

---

## Copy / reject table

| From | Copy | Reject |
|---|---|---|
| **Bubbleshooter.com** | Pity-timer mechanic (5/4/3/2/1), cascade ×10 multiplier, clear-board ×2, free + no-account | Themed reskin gimmicks, "Daily" with no calendar archive, ad-driven monetization |
| **Arkadium Bubble Shooter** | Endless-mode aesthetic, leaderboard, save-on-tab-close, Lightning bonus IDEA (defer to v1.1) | Sponsor-message rewarded video, mouse-only desktop bias |
| **Frozen Bubble** | 100 hand-designed levels CONCEPT (defer to v1.1), open-source ethos, multiplayer roadmap idea | Tux mascot (we don't ship a mascot), Perl/SDL stack (we're Canvas2D web), split-screen multiplayer (defer indefinitely) |
| **Snood** | Color + shape pairing on every bubble (the 1996 colorblind win), Wildcard / rainbow special, Time Attack as a future mode | Numbskull/Stone/Rowbuilder specials (defer; v1 ships rainbow only), Danger meter (we ship pity-timer instead — easier to read), 5-mode taxonomy (we ship 2: Daily + Endless) |
| **Smarty Bubbles** | Three-mode menu pattern (Daily / Endless / Levels), bounce-aim line CONCEPT (off by default in v1), localStorage persistence | Generic banner-ad embed, "Zen mode" naming (we just call it Endless), no daily |
| **Bubble Witch 3 Saga** | Per-level objectives CONCEPT for Levels mode v1.1, magical-bubble specials catalogue for inspiration | **Energy/lives system (the dark-pattern paywall)**, Facebook social graph dependency, IAP-driven power-ups, saga map progression gating |
| **Bubbits** | Daily Challenge as "completable in <10 minutes" framing, Adventure Mode CONCEPT for v2, Chill Mode pacing | 25-player battle royale (out of scope; we are single-screen by spec), customization-IAP monetization, party-system social features |
| **Rembound HTML5 reference** | Hex-grid 2D-array with row-parity offset, BFS cluster detection, atan2 aim with 8°–172° clamp, time-based movement, 7-color cap | Tutorial-quality code (we'll harden it), no-mobile-optimization, no daily/streak/persistence |

---

## Differentiation

**FizzPop's headline feature: the Daily Solvable guarantee + 365-day calendar archive.**

Survey the eight implementations:

- **Bubbleshooter.com** ships a "Daily Challenge" but it's themed-cosmetic only; no calendar archive ("if they win, they must wait for the next daily puzzle"); no solver-validated par; no streak.
- **Bubble Witch 3 Saga** has hundreds of levels but no shared "today's puzzle"; the entire genre's mobile mainstream is single-player progression, not shared daily.
- **Bubbits** has a Daily Challenge but it's a leaderboard high-score race, not a shared puzzle to solve.
- **Frozen Bubble** has 100 hand-designed levels but no daily cadence — the design predates daily-puzzle culture.
- **Snood** has Puzzle Solver mode but no daily.
- **Smarty Bubbles, Arkadium, Rembound** — no daily.

The closest competitor is **bubbleshooter.com's Daily Challenge**, which is themed but not deterministic, not solvable-validated, not archived.

**FizzPop ships:**

1. **Deterministic daily puzzle** — every player worldwide gets the same playfield + the same RNG seed for the bubble queue, derived from `YYYY-MM-DD`. Two players in different time zones can compare shot counts honestly.
2. **Solver-validated par** — every daily is run through the offline FizzPop solver before publishing; the puzzle is guaranteed clearable in ≤ N shots; N is the displayed par.
3. **365-day calendar archive** — pick any past day from the calendar and play it. Missed days don't break streak retroactively (one weekly freeze, mirroring Sudoku PRD 38).
4. **Day-of-week difficulty ramp** — Mon Beginner through Sun Expert, mirroring Good Sudoku and our own MindSwiffer.

That bundle is **shippable in v1**, defensible (the solver is the moat), and doesn't exist anywhere in the bubble-shooter market today.

Secondary Bilko-only features:

5. **Free + ad-free + login-optional**, hosted on a personal-brand site that already serves 12 other tools — no app-store gatekeeper, no IAP wall.
6. **Cross-game "Puzzler Triple" achievement** — only possible because all three games share the bilko.run chrome and Bilko account.
7. **Color + shape by default** — the Snood lesson, finally back in a modern build. Most modern web clones still ship color-only.
8. **Apple-grade restraint** — no themed seasonal skins, no mascot, no progression map. Just the hex grid, the cannon, and the aim line.

---

## Why this game over the alternatives I considered

I evaluated five candidates in the action / arcade / reflex bracket. Bubble shooter (FizzPop) wins on **daily-puzzle fit**, which is the Bilko Game Studio's defining retention pattern.

### Snake (1997, Nokia 6110 — though earlier mainframe origins) — REJECTED

The most-installed mobile game of all time. Mechanics are trivial (move on grid, eat fruit, grow, don't collide with self). Reasons rejected:

- **No daily-puzzle fit.** Snake is a high-score chase. Trying to ship "today's snake puzzle" is a category error — the apple positions can be deterministic but there's no "puzzle to solve," only a score to chase. We'd be shipping a leaderboard with no puzzle.
- **Genre saturation.** google.com/search?q=play+snake serves you Google's Doodle Snake instantly. We have no differentiation there.
- **Reflex-only**, no thinking. Bilko's brand sits on "think, don't guess" (MindSwiffer), "the hint never lies" (Sudoku). Snake doesn't fit the thinking-game positioning.

### Breakout / Arkanoid (1986 / 1986; we'd target the 1995-2005 ports) — REJECTED

Paddle bounces a ball at a brick wall; clear the wall; powerups drop. Strong reflex pedigree. Reasons rejected:

- **Physics dependency.** Faithful Arkanoid needs precise ball physics (paddle-spin, brick-collision normals, powerup trajectories). That's 2–3× the v1 engine work of bubble shooter and pushes us toward a physics library — violates the "plain Canvas2D, no Phaser" constraint.
- **Daily-puzzle fit is weak.** Brick layouts can be deterministic but ball trajectories diverge instantly with player paddle position; "today's Arkanoid" reduces to "today's brick layout, freeplay scoring," which is identical to endless. Same problem as Snake.
- **Powerup design is the whole game.** Without 6+ powerups (laser, multi-ball, sticky, expand, slow, warp), Arkanoid feels thin. v1 ships ≤ 1 special by design — that crushes Arkanoid's appeal in a way it doesn't crush bubble shooter's.
- **Mobile controls are hard.** Touch-paddle on mobile is famously fiddly; the genre never solved it cleanly outside of tilt controls (which break for desk/laptop play).

### Asteroids-likes (Asteroids 1979; 1995-2005 has Maelstrom, Asteroid Miner, etc.) — REJECTED

Inertia ship, rotate, thrust, fire. Reasons rejected:

- **6-DOF input is heavy on touch.** The genre never ported well to mobile — the dual-stick mobile clones (twin-stick shooters) all need haptics or analog joysticks the web doesn't have.
- **Per-session length is wrong.** Good Asteroids runs are 10+ minutes; Bilko's "≤5 min per session" constraint forces an artificial cap that breaks the design.
- **No daily-puzzle pattern.** Asteroid spawn positions can be deterministic but the chaos system (split-on-hit) means runs diverge instantly.

### Frogger-likes (1981, but with 1995–2005 ports like Frogger '96, Frogger 2) — REJECTED

Hop across lanes of moving cars and floating logs. Reasons rejected:

- **Reflex over thinking.** Same Bilko-positioning issue as Snake.
- **Visual complexity.** Faithful Frogger needs 6+ lane types (cars, trucks, logs, turtles, alligators, bonus frogs) and a riverside scoring zone. The art budget is real (sprites for each vehicle), and we've kept Sudoku and MindSwiffer art-budget-free.
- **Mobile hop input is awkward.** Tap-to-hop in a direction means either four-corner buttons (bad) or swipe (laggy).

### Galaga / fixed-shooter likes (Galaga 1981; 1995-2005 has DonPachi, etc.) — REJECTED

Fixed-position ship at bottom, waves of attacking enemies, dodge + shoot. Reasons rejected:

- **Wave design is hand-authored** — the genre's appeal is choreographed enemy patterns (Galaga's flight paths are iconic). That's hundreds of hours of design work, not engineering.
- **Continuous shooting input** doesn't map to a daily puzzle. Same problem as Snake/Asteroids.
- **Bullet-hell territory** — 60-fps collision counts get high; the engineering bar is meaningfully higher than bubble shooter's "1 bubble in flight at a time."

### Bubble shooter (Puzzle Bobble lineage) — CHOSEN

Wins on:
- **Daily-puzzle fit is native.** Hand-authored playfields + deterministic queue = a real puzzle to solve, not just a score to chase. This is the only candidate where "today's puzzle" is a genuine product, not a marketing veneer.
- **Mobile-first input is solved.** Drag-to-aim is the genre's universal touch idiom. Works on every device.
- **Engine is small.** Hex grid + 1-bubble-in-flight + BFS cluster detection. Plain Canvas2D, ~2K lines of game code, fits in <300 KB gz easily.
- **Thinking-game positioning fits Bilko.** Aim is reflex; cluster planning is thinking. The Daily Solvable guarantee leans hard into "think, don't guess."
- **No genre leader has the daily + archive + solver-validated combo.** Real market gap.
- **Era fit is clean** — 1994 arcade origin, peak 1995–2005 (Snood 1996, Frozen Bubble 2001, Puzzle Bobble 2/3/4 1995–1997).

---

## Open questions

Five things that need a designer-or-Bilko call before the v1 PRDs are finalized.

1. **Daily playfield authoring: hand-curated 365 vs procedurally generated + solver-filtered?** Hand-curated is higher quality but is real work (estimate: ~30 minutes per puzzle × 365 = 180 hours). Procedural-with-solver-filter is engineering-heavy but scales to infinite dailies. **My recommendation: ship v1 with 30 hand-curated dailies on rotation, build the procedural generator in v1.1.** Question: is 30 hand-curated puzzles in launch budget, or do we ship procedural from day 1?

2. **Solver scope.** The Daily Solvable guarantee requires an offline solver that proves a clear-the-board solution exists in ≤ N shots given the playfield + queue. A naive BFS over (cannon angle × queue position) blows up fast. What's the acceptable solve time per puzzle (5s? 30s? 5min?) and is "best known solution" acceptable as par if optimal isn't proven? **My recommendation: par = best-known solution from 30s of search; we don't claim optimality, we claim solvability.**

3. **Color count: 6 or 7?** Snood used 7 (one Snood per character); Puzzle Bobble used up to 8 in expert; Frozen Bubble used 8; web clones standardize on 7. We've proposed 7 for parity. Question: does color 7 (near-black ◐) read clearly at small mobile tile sizes against `--paper` in dark mode? Needs visual prototyping.

4. **Wall bounces — show preview by default?** The bounce-aim line (extending past the first wall reflection) is the single biggest skill modifier in the genre. Showing it makes the game feel easier and friendlier; hiding it preserves expert satisfaction. **My recommendation: show first-bounce preview by default, hide multi-bounce (which is genuinely cheating).** Question: is one bounce too generous?

5. **Endless leaderboards — global, friends, or local-only?** Sudoku and MindSwiffer ship local-only stats with optional cloud sync via Bilko account. FizzPop's score-chase nature wants leaderboards more than they did. Question: do we ship a global leaderboard for endless modes in v1, defer to v1.1, or commit to "FizzPop is leaderboard-free, like its siblings"? **My lean: defer to v1.1; v1 ships local stats only, mirroring siblings.**

---

## References

- [Wikipedia — Puzzle Bobble](https://en.wikipedia.org/wiki/Puzzle_Bobble) — release history, ports, gameplay
- [Wikipedia — Puzzle Bobble 2](https://en.wikipedia.org/wiki/Puzzle_Bobble_2) — 1995 sequel, branching map mechanic
- [Wikipedia — Puzzle Bobble 3](https://en.wikipedia.org/wiki/Puzzle_Bobble_3) — 1996 sequel, rainbow bubble introduction
- [Wikipedia — Puzzle Bobble 4](https://en.wikipedia.org/wiki/Puzzle_Bobble_4) — 1997 arcade release
- [arcade-history.com — Puzzle Bobble](https://www.arcade-history.com/?n=puzzle-bobble&page=detail&id=21224) — Taito B-System hardware details
- [bitvint.com — Puzzle Bobble / Bust-A-Move retrospective](https://bitvint.com/pages/puzzle-bobble-bust-a-move) — gameplay, ricochet mechanics, multiplayer
- [Bubble Bobble Wiki — Puzzle Bobble](https://bubblebobble.fandom.com/wiki/Puzzle_Bobble) — character lineage, level structure
- [Internet Archive — Puzzle Bobble (Japan B-System)](https://archive.org/details/arcade_pbobble) — original ROM preservation
- [Wikipedia — Snood (video game)](https://en.wikipedia.org/wiki/Snood_(video_game)) — Mac shareware history, modes, sales
- [Internet Archive — Snood (Dave Dobson)](https://archive.org/details/Snood_20180218) — original 1996 release
- [Wikipedia — Frozen Bubble](https://en.wikipedia.org/wiki/Frozen_Bubble) — open-source clone, 100 levels, awards
- [Frozen Bubble — github.com/kthakore/frozen-bubble](https://github.com/kthakore/frozen-bubble) — GPL-2.0 source code
- [Flathub — Frozen Bubble](https://flathub.org/en/apps/org.frozen_bubble.frozen-bubble) — current Linux distribution
- [Bubbleshooter.com](https://www.bubbleshooter.com/) — canonical web bubble shooter (Ilyon Dynamics)
- [Bubbleshooter.net — Bubble Shooter Daily](https://www.bubbleshooter.net/game/bubble-shooter-daily/) — competing daily-challenge implementation
- [Arkadium Bubble Shooter](https://www.arkadium.com/games/bubble-shooter/) — premium web port with leaderboard
- [CrazyGames — Bubble Shooter category](https://www.crazygames.com/t/bubble-shooter) — modern web aggregator survey
- [CrazyGames — Smarty Bubbles](https://www.crazygames.com/game/smarty-bubbles) — Famobi white-label clone with three-mode taxonomy
- [Bubble Witch 3 Saga — King](https://play.google.com/store/apps/details?id=com.king.bubblewitch3) — mobile market leader, dark-pattern reference
- [Bubblewitch3.zendesk.com — How to play](https://bubblewitch3.zendesk.com/hc/en-us/articles/115001528305-How-do-I-play-Bubble-Witch-3-Saga) — King's official mechanics docs
- [Bubbits.io](https://bubbits.io/) — 2025 battle-royale variant; "where the genre is heading"
- [Rembound — Bubble Shooter HTML5 Tutorial](https://rembound.com/articles/bubble-shooter-game-tutorial-with-html5-and-javascript) — canonical web reference implementation
- [OpenGenus — Bubble Shooter in HTML/CSS/JS](https://iq.opengenus.org/bubble-shooter-game-in-html/) — derivative tutorial
- [Bubble-shooter.co — Hexagon variant](https://bubble-shooter.co/bubble-shooter-hexagon) — hex-grid mechanics reference
- [Linux Game Tome (archived) — Frozen Bubble awards](https://www.linuxlinks.com/frozenbubble/) — 2003–2010 reader's choice history
- [W3C WAI — Use of Color (1.4.1)](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) — accessibility basis for color + shape pairing
- [Apple Human Interface Guidelines — Games](https://developer.apple.com/design/human-interface-guidelines/games)
- `docs/sudoku-research.md` — sibling design brief; FizzPop mirrors its structure
- `docs/mindswiffer-research.md` — sibling design brief; FizzPop's daily/streak/calendar pattern matches MindSwiffer's exactly
- `~/Projects/Bilko-Host-Kit/styles/game-tokens.css` — token inventory FizzPop consumes (existing) and proposes 6 net-new `--bubble-N` tokens for
