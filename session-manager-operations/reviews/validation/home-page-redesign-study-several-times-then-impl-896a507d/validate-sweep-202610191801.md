# Validation sweep: publish-home-radar-live-v2

Base: 4452731821495c6eee7a57c10fb11abed0c2e0ea. PRD file: `epics/home-page-redesign-study-several-times-then-impl-896a507d/prds-archived/1426-publish-home-radar-live-v2.md`. Its `# Files` is only the publish record, so the commit list is `3e0b5197 docs(publish): home radar pause + nav live on bilko.run`.

## publish-home-radar-live-v2 — VERIFIED

Gate: the PRD's gate was a fetch plus `cat-file` of the validation record on origin/main, and a `curl` of bilko.run. I re-ran the equivalent checks and both passed.

| Criterion | Evidence |
|---|---|
| Validation record clean before push | `validate-home-radar-pause-nav.md:16,25` contain both `VERIFIED` sentinels. Its Critical and Important sections read "None." |
| Checks run, then fast-forward push | The publish record gives `c9eaa8e0..44527318` and typecheck, vitest (1306 tests) and Playwright (19) passing. `git log c9eaa8e0..44527318` shows the pushed commits. `git merge-base --is-ancestor 3e0b5197 origin/main` succeeds, so the work is on origin/main. I did not re-run the typecheck, vitest or Playwright suites. |
| New bundle live | The record says `index-CLT5F1aq.js` changed to `index-DCoNS41Q.js`. I fetched https://bilko.run/ and it now serves `assets/index-DCoNS41Q.js`. |
| Live smoke passes | My own re-run against https://bilko.run: `Make. Ship.` visible, `[data-radar-sweep]` and `.hr-readout` present, `/contact` has `.bk-bottombar`, and 0 console errors. I did not re-test the hover-pause, the key `1` navigation or the Back behaviour; those rest on the publish record. |
| Publish record committed | `publish-home-radar-live.md` exists in `3e0b5197` and on origin/main. It has the SHA range, bundle names with PDT times and each smoke result. |

## Findings

### Critical
None.

### Important
None.

### Minor
- The publish record's "Bundle before" and "After" times are given as minute-level approximations (10:56 AM and 10:58 AM PDT). That is acceptable but imprecise.
- Carried over from `validate-home-radar-pause-nav.md`: `onMouseLeave` clears `paused` while keyboard focus is still inside the readout. The e2e pause test also depends on layout (`e2e/home-radar.spec.ts:122`).
- No secrets, unsafe input handling or path traversal. The publish commit adds one Markdown file only.
