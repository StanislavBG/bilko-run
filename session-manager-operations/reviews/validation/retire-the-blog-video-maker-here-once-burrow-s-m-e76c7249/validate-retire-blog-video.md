# Validation: retire-blog-video-maker, retire-blog-video-docs

Base: ea717f21863b85d9785cfcd4f03ac4f3f6556bc3. Commits: 30ff1b82 `chore(blog): delete the old Blog Video maker`, 2fb14349 `docs(blog): Burrow makes blog videos, Bilko hosts them`. Both PRD files found under prds-archived/ (1550, 1551).

## retire-blog-video-maker — VERIFIED
- Seven deleted paths absent: loop over `test -e` printed nothing; `git diff --stat` shows all deleted.
- Kept scripts: scripts/blog-video-capture.ts:1-3 and blog-video-frames.ts:2 carry the exact header text; diff touches only comments (+5/-2, +1); no mention of the skill.
- Kept tests and hosting: `git diff base..HEAD --stat` over server/, src/components/, public/blog-videos/, and the four kept tests is empty.
- `pnpm vitest run`: 164 files passed, 2 skipped; 1850 passed, 20 skipped. `pnpm typecheck`: no errors.
- frames run on the-web-remote… video: "25 frames, contact sheet" and contact.jpg non-empty. capture run on https://bilko.run/projects: home.jpg 85726 bytes.
- Commit subject exact.

## retire-blog-video-docs — VERIFIED
- images.md:19-23 matches the notes (actions shape, max 6 shots, max 5 actions, no SKILL.md pointer).
- CLAUDE.md `## Blog` (end of file) has the new paragraph right after the existing one.
- CLAUDE.md `## Testing`: "166 files, 1870 tests (1850 pass, 20 skipped…) 2026-10-31" equals my fresh run (166 / 1870).
- Gate: `git grep` for the deleted pointers outside session-manager-operations/ and public/blog-videos: clean. Both greps in gate 2 pass.
- Commit subject exact.

## Findings
- Critical: none.
- Important: none.
- Minor: the test-count line includes skipped tests in its totals (stated on the line). CLAUDE.md:183. Not a defect.
- Review: the diff is deletions, comments and docs only. No new code, input handling or secrets. Self-review used.
