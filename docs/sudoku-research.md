# Sudoku market research + Bilko-Sudoku design brief

Reference doc that grounds the Sudoku PRD set (35–40). Read this before picking up any of the 12 PRDs — it's the "why" behind every UI choice.

## Top 10 Sudoku apps surveyed (2026)

Sourced from current iOS App Store, Play Store, and major review aggregators (sudokuaday.com, puzzlefind.com, sudokutimes.com, MacStories) plus knowledge of long-running titles. We're calling out **10 features** per app — not necessarily exclusive, but the ones that show up prominently in their UX.

### 1. Good Sudoku — Zach Gage / Jack Schlesinger

Apple Design Award territory. The pedagogical gold standard. Costs $3.99 one-time.

1. AI hint engine that detects which technique you'd need next (X-Wing, Naked Pair, etc.)
2. **"Improve" section** with interactive lessons on each Sudoku technique
3. Auto-notes: fills all candidates with one tap; lets you focus on logic, not bookkeeping
4. **Accent Notes** + **Cross-Out Notes**: separate visual layers for "this might be it" vs "this can't be it"
5. Three modes: Good (curated), Arcade (timed leaderboards), Eternal (one infinite save)
6. **Daily puzzles harden through the week** (Mon easy → Sun monster)
7. Global leaderboards with score validation
8. Custom puzzle generator (>70k hand-curated)
9. **In-context hint progression**: tap Hint once → highlights region; again → narrows; again → solves the step + names the technique
10. Refusal to use anti-patterns: no ads, no IAP, no social-pressure mechanics

### 2. Sudoku.com — Easybrain

Most-downloaded Sudoku app worldwide. Free + ads, $4.99/mo or $14.99 lifetime to remove.

1. Six difficulty levels: **fast, easy, medium, hard, expert, giant** (16×16)
2. **Daily Challenges** with a calendar archive — pick any past day, complete the streak
3. **Seasonal Events** with themed cosmetics + collectible trophies
4. **Tournaments** — leaderboard-based competitions
5. Statistics page tracks best time per difficulty, win rate, streak, total games
6. Three theme presets (light / sepia / dark)
7. Auto-check toggle: live error highlighting vs strict "find your own mistake" mode
8. Mistake counter as a soft fail-state (3 strikes → game over)
9. **Pencil-mark assistant**: "smart hints" auto-eliminates marks that conflict with placed numbers
10. Cross-platform sync (Easybrain account) so phone + tablet + web share state

### 3. Sudoku Blox — newcomer

Reimagines Sudoku with **drag-to-place polyomino blocks** instead of digit entry. Daily-only format.

