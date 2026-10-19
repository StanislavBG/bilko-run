# Handoff: Observability Command (`/admin/observability` redesign)

> Imported 2026-10-18 from claude.ai/design project `b2910ee6-382f-4628-9619-894cf99ed189`.
> Source of truth for the `/admin/observability` redesign. The prototype is
> `Observability Command.dc.html` beside this file. It needs the design tool's `support.js`
> runtime (also beside this file) to open. Read it as a spec, don't run it.
> The prototype's `D = {...}` block (lines 488-514) is **sample data only**. Production must
> use the existing admin APIs listed below and must not show any hard-coded number.

## Fidelity
**High-fidelity.** Colors, type, spacing and module layout are final. Recreate them in React +
inline styles / Tailwind arbitrary values under `src/pages/admin/command/`. Do not port
`support.js`, `sc-for` or `DCLogic`. They are the design tool's runtime.

## Tokens (from the prototype)
| Token | Value | Use |
|---|---|---|
| bg | `#0b0907` + 32px grid lines `rgba(245,240,230,.022)` | page |
| panel | `#13100c` (globe `#100d0a`, inset wells `#0f0d0a`, cards `#1a1612`) | module bodies |
| line | `#2a241c` (row rules `#1f1a14`, strong `#3a332a`) | borders |
| ink | `#f5f0e6` (numbers), `#e8e0cf` (text), `#9c937f` (muted), `#6d6555` (faint) | text |
| accent | `#f26a2e` (orange), `#f4b942` (amber), `#6fbf8a` (green), `#ff5a4a` / `#ff8a7a` (error) | data |
| fonts | Inter Tight 400-700 (numbers, titles), JetBrains Mono 400-600 (labels, tables), Source Serif 4 (brand) | |
| radius | 3px panels, 2px chips | |

Labels are JetBrains Mono 9.5-10px, letter-spacing .14-.16em, uppercase. Big numbers are Inter Tight 600 at 24/26/34/40px.

