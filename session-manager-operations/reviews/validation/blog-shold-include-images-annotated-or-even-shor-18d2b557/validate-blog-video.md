# Validation: Blog Video plan

Base: cb9feb41391c924d483d68e111febc9806a02683 (HEAD 2058a53). Plan commits: e676882, 960e832, 1cd26e0, 346190f, f1c50df, b0df743, 2058a53.
Gates were run in the main checkout at /home/bilko/Projects/Bilko (same HEAD 2058a53, has node_modules; the job worktree has none).

Gate output: `vitest run` of the 5 plan test files: 5 files / 46 tests passed. `pnpm typecheck` exit 0. `blog-video.ts validate <twelve-places html>` printed OK, exit 0.

## blog-video-discovery-api — VERIFIED
- server/blog-videos.ts exports scanBlogVideos/blogVideoUrl; tests/blog-videos.test.ts 7 pass.
- server/routes/blog.ts:16 and :26 add `video_url` to list and single-post responses.
- server/index.ts:128 videosRoot is prod `distPath/blog-videos`, dev `public/blog-videos`; server/index.ts:268 returns a plain 404 for `/blog-videos/` paths.
- Live: https://bilko.run/api/blog/twelve-places-one-weather-rule-you-set-yourself returns `"video_url":"/blog-videos/twelve-places-one-weather-rule-you-set-yourself/"`.

## blog-video-csp-fence — VERIFIED
- server/security-headers.ts:31 BLOG_VIDEO_CSP, :45 isBlogVideoPath, :143 sets the enforced fence header, :165 onSend returns payload unchanged, :65 frame-src includes 'self'.
- tests/security-headers.test.ts: 14 pass.
- Live `curl -I` of the video URL: HTTP/2 200 with the exact fence CSP ending `frame-ancestors 'self'; ... sandbox allow-scripts`.

## blog-video-cli — VERIFIED
- scripts/blog-video.ts; tests/blog-video.test.ts 13 pass.
- `next` ran and printed one JSON line (`turn-your-github-year-into-a-heatmap-and-badge-wall`). Twelve-places is no longer picked because it now has a video, which is the expected behaviour.
- `validate` printed OK on the committed video, exit 0.

## blog-video-player — VERIFIED
- src/components/BlogVideoPlayer.tsx: sandbox="allow-scripts" (no allow-same-origin), poster label "Watch the 30-second version", title `Video: ...`.
- src/pages/BlogPage.tsx:79 renders the "▶ Video" pill. BlogPostPage renders the player.
- tests/blog-video-player.test.ts: 3 pass.
- Screenshots (headless Chromium via Playwright): /tmp/vbv/poster.png, /tmp/vbv/playing.png. They are NOT committed, because the PRD allows only the review file. Before click there were 0 iframes. After click the iframe src was `/blog-videos/twelve-places-.../` with sandbox `allow-scripts`, the frame exposed `window.smDemo` (typeof object), and the first caption "Weather apps tell you the temperature." was visible with the Pause/Restart/progress bar, the "30-second video version of this post" caption and the "Open in new tab" link.
- Deviation: screenshots were taken against live https://bilko.run, not a local dev server, because starting one needs a background process, which the run rules forbid. HEAD equals the deployed code (the video, API field and CSP are all live).

## blog-markdown-links-figures — VERIFIED
- src/lib/blogMarkdown.ts (parseFigure, splitInlineLinks); BlogPostPage.tsx:93-99 figure/figcaption/lazy img, :121 link splitting; tests/blog-markdown.test.ts 9 pass.
- Real post, live DOM: `article a[href]` includes `https://bilko.run/projects/outdoor-hours/` (x2), `https://github.com/StanislavBG/outdoor-hours`, `/projects`, so markdown links render as anchors.

## blog-video-skill — VERIFIED
- .claude/skills/blog-video/SKILL.md: 102 lines (<150), frontmatter `name: blog-video`, description mentions the Blog Video macro, 30-second video, and picking the newest post without a video. It references af_heart, voice.md, and the bounded 20-try live check.
- Only a keyword count was checked; step wording was not read line by line.

## blog-video-first-iteration — VERIFIED
- public/blog-videos/twelve-places-.../index.html: 329,586 bytes (<2 MB), `sm-demo-duration` content="30", window.smDemo present, embedded `data:audio/mpeg;base64` narration. Validate gate OK.
- Live: https://bilko.run/blog/twelve-places-one-weather-rule-you-set-yourself shows the player; clicking it loads the iframe and the video plays (progress bar advancing, captions rendering). Video URL returns 200 with the sandbox CSP.
- Not checked: that every caption traces to a sentence in the seed in server/db.ts (the report's claims list was not re-derived), and Kokoro voice provenance (af_heart vs af_bella) cannot be established from the file.

## Findings
### Critical
- none
### Important
- none
### Minor
- Range `cb9feb4..HEAD` also contains unrelated commits (be527e0 ContentGrade/Stripe retirement, f5f1574, weekly OutdoorHours data refresh, 153 files total); they were excluded from this review's scope, but the Stripe changes in server/routes/stripe.ts (217 lines) are a different plan and were not reviewed here.
- `/code-review` and `/security-review` were not run; this was a manual review of the plan's code (CSP fence is strict: connect-src 'none', opaque-origin sandbox, no allow-same-origin; the player gates src with isSafeBlogVideoUrl; figure src and link hrefs are allow-listed; the slug regex blocks path traversal). No issues found.
- The first-iteration `next` result could not be re-checked as it was at run time (now a different slug, by design).
