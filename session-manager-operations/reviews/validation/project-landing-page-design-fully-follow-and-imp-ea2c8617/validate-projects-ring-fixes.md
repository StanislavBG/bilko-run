# Validation: projects ring fix wave

Base: 42e1734 (HEAD 54adc14). PRD files read from `prds-archived/`. Commits: 9af8e94 (1334), a13d1e2 + merge 54adc14 (1335). 1336 has no code of its own.
Worktree had no node_modules; I symlinked the main tree's (untracked, not committed) to run the gates.

## projects-ring-outline-fix (1334) — VERIFIED
- `src/styles/projects-ring.css`: `.pr-nav`, `.pr-spine`, `.pr-btn`, `.pr-btn-primary` and their `:hover`, `.pr-tick`, `.pr-tick:hover`, reduced-motion and max-width:900px `.pr-spine` overrides are all prefixed `.pr-page ` (git diff 42e1734..HEAD). The only `!important` is the pre-existing `.pr-tick:hover` one. `portfolio.css` not in the diff.
- `.pr-page` wrapper exists at `src/pages/ProjectsPage.tsx:245`. No admin toggle button has pr- styling.
- `e2e/projects-hub.spec.ts:58-84`: new test asserts spine 1px / rgb(42, 36, 28) / rgb(237, 230, 214), nav 1px border, `.pr-btn-primary` rgb(26, 22, 18), Full story 1px border, at 1440x900.
- Gate: `pnpm build` exit 0. `playwright test e2e/projects-hub.spec.ts` → 4 passed.

## projects-ring-fill-space (1335) — VERIFIED
- `src/data/projectsRing.ts:38-70`: `sideScale()` helper and optional `n`. Side counts are right = min(29, floor(n/2)) and left = min(29, n-1-floor(n/2)). Available width = heroLeft - 8 - 8. The scale applies only when natural < available. With `n` omitted, scale = 1, so output is unchanged.
- `src/pages/ProjectsPage.tsx:273`: the only change in that file passes `n`.
- `tests/projects-ring.test.ts:76-110`: new tests cover n=7 both sides, heights/opacity/font unchanged, n=140 identical to the no-n call, and n=2 with no left spine and finite values.
- Gate: `vitest run tests/projects-ring.test.ts tests/projects-view.test.ts` → 26 passed. `pnpm typecheck` exit 0.

## projects-ring-fixes-publish (1336) — VERIFIED (one criterion partly met)
- Ring files (css, projectsRing.ts, ProjectsPage.tsx, e2e, tests) are byte-identical between HEAD and origin/main. `origin/main` contains 46deab7 (outline) and c35c41b (fill), the rebased equivalents of 9af8e94 and a13d1e2.
- Gate: `pnpm exec tsx scripts/verify-live-marker.ts '.pr-page .pr-spine'` → "OK: marker found in /assets/index-Bpl6i_UU.css (try 1/20)", exit 0.
- Live screenshot of https://bilko.run/projects at 1440x900 (/tmp/projects-ring-live-validate.png), which I read. Three outlined, filled, paper-coloured spines (Launch Kit, Weather, Family Frame) fill the left from x≈8 to the hero edge. Four spines (Social Signals Trader, Escape Velocity, Academy, Git Viewer) fill the right out to x≈1432. The ←/→ nav boxes, the Full story outline and the dark Open button are all rendered. This matches the bug fix.
- Not met: "`git status -sb` shows main not ahead of origin/main". Local `main` is 10 ahead / 12 behind origin/main (rebased duplicates never reconciled). The content is live and identical; the branch topology is not. See Minor 1.

## Findings
### Critical
- none
### Important
- none
### Minor
1. Local `main` has diverged from `origin/main` (10 ahead / 12 behind, rebased duplicates such as 54adc14 vs c35c41b). The 1336 reconciliation criterion was not literally satisfied. A future `git pull` on local main will need a rebase or reset, so someone should reconcile deliberately.
2. `scripts/verify-live-marker.ts` is listed in 1336's Files but was unchanged in this wave (it landed earlier in 0ef575e). That is expected, since the PRD said no code change.
3. The e2e screenshot path `/tmp/projects-ring-outlines.png` is written from inside the spec, so every spec run writes to /tmp. This is harmless but slightly unusual.
4. Code and security self-review of the combined diff (5 files, +103/-15): pure CSS selectors, numeric geometry, and tests. No input handling, secrets, paths or duplicated helpers. No findings.
