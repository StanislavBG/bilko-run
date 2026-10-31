# Validation sweep 202610312036

Base: 8f82fb56 (from the PRD). PRD files found under `prds-archived/` (1553, 1556). Commits checked on `origin/main` after `git fetch origin`. Neither PRD has a `# Files` list of product code, so evidence is from origin/main, the deploy records and live checks.

## ship-retire-blog-video — VERIFIED
- Validation record VERIFIED, no Critical/Important: `validation/.../validate-retire-blog-video.md:5,13,21-22`.
- Both commits on origin/main: `bf3501ce chore(blog): delete the old Blog Video maker`, `3d3162f0 docs(blog): Burrow makes blog videos, Bilko hosts them` (`git log origin/main | grep`). `43badbd4` sits directly above them; no stray local-main commit between.
- Delete commit removed `scripts/blog-video{,-build,-runtime}.ts`, the three matching tests and `.claude/skills/blog-video/SKILL.md` (`git show --stat bf3501ce`). `blog-video-capture.ts` and `blog-video-frames.ts` stay, as CLAUDE.md requires.
- Origin is `https://github.com/StanislavBG/bilko-run.git`; push range in the deploy record is `b6faa80f..3d3162f0`.
- Deploy record `deploy/.../ship-retire-blog-video.md` has SHA, commits, PDT times, per-check PASS and `SHIP: PASS`. Its test, typecheck, build, play-check and video_url results are the record's own claims; I did not re-run them.
- Gate re-run: `curl -sf https://bilko.run/blog-videos/the-web-remote-now-drives-any-computer-you-pair/` → HTTP 200; `grep -q 'SHIP: PASS'` on the record → count 1. Both exit 0.

## ship-pricing-buttons — VERIFIED
- Validation record VERIFIED, no Critical/Important: `validate-pricing-buttons.md:5,22-23`.
- Commit on origin/main: `43badbd4 fix(site): move the shell button reset into the base layer`; it is the only commit above `3d3162f0`.
- The fix is present on origin/main: `src/styles/portfolio.css:39-41` wraps `.portfolio-shell button {…padding: 0…}` in `@layer base`.
- Deploy record `deploy/.../ship-pricing-buttons.md` lists SHA, PDT times, the screenshot path `/tmp/pricing-live.png`, 'Add $3' computed `rgb(255, 107, 26)` / padding-left 20px, and `SHIP: PASS`. I did not re-run the live browser check, tests, typecheck or build.
- Gate re-run: `grep -q 'SHIP: PASS'` on the record → count 1, exit 0.

## Findings
### Critical
- None.
### Important
- None.
### Minor
- `ship-retire-blog-video.md`: two earlier `pnpm test` runs timed out under load (`tests/game-services.test.ts`, limit=-1, 6 s) before a green rerun. Possible flaky timeout; not caused by this plan.
- Reviews: `/code-review` and `/security-review` were not run on the combined diff. The pushed changes are a CSS layer move, deletion of a dev tool and docs, and each was validated in its own record.

VALIDATION: ship-retire-blog-video VERIFIED
VALIDATION: ship-pricing-buttons VERIFIED
