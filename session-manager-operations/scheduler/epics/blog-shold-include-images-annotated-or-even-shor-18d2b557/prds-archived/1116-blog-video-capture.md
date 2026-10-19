---
title: blog-video capture script: real, allow-listed product screenshots for videos
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:05:11.403Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1kpii3-ddbdea
---
# Goal

Primitive: blog videos currently use only abstract shapes. Add a capture script that drives headless Chromium (the repo's existing `playwright` dependency) against the REAL live product pages a post links to and saves compressed 1280x720 JPEG screenshots the Blog Video skill can embed as data: URIs, keeping the whole video under the 2 MB cap.

# Acceptance criteria

- [ ] New scripts/blog-video-capture.ts exports `parseShotList(json: unknown): Shot[]` where Shot = { name: string; url: string; scrollY?: number; waitMs?: number; actions?: Array<{ click: string } | { fill: [string, string] } | { press: string } | { wait: number }> }; it throws on: more than 6 shots, more than 5 actions per shot, name not matching /^[a-z0-9-]{1,40}$/, waitMs/wait over 10000, or a url whose origin is not exactly https://bilko.run or https://github.com (no http, no other hosts, no credentials in URL).
- [ ] scripts/blog-video-capture.ts exports `qualitySteps(maxBytes: number): number[]` returning the bounded JPEG quality ladder [80, 70, 60, 50, 40] used to re-encode a shot until it is <= maxBytes; the CLI fails that shot (exit 1 with a message naming it) if quality 40 is still too big.
- [ ] CLI `pnpm tsx scripts/blog-video-capture.ts --shots <file.json> --out <dir> [--max-bytes 220000]` launches chromium headless at viewport 1280x720 (deviceScaleFactor 1, colorScheme light), per shot: goto (timeout 30 s, waitUntil networkidle with fallback to load), scroll, run actions (each with a 10 s timeout), wait, screenshot type jpeg; writes <out>/<name>.jpg plus <out>/manifest.json [{name,url,bytes,quality}] and closes the browser in a finally block.
- [ ] tests/blog-video-capture.test.ts covers parseShotList (valid list accepted; http://, other host, user:pass@ URL, 7 shots, bad name, 6 actions, waitMs 20000 rejected) and qualitySteps; it never launches a browser or touches the network.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-video-capture.ts
- tests/blog-video-capture.test.ts

# Implementation notes

Read first: scripts/blog-video.ts lines 1-15 and its CLI main-guard at the bottom (same guard pattern so importing in tests never runs the CLI); tests/blog-video.test.ts (style); tests/publish-gate.test.ts lines 15-60 (how this repo imports `chromium` from 'playwright').

Steps:
1. Red: tests/blog-video-capture.test.ts for the two pure exports.
2. Implement scripts/blog-video-capture.ts. Browser launch: `chromium.launch({ headless: true })` from 'playwright'; if launch fails because the browser binary is missing, print `HALT: run pnpm exec playwright install chromium` and exit 1.
3. Re-encode via repeated `page.screenshot({ type: 'jpeg', quality })` down the ladder (no new image dependency).
4. Manual smoke (not the gate): run it once against `[{"name":"home","url":"https://bilko.run/projects/outdoor-hours/"}]` into a mktemp dir and confirm a non-empty jpg under the cap. Do not commit the output.
Why the host allow-list: the script is run by an unattended macro and must only ever load the site's own pages and its GitHub repos.

Do not touch: scripts/blog-video.ts, .claude/skills/, public/.

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