## Page frame (lines 25-61, 467-475)
- The page is full viewport, outside the site `<Layout />`: 100vw × 100vh, min 1280×760, `overflow:hidden`, padding 10px 12px. It's a 4-row column with an 8px gap: top bar → KPI strip → main grid → ticker.
- **Top bar (38px)** has these parts:
  - Brand: the "B" serif disc, "Bilko *Bibitkov*", `OBSERVABILITY // COMMAND`.
  - Segmented controls: **LAYOUT** RAILS/DOCK/WING, **WINDOW** 1D/7D/30D, **REFRESH** 30S/1M/5M/OFF.
  - **⤢ FOCUS / ⤡ RESTORE** button, a status LED and a live clock (24h `HH:MM:SS`).
  - Production deviations:
    - Default refresh stays **5M**. 30s polling was the busiest route on the host; see `ObservabilityPage.tsx` lines 51-55. Polling pauses while the tab is hidden.
    - The status LED shows `ONLINE` (green) when the last fetch succeeded and no alerts are open. It shows `N ALERTS` (amber) when open alerts exist (sum of rows' `openAlerts` + `globalAlerts`), and `STALE` (red) when the last refresh failed.
    - A small `SESSION VIEW` link to `/admin/sessions` sits beside the clock.
- **Ticker (28px)** comes from `traffic.recent`:
  - Each entry shows `HH:MM:SS`, the status (green < 400, red ≥ 400), the path (amber when bot), the country, `device/browser/os`, and a `BOT` badge (amber) or `4xx` badge (red).
  - The list is duplicated and scrolls with `obsTicker 50s linear infinite`.
  - The right-side hint reads `1–7 SWAP · F FOCUS · ESC`.
  - The animation is disabled under `prefers-reduced-motion`.
- **Scanlines overlay**: a `repeating-linear-gradient` at z-index 40 with pointer-events none. It is on by default.

## KPI strip (lines 63-102): 9 equal tiles
| Tile | Value | Sub-label | Source |
|---|---|---|---|
| HITS · {win} | `traffic.totals.hits` | 7-bar sparkline of `byDay[].hits` | `/api/admin/traffic` |
| UNIQUE VISITORS | `totals.visitors` | `{byCountry.length} countries` | traffic |
| BOT HITS | `totals.botHits` | `{bot/(hits+bot)}% of hits` (amber) | traffic |
| 404S | `totals.notFound` | `clean` (green) when 0, else red | traffic |
| CLICKS | `totals.clicks` | `top · {topClicks[0].label}` | traffic |
| APP SESSIONS | Σ `flows.apps[].sessions` | `{apps.length} apps` | `/api/admin/flows` |
| ERRORS | Σ `flows.apps[].errors` | top erroring app; the tile turns red (`#1a0f0b`, border `rgba(255,90,74,.45)`) when > 0 | flows |
| EGRESS | `egress.totalBytes` (MB) | `{top slug share}% one app` (amber when > 50%) | `/api/admin/egress` |
| BLOG CADENCE | `{gapDays}d` | `on cadence · ≤{targetUpperDays}d`, colored by status ok/warn/critical | `/api/admin/blog-cadence` |

## Main grid and module mechanics (lines 104-106, 478-552, 640-651)
- There are 7 modules: `globe, sessions, apps, traffic, audience, clicks, bandwidth`, numbered 01-07.
- One module is on the **stage** (large); the other six sit in **rail** slots and render a **compact** view. Default positions: `globe:stage, apps:l1, traffic:l2, audience:l3, sessions:r1, clicks:r2, bandwidth:r3`.
- Layout presets (grid-template-columns / rows / slot `[gridColumn, gridRow]`), copied exactly from `LAY` at line 480:
  - `rails`: `300px minmax(0,1fr) 340px` × 3 rows; stage in the middle column, spanning rows 1 / 4.
  - `dock`: 6 columns × `minmax(0,1fr) 230px`; stage spans the top row.
  - `wing`: `minmax(0,1fr) 300px 300px` × 3 rows; stage on the left.
  - `max` (FOCUS): only the stage is shown, 1×1.
- **Swap behavior**:
  - Clicking a rail module, or pressing keys `1`-`7`, swaps it with the stage module (positions exchange).
  - `F` toggles max and `Esc` restores.
  - Changes animate via `document.startViewTransition` when the browser supports it; each module has `view-transition-name: m-<key>`.
  - Keys are ignored while focus is in an INPUT or TEXTAREA.
- Layout, positions and window are remembered per viewer in `localStorage`, with every access wrapped in try/catch.
- **Module header (28px)**: number (orange) · title (ink) · subtitle (faint) · right-aligned hint: `ON STAGE · F`, `FOCUSED · ESC`, or `[n] ⤢` on rails.
- A stage module gets an inner outline `rgba(242,106,46,.5)`.

## 01 Globe: traffic origin (lines 107-143, 554-627)
- **Data**: `traffic.byCountry[{country, hits}]` and `totals`. Skip null/unknown codes. Centroids come from an ISO-3166 alpha-2 → [lon, lat] table covering all countries, not just the prototype's 22.
- **Render**: canvas, d3-geo orthographic projection, land from `world-atlas/land-110m.json`, bundled locally rather than fetched from a CDN. Draw order:
  1. Land as a dot grid at 2° steps (compute once and cache).
  2. Graticule.
  3. Glow and rotating tick ring.
  4. Country pulses: radius ∝ √hits, plus an expanding ring.
  5. Dashed amber arcs from the top 14 countries to the origin server. HOME is the Render us-west region, `[-122.4, 37.8]`.
  6. Green square at the origin.
  7. Labels `CC hits` for the top 10 when on stage.
- **Interaction**: autorotate (0.05°/frame); drag to rotate when on stage, with tilt clamped to ±60°.
- **Pings**: production **does not simulate**. A ping fires for each `traffic.recent` hit newer than the previous fetch, at that hit's country.
- **Stage overlay** (top-left):
  - `ORIGIN · N COUNTRIES` and a big hits number with `hits · {uv} uv`.
  - Top-12 country rows: code / bar / hits.
  - `+N more · …` listing the remaining codes.
- Top-right of the stage: `ARCS → ORIGIN · US-WEST`, `PINGS nn`, `DRAG TO ROTATE`. Bottom-right: legend.
- **Compact**: the globe plus the top 3 countries in the bottom-left.
- `prefers-reduced-motion` turns off autorotate and pulse animation.

## 02 Sessions: journeys (lines 145-224, 629-681)
- **Data**:
  - `GET /api/admin/sessions?days&email&visitor&app` provides the list.
  - `GET /api/admin/sessions/:id` provides the journey timeline.
- **Stage, left column**:
  - Filter input `filter · email, visitor id, app`, with a count `shown / total`. A value containing `@` → `email`, a UUID → `visitor`, a slug → `app`, server-side, debounced 300ms.
  - Session rows in a 3×2 grid:
    - Row 1: `HH:MM`, user (email or short visitor id) plus a `YOU` chip when the email equals the signed-in admin's email, and the duration `m:ss`.
    - Row 2: `MM/DD`, `landing → exit · app`, `P{pages} C{clicks} E{events}`.
  - The selected row gets bg `rgba(242,106,46,.08)` and `inset 2px 0 0 #f26a2e`.
- **Stage, right column (journey)**:
  - Facts grid: USER, STARTED, DURATION, LANDING, EXIT, APP.
  - Step rail: one node per step, with views as squares and others as circles. The current node is orange with a glow; past nodes are `#5d5648`. A progress line runs across the rail.
  - Current-step card: `STEP n / N`, `+m:ss`, a kind chip, the big label and a sub line.
  - Controls: ◂ PREV, ▶ PLAY / ❚❚ PAUSE, NEXT ▸, speed 1x/2x/4x, and the `SPACE play` hint. Space toggles play only while Sessions is on stage.
  - A scrollable step list.
  - Steps come from `buildSessionSteps()` in `src/lib/sessionSteps.ts`; reuse it, don't re-derive.
  - Kind colors: view amber, click orange, event green, **error red** (the error color is a production addition).
  - An `OPEN IN SESSION VIEW` link goes to `/admin/sessions/:id`.
- **Compact**: the session count, `last HH:MM`, and the top 7 rows (time, flow, duration).

## 03 App health (lines 226-259, 682-688)
- **Data**: `flows.apps[{app, sessions, views, clicks, events, errors, last_seen_ms}]` merged by slug with `/api/admin/observability` rows (`hostKitDrift`, `synthetic.latestOk`, `openAlerts`, `manifest.version`, `latestError`).
- **Stage**:
  - A 5-column tile grid. Each tile has an LED, the name, a big sessions number, `VIEW / CLK / EVT / ERR` mini-stats and a status line.
  - LED and status:
    - Red when errors > 0 (`N ERRORS · last`).
    - Green when last seen within 48h (`ACTIVE · last`).
    - Faint otherwise (`IDLE · last`).
  - Tile background heat is `rgba(242,106,46, .03 + .2·act)`, where `act = min(1, √((s+v+c+e/10)/400))`. Error tiles use `rgba(255,90,74,.10)` with border `rgba(255,90,74,.55)`.
  - The header shows `N erroring` in red.
  - **Production addition**: clicking a tile opens an in-module detail sheet so the existing data stays reachable. It shows:
    - That app's funnels from `flows.flows`: steps with sessions and % of the first step.
    - Manifest facts: version, git sha, host-kit drift, synthetic pass/fail and avg/max load, bundle size, latest error.
- **Compact**: mini tiles, LED plus name only.

## 04 Traffic: pages · referrers (lines 261-328)
- **Data**: `traffic.byDay[{date, hits, visitors}]`, `topPages`, `topReferrers`, `bySlug`.
- **Stage**:
  - **HITS PER DAY**: one column per day, scaled to the peak. The visitors marker is an amber 2px line with a glow. Each column shows `hits` / `uv` above it and `MM-DD` below. The header reads `PEAK MM-DD · n`.
  - Below that, three tables: TOP PAGES (hits, uv), REFERRERS (hits), PROJECTS (hits, uv). Each row has a 2px underline bar ∝ value.
  - Probe paths (`wp-admin`, `.php`, `.env`, `xmlrpc`) are tinted `#ff8a7a`.
  - With 30 days, keep the columns readable: thin bars and label every few days.
- **Compact**: the hits total, the top referrer, and mini columns.

## 05 Audience: devices · visitors (lines 330-383)
- **Data**: `traffic.byDevice`, `byBrowser`, `visitors[]`.
- **Stage**:
  - Two donut cards (conic-gradient, 150px, inset 18px) showing the top segment % in the center and a legend with counts. Use the top 4 plus `other`; palette orange / `#5d5648` / amber / green / `#b8ae98`.
  - Visitors table: VISITOR (short id; orange when there's an email), IP, CC, DEVICE, EMAIL, HITS, PAGES, LAST SEEN.
  - **Production addition**: clicking a visitor row shows that visitor's timeline from `GET /api/admin/traffic/visitor/:id`, in place, with a back control.
- **Compact**: two 84px donuts.

## 06 Top clicks (lines 385-415)
- **Data**: `traffic.topClicks[{path, tag, label, href, clicks, visitors}]`.
- **Stage**: table with PAGE, ELEMENT (label, or tag when empty), TARGET (href path, or `—`), CLICKS (6px bar ∝ max, plus the number), UV. The header shows `N total`.
- **Compact**: the top 6, each with a label, page, count and a 3px bar.

## 07 Bandwidth: egress (lines 417-464)
- **Data**: `egress.totalBytes`, `bySlug`, `rows` (routes), `assets` (drilldown via `?slug=`), `earliestDate`.
- **Stage**:
  - The total in MB.
  - An amber insight sentence: `{top} serves X% of all bytes from Y% of requests — Z per request.`
  - A 46px share bar: top 1 orange, top 2 amber, the rest `#5d5648` with a tooltip.
  - Two tables:
    - PROJECT: REQ, BYTES, /REQ; amber when ≥ 1 MB per request.
    - Routes: VERB (POST amber), ROUTE, REQ, BYTES, /REQ.
  - Clicking a project row shows its top files, where `_rest` reads "everything else".
  - Keep the existing empty states: "metering never ran" when `earliestDate === null`, and "no traffic in window".
- **Compact**: the total, an 8px share bar and the top 5 projects.

## Data reuse rules
- Reuse the existing endpoints only: `/api/admin/{observability,traffic,traffic/visitor/:id,sessions,sessions/:id,flows,egress,blog-cadence}`. Add no new endpoint.
- The WINDOW control drives `days` for traffic (1/7/30), sessions and flows (clamped to 30), and egress.
- Every fetch goes through `useAdminFetch` (`src/hooks/useAdmin.ts`), which uses Clerk bearer auth. The page stays admin-only: redirect non-admins to `/`.
- Each module renders its own loading state, error state and empty state. A failing source never blanks the whole page.
