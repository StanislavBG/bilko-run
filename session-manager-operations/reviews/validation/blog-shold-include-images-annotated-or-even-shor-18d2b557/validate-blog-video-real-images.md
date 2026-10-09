# Validation: blog-video real images plan

Base: f6c830b41387627d97916c1af828bf4c1472dae1. All four PRD files were found in `prds-archived/`.
Commits: e438855 (capture script), 0ea8d7a (skill), 70fd69f (OutdoorHours video), cc2ebef (git-viewer video).

## blog-video-capture — VERIFIED
- `parseShotList` (scripts/blog-video-capture.ts:81-110) enforces:
  - at most 6 shots and 5 actions per shot;
  - the name regex `/^[a-z0-9-]{1,40}$/`;
  - waitMs and wait capped at 10000.
- URL check (`checkUrl`, :36-49) uses `new URL(...).origin` against the set {https://bilko.run, https://github.com}, and rejects credentials. http://, other hosts and `user:pass@` URLs are all rejected. Parsing with `URL` (not a string-prefix check) defeats lookalikes such as `https://bilko.run.evil.com` and `https://bilko.run@evil.com`.
- `qualitySteps` (:113) returns [80,70,60,50,40]. The CLI fails the shot with exit 1 if q40 is still over the cap (:187-191). The browser closes in `finally`. Viewport is 1280x720, scale 1, light colour scheme; goto has a 30 s timeout with a networkidle→load fallback; each action has a 10 s timeout. Matches the PRD.
- Gate re-run: `pnpm vitest run tests/blog-video-capture.test.ts` → 10/10 pass. `pnpm typecheck` → clean. (A `node_modules` symlink to the main checkout was needed in the worktree and was not committed.)
- Allow-list bypass: the up-front allow-list cannot be bypassed with a crafted shot URL. There is a residual gap at runtime — see Important finding 1.

## blog-video-skill-real-images — VERIFIED
- The `## 4. Capture` step sits between Storyboard and Build (SKILL.md:52-66). It describes the shot list, the capture CLI invocation, and viewing each image to drop error, blank, loading and sign-in captures.
- The storyboard is rewritten around Ken Burns pan/zoom, highlight boxes and a callout of ≤12 words; shapes are the fallback for a dropped capture (:45-46).
- Rules (:93-96) cover real captures only, `data:image/jpeg;base64` embedding, and 1280x720 annotation coordinates.
- Budget line (:81) says images ≤ 1.2 MB, 5 shots at most, plus narration, under the 2 MB cap.
- Report section (:128) lists the shot list and dropped captures.
- The file is 130 lines, under the ~150 limit.

## blog-video-regen-twelve-places — VERIFIED
- Gate: `blog-video.ts validate` printed OK. The file contains 5 `data:image/jpeg;base64` images (960 KB total), `sm-demo-duration` 30, `window.smDemo`, and an embedded mp3.
- Extracted JPEGs, 1280x720 and 78-111 KB each; I viewed 3 of the 5 (twelve-p-0, -2, -4):
  - the OutdoorHours "Where is the weather actually better?" hero with real KOUT·7 data (184 vs 149 hours);
  - the 12-county ranking table;
  - the compare-counties and rule panel.
  All are real OutdoorHours pages, with no error, blank or sign-in screens. The other 2 images were not viewed.
- Live: https://bilko.run/blog-videos/twelve-places-one-weather-rule-you-set-yourself/ returned 200 with 5 `data:image/jpeg` occurrences, and `/api/blog/<slug>` has `video_url` set. The post page's play button mounted the iframe.
- Live seek screenshots from `smDemo.seek` at:
  - 4 s: the title card "Weather apps tell you the temperature."
  - 14 s: a real screenshot with the rule-editor panel highlighted and the callout "A custom rule has seven dials."
  - 26 s: a real screenshot with the quick-take highlighted and the callout "One sentence: who wins, who comes last."

## blog-video-github-heatmap — VERIFIED
- Gate: `validate` printed OK. The file contains 4 JPEGs (731 KB total), `sm-demo-duration` 30, and `window.smDemo`.
- `blog-video.ts next` now returns a different post (`a-space-shooter-shrank-66-percent...`), which is expected because the heatmap post has a video. The pick before the change was not re-verifiable from here.
- Extracted JPEGs: I viewed 3 of the 4 (turn-you-0, -2, -3):
  - the git-viewer activity heatmap with its GRID/EXTRUDED/RADIAL toggle;
  - the git-viewer overview;
  - the real GitHub repo page for StanislavBG/git-viewer.
  No error or rate-limit screens. The 4th image (turn-you-1) was not viewed.
- Live: the page returned 200 with 4 JPEGs, and the API `video_url` is set.
- Live seeks at 6.5 s, 19 s and 28 s:
  - 6.5 s: the card "One flat green grid."
  - 19 s: a highlighted Languages panel with the callout "The languages you actually touched".
  - 28 s: the dimmed repo screenshot with the full https://bilko.run/projects/git-viewer/ link.
- Seeking to exactly 4 s and 26 s showed blank cream frames. `render()` fades each scene in from opacity 0 at its start boundary (p=0), so it is not a defect in normal playback. See Minor 2.

## Combined diff review
The diff has 18 files; the unrelated server/analytics/egress/manual changes come from other plans merged in the same range and are out of this plan's scope. The two videos are self-contained HTML with no network references. No secrets and no path-traversal surface were found; the capture script writes only `<out>/<name>.jpg`, and names are regex-restricted. `/code-review` and `/security-review` were not run as separate tools in this session; I self-reviewed instead.

## Findings
### Critical
- None.

### Important
1. scripts/blog-video-capture.ts:152-156 — the post-navigation origin check runs after the page has loaded.
   - A redirect to an off-list host from an allowed origin would already have been fetched and rendered. `shot.actions` clicks (:164) can also navigate off-list, and the final origin is not re-checked before the screenshot.
   - Practical risk is low, since only the site's own pages and GitHub are targeted. Fix: `context.route` / `page.on('request')` to abort top-level navigations off the allow-list, plus a re-check after the actions.

### Minor
1. Narration voice (af_heart/af_bella) cannot be verified from either HTML file. They embed an mp3 only and carry no voice marker; the acceptance criteria require this per PRD.
2. The scenes in both videos start at opacity 0 at each boundary, so seeking exactly to a scene start shows a blank frame. It is cosmetic, but it can confuse seek-based checks.
3. `qualitySteps(_maxBytes)` ignores its argument, so the signature suggests behaviour it does not have. This is harmless.
