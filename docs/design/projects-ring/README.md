# Handoff: Projects Ring (portfolio carousel + fixed hero)

> Imported 2026-10-13 from claude.ai/design project `5aafc439-2dde-4677-be74-e3455318abe1`
> (`design_handoff_projects_ring/README.md`). Source of truth for the `/projects` redesign.
> The prototype is `Projects Ring.dc.html` beside this file (needs the design tool's
> `support.js` runtime to open; read it as a spec, don't run it).

## Overview
A full-screen replacement for the `/projects` list page on bilko.run. It's built for hundreds of projects. A fixed **hero window** sits in the horizontal center of the stage and shows one project in detail. All other projects are thin vertical **spines** arranged in an endless ring on both sides. Spines get smaller and fade as they get farther from the center. Navigating rotates the ring: spines slide toward or away from the window while the window stays put and crossfades its content.

## About the Design Files
`Projects Ring.dc.html` is a **design reference created in HTML**. It's a working prototype that shows the intended look and behavior, not production code to copy directly. Recreate it in the target codebase's existing environment (React, Astro, Vue, etc.) using its established patterns.

## Fidelity
**High-fidelity.** Colors, type, spacing and motion are final. Recreate pixel-accurately. The screenshot areas are placeholders and should be replaced with real project imagery.

## Layout (100vh with min-height 720px — page scrolls below that; column flex, background #f5f0e6)
1. **Site header** (flex:none). Padding 16px 32px, border-bottom 1px #d4ccb8. Logo mark: 30px ink circle with a serif "B". Name: Source Serif 4, 20px. Nav at 15px with Projects active (2px #a83818 underline, 4px offset). Search hint on the right in mono. Reuse the existing site header from the real codebase.
2. **Section bar** (flex:none). Padding 28px 32px 20px, space-between.
   - Left: eyebrow `SECTION 02 · PORTFOLIO` (JetBrains Mono 500 11px, letter-spacing .18em, #5d5648). Title `Projects & Packages.` (Source Serif 4, 400, 44px/1, letter-spacing -.02em).
   - Right: a ← button, a counter `001 / 140` (mono 12px, .12em, min-width 100px, centered), and a → button. Buttons are 44×44 with a 1px #2a241c border and a transparent fill. On hover the fill becomes #1a1612 and the text #f5f0e6.
3. **Stage** (flex:1, position:relative, overflow:hidden, 1px #2a241c top and bottom borders). Holds the ring and the hero window.
4. **Scrubber** (flex:none). Padding 16px 32px 18px. One tick per project, flex:1 each with a 1px gap, bottom-aligned in a 28px row.
   - Active tick: 28px tall, #a83818.
   - Ticks within ±6: 16px tall, #5d5648.
   - All other ticks: 8px tall, #d4ccb8.
   - Hover: #1a1612. Clicking a tick jumps to that project.
   - Caption row below in mono 10px, .14em, #5d5648: `NEWEST` · `SCROLL · ←/→ · CLICK A SPINE OR TICK` · `OLDEST`.

### Hero window
- Width: `clamp(460px, 44% of stage width, 680px)`, horizontally centered, full stage height. Background #f5f0e6, 1px #2a241c left and right borders, padding 28px 32px, z-index above the spines.
- Content is a column with a 16px gap:
  - Meta row: 9px category dot, then `001 · DEV TOOL · CLI` (mono 11px, .14em, #5d5648). A `LIVE` badge is pushed right: 1px #2e5a3e border, #2e5a3e text, padding 4px 12px, letter-spacing .16em.
  - Screenshot area: flex 1, min-height 0 (absorbs short viewports), 1px #d4ccb8 border. The placeholder is a 135° stripe of #ede6d6 / #e3dcc8.
  - Title: Source Serif 4, 400, 52px/1, letter-spacing -.02em.
  - Description: Inter Tight 17px/1.5, #3a342b, text-wrap: pretty.
  - Footer: 1px #d4ccb8 top border, 16px padding-top. It holds up to three stats, each with a value (serif 19px) over a label (mono 9px, .14em, #5d5648): primary stat, `PRIMARY LANG`, `UPDATED`. Only stats that exist are shown. Buttons sit on the right: `Full story` (outlined; hover #ede6d6) and `Open →` (fill #1a1612, text #f5f0e6, 500 15px, padding 12px 20px; hover fill #a83818).

### Spines (the ring)
- Each spine is absolutely positioned at top 50%, with background #ede6d6 and a 1px #2a241c border. Hover: #e3dcc8. Native `title` tooltip shows the project name.
- Inside each spine, a column with padding 16px 0: number (mono 10px #5d5648), a 7px category dot, then the title in vertical text (`writing-mode: vertical-rl; rotate(180deg)`, Source Serif 4) pinned to the bottom.
- Geometry for distance `j` from the active project (j ≥ 1):
  - width `64 · f^(j-1)`, where f = falloff, default 0.9
  - height `max(120, stageHeight − 40) · 0.95^j`
  - title size `max(11, 22 · 0.93^(j-1))` px
  - opacity `max(.25, 1 − (j−1)·.06)`
  - gap 6px between spines, and 8px from the hero edge
  - Spines on the right start at heroRight + 8. Spines on the left mirror that.
- Spines that would fall off-screen get opacity 0 and pointer-events none. The active project's own spine is hidden behind the hero.
- Offsets wrap: `k = ((i − active) mod N)`, then shifted into [−N/2, N/2]. The list is endless in both directions.

## Interactions & Behavior
- **Click a spine**: it becomes active and the ring rotates.
- **← / → buttons and arrow keys** (window-level, ignored while typing in inputs): move ±1.
- **Mouse wheel / trackpad over the stage**: move ±1. Uses the dominant axis, throttled to 140ms, ignores deltas under 4. A non-passive listener calls preventDefault.
- **Scrubber tick click**: jumps straight to that project.
- **Motion**:
  - Spines transition `transform .55s cubic-bezier(.6,0,.2,1)`, width/height .55s, opacity .4s.
  - Hero content re-runs a fade-up on every change: opacity 0→1, translateY 10px→0, .45s ease. In production, key the hero content by project id.
- **Autoplay** (optional prop, default off): advances every `interval` seconds (default 5).
- **Resize**: a ResizeObserver on the stage recomputes the hero width and all spine positions.
- **Accessibility to add in production**:
  - Spines as `<button aria-label="Open {title}">`.
  - Hero as `aria-live="polite"`.
  - Respect `prefers-reduced-motion`: drop transitions to 0 and skip the fade.

## State
- `activeIndex` (int, wrapped to [0, N)).
- `stageWidth`, `stageHeight` (from ResizeObserver).
- Data: an array of projects `{ id, title, desc, tags[], stat?: [value, label], lang?, date, category, live, url, storyUrl, image }`, ordered newest first. The prototype repeats the 7 real projects to 140 entries to demo scale. Replace this with the real list.
- Suggested: sync `activeIndex` to the URL (`?p=slug`) so a featured project can be deep-linked.
- Performance: for 500+ projects, render only spines with |k| ≤ ~30 (still keyed by project id so they animate) and keep the scrubber as a single canvas or SVG.

## Design Tokens
- Colors: paper #f5f0e6, paper-2 #ede6d6, paper-3 #e3dcc8; ink #1a1612, ink-2 #3a342b, ink-3 #5d5648, ink-4 #9c937f; rule #2a241c, rule-soft #d4ccb8; accent #a83818, accent-3 (green / LIVE) #2e5a3e.
- Category dots: accent #a83818, ink #1a1612, green #2e5a3e. Map these to your project categories.
- Type: Source Serif 4 (400) display/titles; Inter Tight (400/500) UI/body; JetBrains Mono (500) labels, uppercase, letter-spacing .12–.18em.
- Radius: 0 everywhere, except the round dots and the logo. No shadows.
- Spacing used: 6, 8, 10, 16, 20, 28, 32 px.

## Assets
None. Project screenshots are placeholders. Fonts come from Google Fonts.
