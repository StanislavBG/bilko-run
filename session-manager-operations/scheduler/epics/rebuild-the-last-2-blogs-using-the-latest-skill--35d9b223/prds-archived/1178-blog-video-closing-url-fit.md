---
title: Blog video closing scene: keep the URL on one line, shown once
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-10T04:29:53.021Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
agentType: dev-lead
disposition: new-head
planId: pl-mv1wb2m5-d98a4b
---
# Goal

behavior: the blog-video runtime's closing scene breaks the project URL mid-word ("git-viewe / r/", "outdoor-h / ours/") because `.link` uses `word-break:break-all`, and it shows the URL twice (the `.link` line plus a caption that is usually the same URL). Fix `sceneHtml`'s closing case in scripts/blog-video-runtime.ts so the URL renders on one line at a size that fits 1100px, and the caption is omitted when it is just the URL again.

# Acceptance criteria

- [ ] In scripts/blog-video-runtime.ts the `.link` CSS no longer contains `word-break:break-all`; it uses `white-space:nowrap`
- [ ] The closing scene's `.link` font-size is computed from the URL length so it fits within 1100px (e.g. `Math.min(58, Math.floor(1100 / (len * 0.6)))` px, inline style), and the displayed text drops the leading `https://`
- [ ] The closing scene omits the `.sub` caption when the caption, after stripping scheme and trailing slash, equals the URL after the same normalisation
- [ ] tests/blog-video-runtime.test.ts gains tests for: nowrap and no break-all; a 45-char URL gets font-size below 58; caption equal to URL is not rendered twice; a different caption still renders
- [ ] All existing tests in tests/blog-video-runtime.test.ts and tests/blog-video-build.test.ts pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-video-runtime.ts
- tests/blog-video-runtime.test.ts

# Implementation notes

Read first: scripts/blog-video-runtime.ts lines 80-125 (`sceneHtml` switch, `case 'closing'` at ~92 and the `.link` CSS at ~120), tests/blog-video-runtime.test.ts (how it calls `renderVideoHtml`).
Steps:
1. Add the failing tests (red) in tests/blog-video-runtime.test.ts.
2. In the closing case, compute `const shown = (spec?.projectUrl ?? '').replace(/^https?:\/\//, '')`, a px size as above, and render `<div class="link in" data-d="0.4" style="font-size:${px}px">${esc(shown)}</div>`.
3. Compare normalised caption vs URL (strip scheme, trailing slash, lowercase); render the `.sub` paragraph only when they differ.
4. Change the `.link` CSS rule: remove word-break:break-all, add white-space:nowrap.
Do not touch: public/blog-videos/ (videos are rebuilt by later PRDs), .claude/skills/blog-video/SKILL.md.
Origin: the 2026-10-09 validation record session-manager-operations/reviews/validation/blog-shold-include-images-annotated-or-even-shor-18d2b557/validate-blog-video-v2.md lists this as a Minor finding on both videos.

# Out of scope

- Rebuilding any existing video
- Other scene types

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-video-runtime.test.ts tests/blog-video-build.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
