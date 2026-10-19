---
title: Capture real product motion clips + close the redirect/off-site navigation gap
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-10T02:02:18.646Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1r1aja-ec9776
---
# Goal

Behavior: still screenshots can't show what makes a product good (move a dial → the ranking reshuffles). Extend the capture script so a shot can record a short real clip of the live product while its actions run, encoded small enough to embed. Also fix the validator's Important finding: navigation to off-allow-list hosts (redirects, clicks) is currently only checked after the page loaded.

# Acceptance criteria

- [ ] scripts/blog-video-capture.ts: Shot gains optional `record?: { seconds: number }` (1..6, else parseShotList throws); a recorded shot runs its actions inside a context created with recordVideo at 1280x720, then ffmpeg trims to the action window and encodes H.264 mp4 (`-c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart -an`, 1280x720, 24 fps) to <out>/<name>.mp4, stepping crf 30→34→38 until it is <= --max-clip-bytes (default 450000), else fails that shot with a message.
- [ ] Every context installs a route handler that aborts any document/navigation request whose origin is not https://bilko.run or https://github.com (subresources such as fonts and images from other origins are still allowed), and the final page origin is re-checked after actions and before the screenshot/clip is saved; an off-list final origin fails the shot.
- [ ] manifest.json entries gain `kind: 'image' | 'video'` and for video `seconds`; the still JPEG is still written for every shot (used as poster/fallback).
- [ ] `qualitySteps` uses its maxBytes argument or the unused parameter is removed (validator Minor finding).
- [ ] tests/blog-video-capture.test.ts adds: record.seconds 0 and 7 rejected, 3 accepted; exported pure `isAllowedNavigation(url: string, isNavigation: boolean): boolean` returns false for https://evil.test navigations and true for an evil.test image subresource; existing tests still pass; no browser or network in tests.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-video-capture.ts
- tests/blog-video-capture.test.ts

# Implementation notes

Read first: scripts/blog-video-capture.ts (all, 212 lines — parseShotList ~76, qualitySteps ~105, CLI ~140-212); tests/blog-video-capture.test.ts; ffmpeg is at ~/.local/bin/ffmpeg (call `ffmpeg` via PATH; if missing, HALT with a clear message).

Steps:
1. Red: new tests.
2. Add isAllowedNavigation + route handler (`context.route('**/*', route => route.request().isNavigationRequest() && !allowed ? route.abort() : route.continue())`).
3. Recording: create a fresh context per recorded shot with `recordVideo: { dir: tmp, size: {width:1280,height:720} }`, note the timestamp right before the first action, close the context to flush the .webm, then ffmpeg `-ss <offset> -t <seconds>` into mp4.
4. Smoke (not the gate): record one 4 s clip on https://bilko.run/projects/outdoor-hours/ that clicks the `Custom` mood tab, LOOK at a frame (`ffmpeg -ss 2 -frames:v 1`) and confirm it is real UI and under the cap. Do not commit outputs.

Do not touch: scripts/blog-video.ts, scripts/blog-video-runtime.ts, .claude/skills/, public/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-video-capture.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
