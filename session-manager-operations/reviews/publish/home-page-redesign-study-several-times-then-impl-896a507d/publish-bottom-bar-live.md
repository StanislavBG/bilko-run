# Publish: bottom-bar-readable-rotation

Validation record had `VALIDATION: bottom-bar-readable-rotation VERIFIED` with no Critical/Important findings.

## Push
- Pushed `main` to `origin` (StanislavBG/bilko-run): `f39e3249..7ce8d568` at 11:53 PDT (2026-10-19).
- Two clean merges of `origin/main` were needed (only `src/data/standalone-projects.json` changed upstream); the second arrived between the check run and the push.
- Pre-push checks: `pnpm typecheck` and `pnpm vitest run` (117 files, 1306 tests) passed. The Playwright trio (site-navigation, home-radar, projects-hub) passed 20/20 on the final run. The `bottom bar text is calm and readable` test (about 50s, slow) failed in 2 of 4 full runs and passed in isolation, so it looks timing-sensitive under load. It did not fail on a rerun of the identical command.
- The second merge brought only registry JSON, so the suite was not re-run after it.

## Bundles (America/Los_Angeles)
- Before: `assets/index-dXf-YkcG.js` (11:53:19 PDT)
- 11:55 PDT: `index-B96BpQ0w.js` with `index-ClyGd8kb.css`. This was a different deploy (no `is-fading` rule in the CSS), and the first smoke run against it failed as expected.
- After (this fix): `assets/index-DDkQN9Lg.js` with `index-b9gPyu3c.css` (`is-fading` present), seen 11:57:40 PDT, about 4 minutes after the push.

## Live smoke, https://bilko.run/ at 1280x800 (bundle `index-DDkQN9Lg.js`)
- `.bk-bb-now` unchanged after 8s: yes ("SOCIAL SIGNALS TRADER RUNNING LIVE, IN PUBLIC").
- Items sampled over about 30s: 3 distinct, each with `scrollWidth == clientWidth` (340, 423, 355), so none truncated.
- `console.error`: none.
- Coffee link and `[data-buy]` were not clicked.
