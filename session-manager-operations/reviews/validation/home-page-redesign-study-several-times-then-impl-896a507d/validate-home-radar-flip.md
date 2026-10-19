# Validation: Home Radar Flip plan (PRDs 1408–1416)

Base: 15f2885e027e445f451143c919450d69b46acfc5 → HEAD 9fc7736e. Combined diff: 14 files, +1715/−315.
Gates re-run in the foreground: `pnpm typecheck` exit 0; `vitest run tests/home-radar.test.ts` 11/11 pass;
`playwright test e2e/home-radar.spec.ts e2e/projects-hub.spec.ts` → 11 passed, 1 skipped (`test.fixme`). Port 3002 was free before the run.
`git diff Base..HEAD -- src/pages/ProjectsPage.tsx src/pages/ContactPage.tsx` is empty (both unchanged).
Not independently run: pixel/computed-style comparison against the prototype (pass 1/2) and mid-flip frames at 475ms; those rest on CSS/code reading plus the passing e2e.

## 1408 home-radar-model — VERIFIED
- All 12 exports present, `src/data/homeRadar.ts:7-116`. Caps 8/5/3: `:34-35`, channels fixed list of 3.
- Dest routing: projects `url: href, spa: p.isInternal` (`:56`), posts `/blog/<slug>` spa true (`:70`), channels `dest: null` (`:81`).
- `radarSize` clamps 260..520, `showReadout = vw >= 1180` (`:113-116`); `sectorIndexAt` 180/270 boundaries (`:104`); `stepSweep` wrap (`:108`).
- Gate: vitest 11/11, typecheck 0.

## 1409 site-chrome-radar-header-bottom-bar — VERIFIED
- `Layout.tsx`: `data-home-flip` on nav pills (`:64`), Online (`:75`), Menu (`:100-102`), `.bk-bottombar` (`:138`), `Currently →` (`:140`), 5000ms rotation (`:30`), hint link (`:145`), `tip-coffee` + `trackFlow` (`:158`).
- `site-chrome.css` imported at `src/index.css:4`; `index.html:29` loads Source Serif 4 / Inter Tight / JetBrains Mono.
- ProjectsPage.tsx / ContactPage.tsx unchanged since Base. projects-hub.spec passes (4/4) and "same chrome" test asserts `/projects` fits 1440x900.

## 1410 home-book-flip — VERIFIED
- `BookFlip.tsx`: `FLIP_MS = 950` (`:18`), reduced-motion / <900px immediate navigate (`:69-70`), `bk-flip-out` (`:76`), reset sequence with reflow + rAF (`:23-27`), `pageshow` listener (`:52`), `createPortal`, `aria-hidden`, `inset:0; zIndex:0` (`:122-131`), bar `width 1.6s` (`:294`).
- Gate: typecheck 0.

## 1411 home-radar-flip-design-doc — VERIFIED
- `cmp` of `docs/design/home-radar-flip/Home Radar Flip.dc.html` vs the designs-dir original: identical. support.js not committed (`git ls-files` lists only the html + README).
- README has Overview/Fidelity/Layout/Interactions/Motion/Responsive/Production decisions; records flipStyle `book`, navigate true (`README.md:96`).

## 1412 home-radar-dial — VERIFIED
- `RadarDial.tsx`: sweep via ref + `stepSweep` in rAF (`:64-103`), `cancelAnimationFrame` on cleanup (`:106`), period clamp 4..16 (`:64`), mode strings `Auto sweep` / `Exploring · NNN°` / `Locked · <label>` (`:91-92`), blips `preventDefault` + `onFlip` (`:198-200`), empty-space click uses `FLIP_DESTS[sectorIndexAt]` (`:128`), reduced-motion parking (`:72`) and transitions off (`:138`).
- Gate: typecheck 0, vitest 11/11.

## 1413 home-page-radar-flip — VERIFIED
- `HomePage.tsx`: `hub-route` add/remove (`:44-45`), blog fetch (`:50`), `deltaY <= 24` guard (`:89`), keys 1/2/3, ArrowDown/PageDown, input/contenteditable and Ctrl/Meta/Alt guards (`:77-81`), capture `[data-home-flip]` interception (`:94`), crosshair readout (`:120`), `onLock`/`onUnlock` (`:167-168`), `radarSize` (`:30`); `Ticker` no longer referenced (0 hits).
- Note: `home-radar.css` is imported from HomePage.tsx rather than `src/index.css` (index.css was permitted, not required) — harmless.
- Gate: typecheck, vitest, projects-hub.spec all green.

## 1414 home-radar-e2e — REFUTED — `back returns to an un-flipped home` is `test.fixme` (e2e/home-radar.spec.ts:70)
- 5 of 6 required tests pass (wheel/keys, project blip, channel blips, same chrome, reduced motion + mobile; `:29,48,61,81,101,109`).
- The back-navigation test is skipped with a comment naming a real product bug (`:67-69`): after flipping Home → /projects, `goBack()` reaches `/` briefly, then the Projects `?p=` URL sync rewrites the URL to `/projects?p=session-manager` and traps the user on /projects. The PRD forbids leaving a fixme without a reported follow-up; I found no queued PRD or doc referencing this bug (grep over scheduler epics matched only the 1414 PRD itself), so a follow-up was not verifiably filed. Criterion 4 therefore does not hold.

## 1415 home-radar-parity-pass-1 — VERIFIED (partly by inference)
- Commit 8259686d touches HomePage/home-radar.css/RadarDial/site-chrome.css only (in scope). e2e gate green. I did not re-measure `getBoundingClientRect` / `getComputedStyle` against the prototype; the report-listing criteria are not checkable from the tree.

## 1416 home-radar-parity-pass-2 — VERIFIED (partly by inference)
- `site-chrome.css:101-102`: `rotateY(-104deg)` with stage-centred perspective origin shifted by 50vw; `bk-flip-reset` suppresses transitions (`:106-107`); mobile rule at `:71`, `home-radar.css:78`. e2e gate green incl. mobile no-overflow and "same chrome" test.
- Mid-flip frame at 475ms and 1280x800 / 1024x768 fit were not re-captured here.

## Findings
### Critical
- none
### Important
- `e2e/home-radar.spec.ts:70` — back-button trap after the flip (Projects `?p=` sync rewrites history); real user-facing bug, test skipped, no follow-up evidence. Needs a fix PRD against the Projects URL sync (note: PRD scope said Projects page content stays unchanged — fix should be in URL-sync logic only) and the fixme removed.
### Minor
- An empty untracked file literally named `<path>` exists at the worktree root (created 08:12, not tracked, not part of the plan's commits); likely a stray tool artifact.
- `home-radar.css` imported from `HomePage.tsx`, not `src/index.css` as the 1413 file list implied.
