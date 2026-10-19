# Validation: home-radar-pause-on-readout + site-navigation-consistency

Base: 4e2fa3a6. Commits: 61291c71 (1422), 8b8b01e1 (1423). Port :3002 was free before the Playwright run.
Gates re-run in foreground: `pnpm vitest run tests/home-radar.test.ts` (12/12 pass), `pnpm typecheck` (exit 0),
`playwright test e2e/site-navigation.spec.ts e2e/home-radar.spec.ts e2e/projects-hub.spec.ts` (19/19 pass).
The `/code-review` and `/security-review` skills were not run; I reviewed the diff by hand.

## home-radar-pause-on-readout
- Props `paused`/`highlightId` added: RadarDial.tsx:13-14; `data-radar-sweep` on the sweep element RadarDial.tsx:187. `paused` sets target = current angle (RadarDial.tsx:72), so the sweep is held.
- `highlightId` resolves the item (RadarDial.tsx:69-70), targets its bearing (RadarDial.tsx:75) and goes through the existing `focus` path, so the ring, label and `Locked · <lab>` mode pill are unchanged (RadarDial.tsx:96). The pill text is confirmed by the e2e test.
- HomePage.tsx: `.hr-readout` has onMouseEnter/Leave and onFocus/onBlur. Blur only clears the pause when focus leaves the readout, via `contains(relatedTarget)`. Items have onMouseEnter/Leave that set and clear `highlight`. `lock` is not set on hover.
- e2e `radar pauses while the readout is hovered` (home-radar.spec.ts:122): transform is identical after 1500ms, the sector name is unchanged, `Locked ·` is shown on item hover, and the sweep resumes on h1 hover. It passes.
- Reduced-motion `park` logic is untouched (`target === null && reduced`). Because `paused` now sets a non-null target, parking does not apply while paused, which is harmless.
- Only the 3 permitted files changed. Gate green.

VALIDATION: home-radar-pause-on-readout VERIFIED

## site-navigation-consistency
- `e2e/site-navigation.spec.ts` has 4 tests: pills and brand from every page, active pill, flip and Back agree, bottom bar consistent. All pass.
- No `fixme` or `skip` in site-navigation, home-radar or projects-hub specs (grep exit 1, no matches).
- `git log 4e2fa3a6..HEAD -- src/pages/ProjectsPage.tsx src/pages/ContactPage.tsx src/pages/BlogPage.tsx` is empty.
- The 1423 commit touched only the spec file (`--stat`: 4 files in total across both PRDs). The tests passed without any fixes to Layout.tsx, BookFlip.tsx or HomePage.tsx, which is consistent with the PRD.
- Gate green (typecheck, 19/19 Playwright).

VALIDATION: site-navigation-consistency VERIFIED

## Findings

### Critical
None.

### Important
None.

### Minor
- HomePage.tsx (readout wrapper): `onMouseLeave` clears `paused` even if keyboard focus is still inside the readout, so the sweep resumes while focus remains. The PRD wording ("pointer or focus inside") is only partly honoured in that case. The e2e test does not cover it.
- e2e/home-radar.spec.ts:122: the pause test hovers the readout top edge at (20,4) so it avoids the items. The test depends on layout and could break if the readout padding changes.
- No input handling, secret or path concerns in the diff (client-only UI state, no new helpers duplicated).
