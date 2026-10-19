---
title: Blog video runtime: one shared, polished player template for every video
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-10T02:01:00.851Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1qzmib-d18503
---
# Goal

Primitive: today each blog video is hand-written HTML, so the two live videos differ in controls, caption style and pacing, and both have blank frames between scenes and Ken Burns crops that cut headlines mid-word. Build one deterministic HTML/JS runtime that turns a resolved scene spec (real screenshots/clips as data URIs + captions) into a polished, consistent video, so the agent only authors the story.

# Acceptance criteria

- [ ] New scripts/blog-video-runtime.ts exports types `SceneType = 'title' | 'text' | 'screen' | 'closing'`, `Rect = {x,y,w,h}` (1280x720 capture space), `ResolvedScene = { id: string; type: SceneType; start: number; duration: number; caption: string; callout?: string; focus?: Rect; asset?: { kind: 'image' | 'video'; dataUri: string } }`, `ResolvedSpec = { slug; title; projectName; projectUrl; voice: string; durationS: number; audioDataUri?: string; scenes: ResolvedScene[]; claims: Array<{ sceneId: string; source: string }> }` and `renderVideoHtml(spec: ResolvedSpec): string`.
- [ ] scripts/blog-video-runtime.ts exports pure `focusTransform(focus: Rect, progress: number): { scale: number; tx: number; ty: number }` easing (easeInOutCubic) from the full 1280x720 frame at progress 0 to a frame where the focus rect, padded 8%, fills the stage while keeping the WHOLE rect visible (never crops inside it), clamped so the image edge never enters the stage.
- [ ] Rendered HTML: <meta name="sm-demo-duration">=durationS and <meta name="blog-video-voice">=voice; one rAF clock; window.smDemo = { duration, scenes: [{id,start,end}], seek(t), play(), pause() }; seek(t) is pure (renders the exact frame, also sets video asset currentTime = t - scene.start); consecutive scenes CROSSFADE over 0.5 s with the incoming scene drawn over the outgoing one so no time t shows an empty stage; arrow functions only (never the token `function`); claims embedded as <script type="application/json" id="blog-video-claims">.
- [ ] Visual system: Bilko warm-dark stage (#1c1917 bg, fire orange #f97316 accent, warm off-white text, system font stack); `title` = project name eyebrow + post title over a blurred, dimmed real screenshot (first screen asset); `screen` = asset with focusTransform zoom over the first 60% of the scene, an animated rounded highlight ring on the focus rect, a callout chip with a pointer placed beside the focus rect on the side with more room, lower-third caption bar; `closing` = project name + projectUrl as large text over a dimmed screenshot; one consistent bottom control strip (play/pause, restart, progress, sound toggle) that fades out while playing and back on hover; prefers-reduced-motion renders each scene's final frame as a steppable storyboard.
- [ ] tests/blog-video-runtime.test.ts: focusTransform at progress 0 is identity, at 1 keeps the padded focus rect fully inside 1280x720 for rects at each corner and the centre; renderVideoHtml on a 4-scene fixture (tiny 1x1 jpeg data URIs) passes `validateBlogVideoHtml` from scripts/blog-video.ts except for size, contains each caption, both meta tags, the claims JSON, and no `function` token.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-video-runtime.ts
- tests/blog-video-runtime.test.ts

# Implementation notes

Read first: public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html — skim its <style> and <script> only (skip base64 blobs; e.g. `sed -E 's/base64,[A-Za-z0-9+\/=]{200,}/base64,…/g'`) to reuse what works (smDemo API, audio wiring, tap-for-sound); scripts/blog-video.ts lines 1-80 (validator rules the output must pass — no `function` keyword, no parent./top., no network APIs); src/components/BlogVideoPlayer.tsx (the outer 16:9 frame — the runtime must NOT draw its own border).

Steps:
1. Red: tests/blog-video-runtime.test.ts.
2. Implement focusTransform as a pure function and ALSO emit the identical math into the runtime JS (stringify a shared arrow-function source, or duplicate with a comment and a test that both agree on 3 sample inputs).
3. Implement renderVideoHtml with template literals; escape caption/callout/title text for HTML; the audio element wiring keeps the existing `tap for sound` fallback when autoplay is blocked.
4. Visual smoke (not the gate): render the fixture to a temp file, open it with @playwright/test chromium, seek to 3 times, screenshot, and LOOK at them.
The 2 MB → 4 MB validator cap is changed by a sibling PRD; do not edit scripts/blog-video.ts.

Do not touch: scripts/blog-video.ts, scripts/blog-video-capture.ts, .claude/skills/, public/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-video-runtime.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
