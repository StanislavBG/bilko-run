# Validation sweep: ship-booking-page

PRD: `prds-archived/1601-ship-booking-page.md`. The PRD file was found. Base `668d7d3d`.
The plan's own commit is `414467d4` (the deploy record). The product commits were pushed from a throwaway tree.

## ship-booking-page — VERIFIED

Evidence per acceptance criterion:
1. Validation record gate: `validate-booking-page.md` has 10 PRD sections, all `VERIFIED`. The Critical and Important headings (lines 49 and 51) were checked with grep and hold no open findings.
2. Push scope: `git log d0377ebe..8ddcef09` on origin/main shows exactly 10 commits. They match the 10 listed in the deploy record (f3a5c9eb ... 8ddcef09). `git branch -r --contains 8ddcef09` lists origin/main, and its tip is 8ddcef09. `git remote get-url origin` is `https://github.com/StanislavBG/bilko-run.git`. The pushed range touches only shared/, src/, server/, tests/, e2e/, docs/ and index.html. No non-plan local-main commit is in the range.
3. test, typecheck and build: I did not re-run them (the throwaway tree is gone). The deploy record states 172 files and 1888 tests passed with 15 skipped, and typecheck and build passed. This rests on the record only.
4. Live checks, re-run by me:
   - `curl https://bilko.run/book` returns the string 'Bring your AI idea. Leave with a plan.' (grep count 1).
   - `/api/services/human-for-hire/slots` returns `"taken":[]`.
   - `/bilko` has its own `<h1>`.
   - `/tmp/ship-booking-page-live/book-1280x720.png` exists (91807 bytes). I did not open the image.
5. No booking, reschedule, cancel or Stripe click: nothing in the record shows one, and I cannot independently disprove it. Slots `taken` is empty, which fits.
6. Deploy record: `session-manager-operations/reviews/deploy/.../ship-booking-page.md` is committed in `414467d4`. It has the pushed SHA, the commit list, PST times, per-check PASS lines and `SHIP: PASS`.

Gate: `timeout 10 grep -q 'SHIP: PASS' <record>` passes. I read it directly: the line is the last line of the record.

## Combined diff
`git diff --stat 668d7d3d..HEAD` is a single docs file for this PRD. The product diff is already reviewed in `validate-booking-page.md`. I did not repeat the code review and security review.

## Findings
### Critical
None.
### Important
None.
### Minor
- `ship-booking-page.md` states criterion 3 (tests) with no captured output. Only the summary counts are given.
- The deploy record says the cherry-picked hashes differ from the local ones. It does not list the origin hashes. Reconstructing them requires `git log d0377ebe..8ddcef09`.
