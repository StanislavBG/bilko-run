---
title: Video frame review: contact sheet + blank-frame detector
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T02:02:43.977Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1r1u2x-0d58a5
---
# Goal

Primitive: a quality gate the agent runs before publishing — render the video at every scene's middle and every scene boundary, fail on blank/near-empty frames (the current git-viewer video shows an empty cream frame at 22 s), and write one contact-sheet image the agent must look at to judge cropping, callout placement and readability.

# Acceptance criteria

- [ ] New scripts/blog-video-frames.ts exports pure `sampleTimes(scenes: {start: number; end: number}[], duration: number): number[]` (each scene midpoint, each boundary +-0.25 s, plus 0.5 and duration-0.5; sorted, deduped, clamped to [0, duration]) falling back to every 2 s when scenes is empty; and pure `isBlankFrame(stats: { stddev: number; edgeDensity: number }): boolean` (blank when stddev < 8 OR edgeDensity < 0.01).
- [ ] CLI `pnpm tsx scripts/blog-video-frames.ts <video.html> --out <dir>` opens the file via file:// in @playwright/test chromium at 1280x720, reads window.smDemo.scenes (if present), pauses, seeks each sample time, screenshots to <dir>/t-<seconds>.jpg, computes luminance stddev and edge density in-page on a canvas, writes <dir>/contact.jpg (a 4-column grid of all frames, each labelled with its time, rendered as an HTML page and screenshotted) and <dir>/frames.json; exits 1 listing every blank frame time, else 0.
- [ ] tests/blog-video-frames.test.ts covers sampleTimes (boundaries included, dedupe, clamp, empty-scenes fallback) and isBlankFrame thresholds; no browser in tests.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-video-frames.ts
- tests/blog-video-frames.test.ts

# Implementation notes

Read first: scripts/blog-video-capture.ts lines 130-160 (lazy `await import('@playwright/test')` chromium pattern and HALT message on missing browser) and its CLI main-guard; tests/blog-video-capture.test.ts (style).

Edge density: grayscale → count pixels where |p(x+1)-p(x)| > 24, divided by pixel count (downscale to 320x180 first for speed).
Smoke (not the gate): run it on public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html — expect it to flag the near-empty frames around 22 s — and LOOK at contact.jpg.

Do not touch: scripts/blog-video.ts, scripts/blog-video-capture.ts, scripts/blog-video-runtime.ts, public/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-video-frames.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