1. Polyomino-piece input (no number pad)
2. One puzzle per day, capped — no infinite play
3. **Streak-driven** retention; missing a day breaks streak
4. Animation-heavy reveal sequence on completion
5. Tactile-feeling drag with snap-to-grid
6. Color-coded pieces (each shape has a distinct palette)
7. Subdued hint system (pieces that don't fit show a soft red glow)
8. Compact, no-onboarding flow — first puzzle starts in <5 seconds
9. iCloud sync for streaks
10. Share-tile (à la Wordle) with squares + emoji

### 4. NYT Sudoku — The New York Times Games

Lives inside the NYT Games app/web. Subscription-gated.

1. **Three difficulties only** (easy / medium / hard) — curated, never auto-generated
2. New puzzle daily per difficulty — three puzzles per day, period
3. Embedded in the broader Games subscription (Wordle / Connections / Spelling Bee crossover)
4. Conservative typography — Cheltenham serifs in chrome; sans inside the grid
5. **Auto-check** is the default; can be turned off for "scary mode"
6. Hint reveals a single cell; no technique teaching
7. Pause auto-saves; resume picks up exactly where you left off
8. Cross-device sync via NYT account
9. **Statistics minimal**: just streak + best time
10. No leaderboards, no social — solitary by design

### 5. Sudoku — Brainium

Long-tenured classic. Free with ads.

1. **Auto-fill notes** with one button
2. Hint button gives one cell + the deduction (highlights why)
3. Five difficulties (very easy → expert)
4. Themes (light / dark / sepia / dynamic-by-time-of-day)
5. **Sound effects** for digit place / error / win, all toggleable
6. Statistics with histograms (time-distribution per difficulty)
7. **Resume button** is the home screen's primary CTA — game-state-first UX
8. Tap-and-hold on a cell shows cell-specific hints
9. Right-handed / left-handed mode swaps number pad position
10. iCloud sync; Game Center leaderboards

### 6. Killer Sudoku by Sudoku.com — variant

Cage-based variant where regions sum to a target. Same Easybrain UX shell as Sudoku.com.

1. Sums-as-cages overlay (dotted borders + small target number)
2. Six difficulties same as classic
3. Daily Killer puzzle with separate calendar archive
4. Cage-aware hint engine
5. **Combination calculator** built-in (for a 3-cell cage summing to 14: shows valid digit triples)
6. Themed events (Killer-only seasonals)
7. Statistics decoupled from classic (your "Killer best time" is its own row)
8. Free + ads, same monetization model
9. **Cross-promo**: solving a Killer streak unlocks a classic-Sudoku skin
10. Auto-pencil for cage-eliminated digits

### 7. Sudoku ∙ Classic Sudoku Games — Apple App Store top result

Newer, lightweight. Free with ads.

1. **Fast cold-start** — splash to playable in <1.5s
2. Six classic difficulties + variants (X-Sudoku, Sudoku 6×6 for kids)
3. Color-coded number pad (each digit has a stable hue)
4. Highlights "all 9s already placed" by fading 9 on the pad
5. **Long-press eraser** mode for bulk-clear
6. Per-difficulty stats with bar charts
7. Achievement system (50+ badges)
8. Light / dark / parchment themes
9. **Adaptive hint cost**: more hints in easy, fewer in expert
10. Daily streak with calendar — same paradigm as Sudoku.com

### 8. Sudoku a Day — indie

Free, **no ads ever**, downloadable PDFs.

1. Strict one-puzzle-a-day cadence
2. **Free PDF export** — print and play paper
3. Calendar of past days; can play any prior day's puzzle
4. **No accounts**, no logins — local-only state
5. Dark mode that respects system setting
6. Minimal stats (just streak)
7. Shareable completion link (read-only)
8. **No timer pressure** — timer optional, off by default
9. Three difficulties
10. Web-first; iOS/Android wrappers feel identical

### 9. Andoku Sudoku 3 — open-source / variant-rich

Android-first; free, ad-supported.

1. **16+ Sudoku variants**: X-Sudoku, Hyper, Color, Squiggly, Killer, Hypersquare
2. Difficulty inferred from puzzle, not declared (post-solve "this was Hard")
3. Battery-aware OLED-friendly dark mode
4. Granular pencil-mark interactions: tap-to-add, double-tap-to-confirm
5. Custom puzzle import via puzzle-string format (`...8.5..1.2...` etc.)
6. **No analytics, no telemetry** — privacy-first
7. Configurable input order: pad-first or cell-first
8. Statistics export to CSV
9. Hint shows technique name without solving the cell
10. **Per-variant best-times** stored separately

### 10. Microsoft Sudoku — bundled with Microsoft Casual Games

Pre-installed on Windows; cross-platform via Xbox account.

1. **Daily challenge calendar** with rewards (XP, badges)
2. **Cloud save** via Microsoft account
3. Five difficulties + variants (Irregular, Six)
4. **Voiceover-friendly** with full screen-reader support
5. Theme packs unlocked through play
6. **Picture-in-picture** mode on Xbox
7. Difficulty-adaptive coaching (suggests technique you might not know)
8. Tutorial campaign with story-mode chapters
9. **Game Pass perks** — premium themes free for subscribers
10. Achievements tied to Xbox profile

## Synthesized feature catalog

Every recurring feature, grouped. This is the canonical list the Bilko-Sudoku PRDs draw from. **Bold** = in scope for v1. *Italic* = explicitly deferred.

### Core gameplay
- **9×9 grid, 1–9 digits, classic Sudoku rules**
- **Six difficulties: easy / medium / hard / expert / master / evil** (we go past Sudoku.com's five — pulls from Andoku-style depth)
- **Pencil marks** (candidates, multiple per cell)
- **Auto-candidates** toggle (auto-fill all valid candidates, à la Good Sudoku)
- **Eraser** + **undo** + **redo** with unlimited history per puzzle
- *Variants (Killer, X, Squiggly)*

### Hints & teaching
- **Three-tier hint system** (highlight region → narrow → solve + name technique) — Good Sudoku model
- **Conflict highlighting** (live or post-fact, configurable)
- **Mistake counter** as soft fail-state (configurable: off / 3 / 5 lives)
- **Same-number highlighting** (tap a cell with 4 → all 4s glow softly)
- **Row/column/box highlighting** for the active cell
- *Inline technique tutorials*

### Daily + retention
- **Daily puzzle, deterministic from the date** (everyone gets the same puzzle that day)
- **Streak counter** (broken by missing a day; restorable with a "freeze" once per week)
- **Calendar archive** of past dailies
- *Seasonal events*

### Statistics + achievements
- **Per-difficulty: best time, average time, win rate, total wins**
- **Total time played** — Health-app vibe
- **Streak**, **longest streak**
- **Achievements** — first win, sub-3-min easy, 7-day streak, all-difficulties, 100 wins, etc.
- **Leaderboards via platform game services (PRD 30)** — top 100 per difficulty + daily

### Persistence
- **Auto-save current game; resume on launch**
- **Per-user save sync** via PRD 30 game services (one save slot for in-progress + per-difficulty stats)
- **Local-first; cloud opt-in** when signed in

### Visual & feel (Apple-grade)
- **Hairline grid lines** (1px outer; 2px box dividers; SF/system font)
- **Generous whitespace** — grid is the hero, chrome recedes
- **Light / dark / system themes** with smooth transition
- **Color-blind-safe palette** option
- **Subtle animations**: spring on cell tap, fade on number completion (all 9 ones placed → digit 1 fades from pad), confetti on win
- **Reduced-motion respects system setting**
- **Haptic feedback** on mobile: light tap on place, tick on note, pop on win
- **Optional sound effects** (off by default, à la Brainium): place, error, win
- *Liquid Glass / iOS 26 styling effects*

### Input
- **Tap cell → tap pad** (cell-first) or **tap pad → tap cell** (pad-first), user toggleable
- **Keyboard support** for desktop: arrows + 1–9 + N for note mode + Z for undo
- **Long-press** for note mode (mobile)
- **Apple Pencil**: future enhancement, not v1
- *Drag-to-fill (Sudoku Blox)*

### Platform integration (Bilko-specific)
- **Hosted on bilko.run/projects/sudoku/** as static-path sibling
- **Brand chrome** via @bilkobibitkov/host-kit (ToolHero header, footer)
- **Free** — no credit cost (mirrors Outdoor-Hours and LocalScore)
- **Daily puzzle leaderboard** via PRD 30 game services
- **Achievements** via PRD 30
- **Save state** via PRD 30 (resume across devices when signed in)

## Bilko-Sudoku design philosophy

Distilled into 5 rules. Every PRD acceptance criterion ties back to one of these.

### 1. Grid is the hero
The 9×9 grid is 70% of the screen on mobile, 60% on desktop. Everything else (number pad, controls, stats) defers. No menus, no tabs, no nav drawers. If the user opens settings, the grid stays visible behind a translucent sheet.

### 2. No celebration without earning it
No confetti for getting one cell right. No sound for opening the app. Reserve animation budget for moments that matter: completing all 9 of a digit, completing a row, completing the puzzle, breaking a personal best.

### 3. Honest about what you know
The hint system never lies. If a puzzle requires X-Wing logic, the hint at level 3 names "X-Wing". We don't pretend everything is a Naked Single. Pulled from Good Sudoku.

### 4. The pad is part of the game
The number pad shows live state: digits already exhausted (all 9 placed) fade out. Active digit (selected for placement) glows. This is the "second brain" — the pad watches the grid so the user doesn't have to.

### 5. No dark patterns
No timed offers. No "unlock pro for 3 hints/day" garbage. No streak-anxiety push notifications. No leaderboard FOMO. Bilko-Sudoku is free, calm, and ad-free. The bilko.run host pays its own bills via the paid tools.

## Visual specs (the diff vs every other Sudoku)

These are the precise tokens. Every UI PRD must consume them, not invent siblings.

```css
/* Grid */
--grid-line-thin:    1px;
--grid-line-thick:   2px;
--grid-color-thin:   color-mix(in oklch, var(--ink) 12%, transparent);
--grid-color-thick:  color-mix(in oklch, var(--ink) 36%, transparent);
--cell-radius:       2px;          /* tiny rounding on individual cells */
--grid-radius:       12px;         /* soft outer */

/* Typography */
--digit-font:        'SF Pro Rounded', system-ui;
--digit-given:       600;          /* puzzle digits */
--digit-entered:     400;          /* user-entered */
--digit-note:        500;          /* candidates: smaller, muted */
--digit-size:        clamp(20px, 5.5vmin, 32px);
--note-size:         calc(var(--digit-size) * 0.36);

/* Colors */
--ink:               #1c1c1e;       /* near-black, iOS systemLabel */
--paper:             #ffffff;
--given:             #1c1c1e;       /* puzzle givens use ink */
--entered:           #007aff;       /* SF blue — user-placed */
--conflict:          #ff3b30;       /* SF red */
--cell-active:       #007aff14;     /* 8% blue tint */
--cell-peer:         #00000008;     /* row/col/box of selected */
--cell-same-digit:   #007aff10;     /* same-number highlight */

/* Dark mode (system @media) */
--ink-dark:          #f2f2f7;
--paper-dark:        #1c1c1e;
--entered-dark:      #0a84ff;
--conflict-dark:     #ff453a;

/* Motion */
--spring-fast:       cubic-bezier(0.5, 1.4, 0.5, 1);
--spring-medium:     cubic-bezier(0.4, 0, 0.2, 1);
--duration-tap:      120ms;
--duration-fade:     220ms;
--duration-win:      720ms;
```

Every animation respects `@media (prefers-reduced-motion: reduce)` and degrades to instant transitions.

## Layout (mobile-first)

```
┌─────────────────────────────────┐
│  Bilko · Sudoku            ⚙    │  ← chrome (host-kit, slim)
├─────────────────────────────────┤
│  Easy · 02:14 · ♥♥♥             │  ← stats strip
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │                           │  │
│  │       9×9 grid            │  │  ← hero, max width
│  │       (square, max 92vw)  │  │
│  │                           │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┐            │
│  │1│2│3│4│5│6│7│8│9│            │  ← number pad
│  └─┴─┴─┴─┴─┴─┴─┴─┴─┘            │
│  ⌫  notes  hint  undo           │  ← actions row
└─────────────────────────────────┘
```

## What we deliberately copy vs reject

| From | Copy | Reject |
|---|---|---|
| Good Sudoku | 3-tier hint, technique naming, daily harder-as-week, no IAP | Three modes (Arcade/Eternal) — too many concepts |
| Sudoku.com | 6 difficulties, daily calendar, statistics depth | Ads, ad-removal IAP, seasonal events, mistake-game-over |
| Sudoku Blox | Apple-feel animations, share-tile | Polyomino input — we ship classic |
| NYT Sudoku | Restraint, single-page-app feel | Subscription paywall |
| Brainium | Sound toggle, resume-first home | Right/left-hand toggle (we just center) |
| Microsoft | Voiceover support, cloud save, daily | Story-mode chapters, Game Pass |

## Differentiation: what is *uniquely* Bilko about this

1. **Free + ad-free + login-optional**, hosted on a personal-brand site that already serves 12 other tools. No app-store gatekeeper.
2. **Cross-tool achievements via Bilko account** (when signed in): finishing your first Sudoku unlocks a Bilko-wide "puzzler" badge that's visible across other Bilko games (when more arrive).
3. **The Bilko brand chrome is the only header.** No app-icon, no splash, no nag. The site IS the wrapper.
4. **Open source-ish** — the engine + UI live in `~/Projects/Bilko-Sudoku/`, eventually publishable so anyone can self-host.
5. **Built in 12 PRDs by parallel Sonnet agents in one weekend.** That's the build-in-public story (see blog post).

## References

- [Best Sudoku Apps Compared (sudokuaday.com)](https://sudokuaday.com/best-sudoku-app-comparison)
- [10 Best Sudoku Apps for iPhone and Android (Puzzle Find)](https://puzzlefind.com/blog/10-best-sudoku-apps)
- [Good Sudoku presskit](https://www.playgoodsudoku.com/presskit/)
- [MacStories — Game Day: Good Sudoku](https://www.macstories.net/reviews/game-day-good-sudoku/)
- [Sudoku.com (Easybrain)](https://sudoku.com/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [iOS 26 Design Patterns (LearnUI)](https://www.learnui.design/blog/ios-design-guidelines-templates.html)
