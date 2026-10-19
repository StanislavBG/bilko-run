---
title: Blog video builder: storyboard.json + captured assets → validated video
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T02:03:05.014Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
dependsOn: [blog-video-runtime, blog-video-validator-v2]
planId: pl-mv1qzmib-d18503
---
# Goal

Wire: the agent should author a story, not HTML. Add a builder that reads a storyboard JSON (scenes, captions, the post sentence each scene comes from, which captured asset and focus rect it shows, narration timing), enforces story and grounding rules, inlines the captured JPEG/MP4 assets and narration MP3, renders through scripts/blog-video-runtime.ts, and validates the result.

# Acceptance criteria

- [ ] New scripts/blog-video-build.ts exports `parseStoryboard(json: unknown): Storyboard` where Storyboard = { slug; voice; project: { name; url (https://bilko.run/projects/<slug>/ or https://github.com/...) }; scenes: Array<{ id; type: 'title'|'text'|'screen'|'closing'; duration: number; caption: string; callout?: string; source: string; asset?: string; focus?: {x,y,w,h}; narrationSeconds?: number }> }, throwing with a precise message on: durations not summing to 30 (±0.01); first scene not `title` or last not `closing`; fewer than 3 `screen` scenes; any `screen` scene without asset or focus; focus outside 1280x720; caption over 12 words; callout over 7 words; any scene duration < 3 or > 8; narrationSeconds > duration - 0.3.
- [ ] CLI `pnpm tsx scripts/blog-video-build.ts --storyboard <sb.json> --assets <dir> --post content/blog/<slug>.md --out public/blog-videos/<slug>/index.html [--audio <narration.mp3>]` resolves each asset as <dir>/<asset>.mp4 (video) else <dir>/<asset>.jpg (image), computes scene start times, takes the post title from the post frontmatter, calls renderVideoHtml, then runs validateBlogVideoHtml and checkClaimsGrounded (claims = each scene's source) and refuses to write the file (exit 1, all errors printed) if any check fails.
- [ ] tests/blog-video-build.test.ts: a valid 6-scene storyboard parses; each rule above has a failing case; an end-to-end build into a tmp dir with tiny fixture assets and a fixture post produces a file that passes validateBlogVideoHtml and checkClaimsGrounded; an ungrounded `source` makes the build exit without writing.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-video-build.ts
- tests/blog-video-build.test.ts

# Implementation notes

Read first (all landed by earlier PRDs in this plan — read the real code, signatures may differ slightly from these notes; adapt to what landed): scripts/blog-video-runtime.ts (ResolvedSpec, renderVideoHtml); scripts/blog-video.ts (validateBlogVideoHtml, checkClaimsGrounded, frontmatter handling); content/blog/twelve-places-one-weather-rule-you-set-yourself.md (fixture shape); tests/blog-video.test.ts (style).

Steps:
1. Red: tests/blog-video-build.test.ts (fixture post written to a tmp dir; fixture assets: a tiny valid JPEG bytes buffer and a few bytes named .mp4 are fine for the HTML build).
2. Implement parseStoryboard (hand-rolled checks or zod if it is already a dependency — check package.json; add no new deps).
3. Implement the CLI with the same main-guard pattern as scripts/blog-video.ts.

Do not touch: scripts/blog-video-runtime.ts, scripts/blog-video.ts, scripts/blog-video-capture.ts, .claude/skills/, public/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-video-build.test.ts tests/blog-video-runtime.test.ts tests/blog-video.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
