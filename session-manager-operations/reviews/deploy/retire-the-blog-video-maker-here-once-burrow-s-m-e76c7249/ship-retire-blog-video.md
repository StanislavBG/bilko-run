# Ship: retire-blog-video

Pushed SHA (origin/main HEAD): 3d3162f07adc82af653856ba15497e12286e5123
Push time: 2026-10-31 13:01:59 PDT. Play check: 2026-10-31 13:05 PDT.
Pushed range: b6faa80f..3d3162f0 to origin (StanislavBG/bilko-run) only.

Commits pushed (cherry-picked onto origin/main in a throwaway tree; ea717f21 and other local-main commits not pushed):
- bf3501ce `chore(blog): delete the old Blog Video maker` (was 30ff1b82)
- 3d3162f0 `docs(blog): Burrow makes blog videos, Bilko hosts them` (was 2fb14349)

Checks:
- Validation record: VERIFIED for both PRDs, no Critical/Important: PASS
- Cherry-pick: PASS. One conflict, the CLAUDE.md `tests (counted via` line; kept the origin/main version (169 files, 1912 tests) as the PRD allows.
- `pnpm test`: PASS (164 passed, 2 skipped files; 1837 passed, 20 skipped). Two earlier runs hit load-induced timeouts (tests/game-services.test.ts limit=-1, 6 s); that file passes alone and the full rerun exited 0.
- `pnpm typecheck`: PASS
- `pnpm build`: PASS
- Push to origin only: PASS
- Deploy: confirmed. /api/health uptime reset to 61 s about 185 s after the push.
- Play check: PASS. Headless Chromium opened /blog/the-web-remote-now-drives-any-computer-you-pair, clicked play, found `typeof window.smDemo.seek === 'function'` in the video frame.
- API video_url: PASS, `/blog-videos/the-web-remote-now-drives-any-computer-you-pair/`

SHIP: PASS
