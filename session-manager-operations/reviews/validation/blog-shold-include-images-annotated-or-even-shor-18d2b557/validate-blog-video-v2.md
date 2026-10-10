# Validation: blog-video v2 plan

Base: 4ec00f0eb79b30224bdd2c29770164ce42409d7a (commits 06ef179..6343f8f). PRD files found under `prds-archived/` (1168-1175).
Gates re-run in the worktree (node_modules symlinked from the main checkout, gitignored):
`pnpm vitest run` on the 5 blog-video test files -> 5 files, 70 tests pass; `pnpm typecheck` -> exit 0;
`blog-video.ts validate --post` -> OK for both videos; `blog-video-frames.ts` -> exit 0 (25 frames each).
Contact sheets: /tmp/bv-frames-twelve-places/contact.jpg, /tmp/bv-frames-github-heatmap/contact.jpg (viewed).

## blog-video-runtime — VERIFIED
- scripts/blog-video-runtime.ts exists (311 lines) with renderVideoHtml/focusTransform; tests/blog-video-runtime.test.ts 10 tests pass.
- Both built videos carry `sm-demo-duration`, the voice meta and claims JSON (validator OK); both share the warm-dark stage, orange accent, bottom control strip (visible in contact sheets).

## blog-video-capture-clips — VERIFIED
- `isAllowedNavigation(url, isNavigation)` at scripts/blog-video-capture.ts:85 returns true for non-navigations, else checks ALLOWED_ORIGINS.
- Route handler at :226-228 aborts off-list navigation requests; final page origin re-checked at :250 before save. Redirect/click navigation off-list is aborted (route covers all document requests incl. redirects). Unit tests (15) pass, including evil.test navigation false / image subresource true and record.seconds 0/7 rejected, 3 accepted.

## blog-video-validator-v2 — VERIFIED
- tests/blog-video.test.ts 22 tests pass (4 MB cap, voice meta, grounded/paraphrased/link-stripped claims). Both videos validate with `--post`.

## blog-video-frames — VERIFIED
- scripts/blog-video-frames.ts ran on both videos, exit 0, wrote contact.jpg + frames.json; 6 unit tests pass.

## blog-video-builder — VERIFIED
- scripts/blog-video-build.ts (200 lines); 17 tests pass (parse rules, e2e build, ungrounded source refused). Output videos are consistent with builder runtime.

## blog-video-skill-v2 — VERIFIED
- No `server/db.ts` reference remains (grep); Ground step uses content/blog + standalone-projects.json (SKILL.md:33); Story spine at :38; `record: {seconds}` for moments (:59-61); Kokoro/narrationSeconds (:87); build step :94; review rubric + 2-round cap :118-128; report includes contact sheet path (:174).

## blog-video-v2-twelve-places — VERIFIED (with Minor findings)
- File 1.1 MB, 2 `data:video/mp4` occurrences, validates with --post, frames exit 0.
- Live: https://bilko.run/blog-videos/twelve-places-one-weather-rule-you-set-yourself/ -> 200, 1,117,318 bytes (identical to local), contains data:video/mp4.
- Rubric: no blank frames; motion shown for "Build your own rule with seven dials" (dial/sliders) and ranking; callouts point at relevant regions. Defects: closing URL wraps mid-word ("outdoor-h / ours/"); 20.5-23 s clip frame has page headline cut at top ("better?"), plausible captured-scroll artifact.

## blog-video-v2-github-heatmap — REFUTED — live URL still serves the old v1 file
- Local file 751,057 B, 2 data:video/mp4, validates, frames exit 0; commit 6343f8f is on origin/main (`git branch -r --contains`).
- Live check (4 tries over ~90 s, plus an earlier fetch): https://bilko.run/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/ returns 200 but 730,941 B with 0 `data:video/mp4` (light-theme v1 with audio and 4 jpegs). The AC requires the live page to contain data:video/mp4; /api/health uptime ~13 min suggests the service restarted around the push, so this may be deploy/cache lag — re-check before treating as final.
- Contact sheet: same visual system as twelve-places; no blank frames; closing URL wraps mid-word ("git-viewe / r/"); "No code needed" callout at 23.75-24.25 s sits over the stats cards, not the Tweaks panel it summarizes (callout pointing at wrong thing).

## Findings
### Critical
- none
### Important
- public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html: live URL serves stale v1 (no video clips) despite commit 6343f8f on origin/main.
### Minor
- Both videos: closing scene breaks the URL mid-word (runtime closing layout, scripts/blog-video-runtime.ts) — violates the skill's "no text cut mid-word" rubric; also repeats URL twice.
- Heatmap 23-25 s: callout "No code needed" not anchored to the Tweaks panel.
- twelve-places 20-23 s: clipped headline at top of clip frame.
- Skill rubric is applied by the producer agent, not enforced by frames.ts (blank-only automated check).
- Review of combined diff: no secrets, no path traversal seen; capture URLs allow-listed; build reads only given paths.
