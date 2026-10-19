# Validation sweep 202610191920 — publish-bottom-bar-live

Base: 7ce8d5688c7737cf8f42c127d8f23e044085aed8 (the pushed head; the publish record commit is 67be4729, after it, so `git log base..HEAD` is not the right window — evidence is taken from origin and the live site).

## publish-bottom-bar-live — VERIFIED

PRD: `prds-archived/1430-publish-bottom-bar-live.md`. No product code in scope; one file landed.

- AC1 (validation precondition): `validate-bottom-bar-readable.md:5` has `VALIDATION: bottom-bar-readable-rotation VERIFIED`; its Critical and Important sections (lines 19-22) both read "None."
- AC2 (merge, checks, push): `git merge-base --is-ancestor 7ce8d568 origin/main` exits 0, so the pushed head is on origin/main. The record states typecheck, vitest (1306 tests) and the Playwright trio all passed pre-push. I did not re-run them. Gate section (c) below covers the post-push state.
- AC3 (new bundle live): `curl https://bilko.run/` now serves `assets/index-DDkQN9Lg.js`, the same "after" bundle the record names. The record shows it differs from the "before" bundle `index-dXf-YkcG.js`.
- AC4 (live smoke): record lists `.bk-bb-now` unchanged after 8s, three items with scrollWidth == clientWidth, no console.error, no coffee/`[data-buy]` clicks. I did not repeat the live smoke. The unchanged-text claim also rests on the later deflaked e2e, which was verified separately.
- AC5 (record committed): `session-manager-operations/reviews/publish/.../publish-bottom-bar-live.md` is in commit 67be4729 (1 file, +20). It includes SHA range `f39e3249..7ce8d568`, bundle names with PDT times, and the smoke results.

Gate re-run (PRD `# Gate`):
- `git fetch origin main && git cat-file -e origin/main:<validate-bottom-bar-readable.md>` -> exit 0 (prints V_ON_ORIGIN).
- `curl -sf https://bilko.run/` -> exit 0.

## Findings

### Critical
- None.
### Important
- None.
### Minor
- `publish-bottom-bar-live.md` (the record): the "bottom bar text is calm and readable" Playwright test failed in 2 of 4 full runs before the push, and the second origin/main merge was not followed by a re-run. The record discloses both. The test was later rewritten with `page.clock` (b4395c56, validated in `validate-deflake-bottom-bar-e2e.md`), which addresses the flake.
- The live smoke covers only `/` at 1280x800; `/contact` and the 1440 width are covered by e2e only.
- I did not run `/code-review` or `/security-review`; the plan's diff is a docs-only record, reviewed by reading it. It has no secrets or unsafe input.
