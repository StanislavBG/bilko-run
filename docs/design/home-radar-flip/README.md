# Handoff: Home Radar Flip (home page with radar dial + page-flip navigation)

> Imported 2026-10-19 from claude.ai/design project `f0f092af-477e-465d-8989-3c7a47b45211`
> (file `Home Radar Flip.dc.html`). Source of truth for the `/` redesign.
> The prototype is `Home Radar Flip.dc.html` beside this file (needs the design tool's
> `support.js` runtime to open; that runtime is not committed. Read the prototype as a spec, don't run it).

## Overview
A full-screen replacement for the bilko.run home page. One viewport, no page scroll. A left column holds the pitch and a three-row section index. In the middle is a **radar dial** with a rotating sweep arm. Projects, blog posts and contact channels are blips on the dial, grouped into three sectors. On the right a **sector readout** lists the items in the sector the sweep is in. Leaving the page (click a section, press 1/2/3, scroll down) plays a **page flip**: the home sheet swings away like a book cover and the destination page shows underneath, then the browser navigates.

## About the Design Files
`Home Radar Flip.dc.html` is a **design reference created in HTML**: a prototype of the look and behavior, not production code to copy. Recreate it in the existing React/Tailwind codebase using its established patterns. The prototype's `P`, `POSTS`, `CH` and `NOW` arrays are placeholder data (see Production decisions).

## Fidelity
**High-fidelity.** Colors, type, spacing and motion are final.

- Colors: paper #f5f0e6; paper-2 #ede6d6; paper-3 #e3dcc8; rules #d4ccb8 (strong) and #e3dcc8 (soft); ink-4 #9c937f; ink-3 #5d5648; ink-2 #3a342b; ink #1a1612; accent #a83818; green #2e5a3e. Flip backdrop (behind both sheets) #e3dcc8.
- Fonts: Source Serif 4 (display, 400; italic for the `B`), Inter Tight (body, 400/500/600), JetBrains Mono (labels, 500/700, uppercase, letter-spacing .1–.2em).
- Home sheet background: #f5f0e6 with a dot grid, `radial-gradient(#e3dcc8 1px, transparent 1.3px)` at 32px × 32px.
- Radius: pills (999px) for nav links, chips and CTA; circles for the logo, dots and dial; 0 elsewhere.

## Layout
The page is `100vh`, `overflow:hidden`, `perspective: 2400px`. Two absolutely positioned sheets: **Destination** (z 1) underneath and **Home** (z 2) on top. Home is a column: header, hero (flex 1), bottom bar.

### Header
Padding 18px 56px, 1px #e3dcc8 bottom border, space-between, gap 24px.
- Left: logo link to `/`. 28px #a83818 circle with an italic serif `B` (17px, #f5f0e6), then `Bilko Bibitkov` in Source Serif 4 22px.
- Centre: nav of three pill links, gap 6px, 14px, padding 8px 14px, colour #3a342b. Each shows a mono 10px #9c937f number (`01` `02` `03`) then the label (Projects, Blog, Contact). Hover: #ede6d6 fill, #a83818 text.
- Right: `Online` in mono 11px, .12em, uppercase, #5d5648, with a 7px #2e5a3e dot that twinkles (opacity 1 ↔ .3, 1.6s).

### Hero
Flex 1, `min-height:0`, `overflow:hidden`, position relative (the crosshair is positioned against it). Inside: max-width 1280px, centered, padding 24px 56px, flex-wrap, `align-items:center`, `justify-content:center`, `align-content: safe center`, gap 32px, `overflow-y:auto`.

#### Left column (flex 1 1 300px, max-width 380px, gap 22px)
- Eyebrow: 7px #a83818 twinkling dot + `On air · studio of one` (mono 11px, .2em, uppercase, #a83818).
- H1 `Make. Ship. <em>Write it down.</em>`: Source Serif 4 400, `clamp(48px, 5vw, 66px)`, line-height 1, letter-spacing -.035em. The `em` is #a83818.
- Lede: `Small AI tools built in the open. Use the projects, read the build logs, send a message.` Inter Tight 16.5px/1.55, #3a342b, `text-wrap: pretty`.
- Section index: three rows under a 1px #e3dcc8 top border. Each row is a grid `30px minmax(0,1fr) auto`, gap 10px, padding 14px 10px, 1px #e3dcc8 bottom border. Columns: number (mono 11px), name (serif 26px/1), count + ` ↗` (mono 10.5px, .12em, uppercase). The row for the active sector has a #ede6d6 background, its number and count in the sector colour, and the name in #1a1612. Other rows: #9c937f numbers, #5d5648 names. Colour/background transitions .4s. Hovering a row locks the sector; leaving the list unlocks.
- Counts: Projects `8 live`, Blog `Weekly logs`, Contact `Open inbox`.

#### Radar dial
Authored on a fixed 520px canvas, then scaled with `transform: scale(size/520)` from the top-left; the wrapper is `size × size`, `cursor: crosshair`.
- Outer circle: 1px #d4ccb8. Inner rings: 1px #e3dcc8, inset 87px and 173px. Fill: a conic tint over the active sector, `conic-gradient(from <start>deg, rgba(168,56,24,.06) 0 <span>deg, transparent <span>deg)`.
- Axes: three 260px 1px #9c937f lines from the centre, rotated -90°, 90° and 180° (spokes pointing up, down and left; there is no right spoke). Axis labels in mono 500 10px, .1em, #9c937f: `000` above the top (top -22px), `090` right (right -30px), `180` below (bottom -22px), `270` left (left -30px). Bearing is clockwise from the top.
- Sector spans: Projects 0–180°, Blog 180–270°, Contact 270–360°.
- Sector chips (pills): padding 5px 11px, 1px border, mono 700 10.5px, .14em, uppercase, #f5f0e6 fill, centred at (472,472) Projects, (48,472) Blog, (48,48) Contact. Border and text colour: sector colour (Projects #a83818, Blog #1a1612, Contact #2e5a3e) when active, #9c937f border / #5d5648 text otherwise; .4s transition. They are links; hover locks the sector.
- Sweep: a full-dial layer with a conic trail, `conic-gradient(from 0deg, rgba(168,56,24,0) 0 280deg, rgba(168,56,24,.2) 359deg, rgba(168,56,24,0) 360deg)`, and a 2px #a83818 arm from the centre to the top edge. The whole layer rotates; `pointer-events:none`.
- Centre: 68px #a83818 circle at (226,226), italic serif `B` 32px #f5f0e6, glow `0 0 40px rgba(168,56,24,.45)`, z above the sweep.
- Mode pill: at (472,48), centred on that point. Padding 5px 10px, mono 700 10px, .12em, uppercase, 6px dot in `currentColor`. Text: `Auto sweep` (#ede6d6 fill, #5d5648 text), `Exploring · 090°` (bearing zero-padded to 3 digits; #1a1612 fill, #f5f0e6 text), `Locked · <label>` (#a83818 fill, #f5f0e6 text).
- Blips: one per item, positioned at bearing `b` and distance `d` from the centre: `x = 260 + d·sin(b)`, `y = 260 − d·cos(b)`, rounded. 12px dot in the item colour, opacity .35 unlit / 1 lit, glow `0 0 12px` when lit, .9s opacity/shadow transition. Hover/lock ring: 32px, 1.5px border, opacity 0→1 and scale .4→1 in .25s. Label under the dot (top 12px, centred): mono 500 10.5px, .1em, uppercase, #1a1612 on #f5f0e6, padding 2px 6px, shown only on the one label-bearing blip (see Interactions).
- Blip bearings and distances (prototype): Projects b = 15, 36, 57, 78, 99, 120, 141, 162 with d = 210, 140, 225, 120, 200, 150, 230, 170. Blog b = 192, 208, 224, 240, 256 with d = 150, 215, 120, 200, 170. Contact b = 290, 315, 340 with d = 180, 130, 210. Blip colours follow the sector (#a83818, #1a1612, #2e5a3e). Blip labels: project name, `LOG 01`…`LOG 05`, channel name.

#### Sector readout (right column)
flex 1 1 250px, max-width 300px, column, gap 16px.
- Top row (mono 10.5px, .16em, uppercase): `Sector 01` in #a83818, plus ` · manual` when the user or a lock is steering; the item count in #5d5648 on the right.
- Sector name: serif 42px/1, letter-spacing -.025em.
- Item list: rows with 1px #e3dcc8 top border, padding 8px 0. Name 13.5px/1.3, single line with ellipsis; sub-line mono 9.5px, .12em, uppercase, #5d5648. Row colour: #1a1612 when its blip is focused, #a83818 when lit, #3a342b otherwise; .9s colour transition; hover #a83818.
- CTA pill: `Flip to projects →` / `Flip to the blog →` / `Flip to contact →`. Padding 10px 18px, #a83818 fill, #f5f0e6 text, 600 14px; hover #1a1612 fill.
- Hidden under 1180px viewport width.

### Bottom bar
Height 52px, padding 0 56px, 1px #e3dcc8 top border, #f5f0e6 fill, mono 11px, .1em, uppercase, #5d5648. Grid `1fr auto 1fr`, gap 24px.
- Left: `Currently →` (#a83818) and a line of status text that rotates every 5s, one-line ellipsis.
- Centre: link to `/projects`: a bobbing `↓` (nudges 4px, 1.8s) and `Scroll to flip into Projects · or press 1 · 2 · 3`, #1a1612.
- Right: `Buy me a coffee →` to `/coffee`, #3a342b, right-aligned.

### Destination sheet (under the home sheet during the flip)
A stand-in for the page being opened: header (logo, path in mono 11px), a title block (eyebrow mono 11px .18em; title serif `clamp(48px,7vw,88px)`/.95; lede 18px/1.5, max 640px), a placeholder body (seven spines for Projects, four skeleton rows otherwise) and a bottom status row with a 3px #e3dcc8 progress bar filling #a83818 over 1.6s. This sheet is a prototype device; production does not need to re-draw the destination (see Production decisions).

## Interactions
- **Sweep.** Rotates clockwise at `360 / period` degrees per second. Period 9s (prop `sweepSeconds`, clamped 4–16).
- **Target easing.** When something steers the sweep (a locked sector, or the pointer on the dial) it eases to the target bearing along the shortest arc each frame: `ang += shortestDelta · min(1, dt · 9)`; `dt` is capped at 0.1s.
- **Lit rules.** Auto mode (nothing steering): a blip is lit for 1.3s after the sweep passes it, i.e. `(sweep − bearing) mod 360 / dps < 1.3`. Manual mode: lit when within 11° of the sweep bearing.
- **Label blip.** The focused blip, else the blip closest behind the sweep (smallest score), shows its label, if lit.
- **Hover lock (sector).** Hovering a section-index row or a sector chip locks that sector: the sweep eases to the sector midpoint (Projects 90°, Blog 225°, Contact 315°) and the mode pill reads `Exploring`. Leaving unlocks and the sweep resumes.
- **Pointer on the dial.** While the pointer is inside the 280px-radius circle (in 520px units) the sweep chases the pointer bearing (`Exploring · NNN°`).
- **Blip focus.** A blip within 34px (520px units) of the pointer is focused: the sweep snaps to that blip's bearing, the ring appears, the pill reads `Locked · <label>`, and the matching readout row turns #1a1612. Clicking a blip opens its page.
- **Crosshair.** Over the hero, a 1px #d4ccb8 vertical line and horizontal line follow the pointer (z 7), with a readout 14px right / 10px below it: mono 500 10.5px, .1em, #a83818, text `X 0.000 · Y 0.000` (pointer position as a fraction of the hero box, 3 decimals). Hidden on leave and during a flip. Prop `crosshair`, default on.
- **Active sector.** The sector the sweep is in (`ang < 180` Projects, `< 270` Blog, else Contact), or the locked sector. It drives the chip colours, the index row highlight, the dial tint and the readout.
- **Flip triggers.** Click a section row, nav pill, chip, readout CTA or blip; click empty dial space (flips into the sector the sweep is in); wheel down more than 24px; keys `1` `2` `3`, `ArrowDown`, `PageDown`, `Space` (the last three go to Projects). Keys are ignored while typing in an input or textarea. Clicks call `preventDefault`; a flip in progress ignores further triggers.

## Motion
- **Flip, out.** The home sheet rotates away: `book` = `rotateY(-104deg)` about `0 50%` (left edge hinge); `calendar` = `rotateX(96deg)` about `50% 0`. Transition `transform .95s cubic-bezier(.65,0,.35,1)`, `box-shadow .95s`. Shadow while out `0 40px 80px rgba(26,22,18,.35)`. A #1a1612 shade over the sheet goes to opacity .45 in .95s. `backface-visibility: hidden`.
- **Navigate.** At 950ms the prototype either navigates (`navigate` true: `window.location.href = dest.url`) or holds 1.3s, flips back over .95s and returns to idle.
- **Ambient.** Twinkle 1.6s on the Online and On-air dots, nudge 1.8s on the bottom-bar arrow, the 90ms state tick that refreshes the status line, the sweep on `requestAnimationFrame`.
- **Transitions.** Index rows and chips .4s; blip dot/glow .9s; blip label .5s; readout rows .9s; mode pill .3s.

## Responsive rules
- Readout (right column) hidden under 1180px viewport width; hero wraps.
- Dial size: `wide = vw >= 1180`. `avail = wide ? 520 : vw >= 760 ? vw − 112 − 300 − 32 : vw − 64`. `size = round(max(260, min(520, vh − 66 − 52 − 72, avail)))`. Scale is `size / 520`.
- The hero scrolls vertically (`overflow-y:auto`, `align-content: safe center`) when content is taller than the viewport.

## Production decisions
Settings for the real implementation, chosen by the owner for the home page:

- **flipStyle = `book`**, **navigate = `true`**. The flip plays, then the browser navigates to the destination at 950ms. The hold-and-flip-back path and the prototype's Destination sheet are preview-only.
- **Data is live, not the prototype's arrays:**
  - Projects: the registry (`src/data/projectsRegistry.ts`), first 8 public projects. Name, kind and URL come from the entry. Count text reflects the real number shown.
  - Blog: the blog API, the 5 newest posts (title and slug → `/blog/<slug>`).
  - Contact: the channels already on the Contact page.
  - The `Currently →` lines also come from real data, not the prototype's `NOW` strings.
- **Projects and Contact page content is unchanged.** They only gain the new header and bottom bar, shared through the common Layout, so all three routes look consistent.
- **Privacy and Terms stay reachable** from the bottom bar (the prototype's bar has no room for them; add them without changing the 52px height or the three-column grid).
- **Reduced motion and viewports under 900px navigate without the flip.** With `prefers-reduced-motion: reduce`, or a viewport narrower than 900px, a trigger goes straight to the destination URL. Same for keyboard triggers.
