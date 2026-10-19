# Validation: deflake-bottom-bar-e2e (1431)

Base: 3a156be6 (known). Commit: b4395c56 — `git diff --stat` touches only `e2e/site-navigation.spec.ts` (60+/38-); `src/` diff empty.

VALIDATION: deflake-bottom-bar-e2e VERIFIED

## Criteria evidence
- Same behaviour checked: `e2e/site-navigation.spec.ts:112` (unchanged at 6s, changed after 13s), `:121` (hover, 30s unchanged), `:130` (reducedMotion, 30s unchanged), `:140-165` (scrollWidth <= clientWidth, bar 52px, all 4 items, 1280/1440 x `/`,`/contact`).
- No wall-clock: `page.clock.install({time:0})` + `pauseAt` before `goto` (`openHomeWithClock`, and in the width tests); time moves via `fastForward`/`runFor`; no `waitForTimeout` in the diff. Post-step assertions use auto-retrying `expect(now).toHaveText/not.toHaveText`.
- Split: 7 tests (3 behaviour + 4 width/path); slowest in the run was 7.2s (<15s).
- Gate: `pnpm typecheck` exit 0; `playwright test site-navigation home-radar projects-hub --repeat-each=5` → `130 passed (1.7m)` (stricter than the PRD gate's x3). :3002 was free beforehand.
- `src/` untouched: confirmed.

## Findings
### Critical
- none
### Important
- none
### Minor
- `e2e/site-navigation.spec.ts:112-135`: the "unchanged" assertions (`toHaveText(first)`) pass immediately, so they can't prove a late swap didn't occur; mitigated by the `runFor(NOW_FADE_MS+100)` before them. Acceptable.
- Self-review (no secrets, no input handling, no helper duplication): nothing to report. 5 consecutive green runs is evidence of de-flaking, not proof.
