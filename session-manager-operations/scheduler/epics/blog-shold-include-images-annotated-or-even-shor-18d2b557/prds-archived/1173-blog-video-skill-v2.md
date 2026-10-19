---
title: Blog Video skill v2: story-first, real motion, frame review loop
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T02:04:27.176Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
dependsOn: [blog-video-builder, blog-video-capture-clips, blog-video-frames]
planId: pl-mv1r1aja-ec9776
---
# Goal

Doc: rewrite the Blog Video skill so videos tell the post's story and showcase the product. Today the scenes are a feature list over static screenshots; v2 follows a fixed story spine taken from the post, shows the product actually moving, authors a storyboard.json instead of HTML, and reviews its own frames before publishing.

# Acceptance criteria

- [ ] .claude/skills/blog-video/SKILL.md Ground step reads the post from content/blog/<slug>.md (no reference to server/db.ts remains) and the project name/tagline from src/data/standalone-projects.json for the project the post links to.
- [ ] A `Story spine` section defines the 30 s arc every video follows, each beat tied to a verbatim post sentence: (1) title 3-4 s: project name + post title over the real product; (2) problem 4 s: the post's opening tension in the reader's words; (3) reveal 5 s: the product's first screen with the one-line promise; (4-5) two or three `you can` moments 5-7 s each, each a REAL motion clip of the exact interaction a post sentence describes (move a dial, switch a view, pick a place) with a focus rect + ≤7-word callout; (6) payoff 3-4 s: the post's own sharpest result sentence; (7) closing 3-4 s: project name + full https link. Pick moments by the post's emphasis, not by what is easiest to capture.
- [ ] Capture step uses `record: {seconds}` for every `you can` moment and stills only for title/reveal/closing; agent opens each JPEG and a mid-clip frame (`ffmpeg -ss N -frames:v 1`) and drops error/blank/sign-in captures; focus rects are measured from the real capture (element bounding boxes via the capture actions or by inspecting the image), never guessed.
- [ ] Narration step: Kokoro per ~/.claude/agents/demo-video-builder.md audio_policy (af_heart, else af_bella); synthesize one line per scene first, record each clip's real length as narrationSeconds, shorten any line that overruns, then lay the track; voice name goes into storyboard `voice`. Build step = scripts/blog-video-build.ts (never hand-written HTML).
- [ ] Review step: run scripts/blog-video-frames.ts, LOOK at contact.jpg against a rubric (no blank frame, no clipped headline or text cut mid-word, callout points at the right thing, caption readable, every moment visibly shows the product doing what the post says, consistent look) and revise the storyboard at most 2 rounds before publishing; the report includes the contact sheet path and the rubric result. Then validate with `--post`, commit, push, live-check as before.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-video/SKILL.md

# Implementation notes

Read first (landed by earlier PRDs in this plan — describe the REAL flags/fields you find, not these notes, if they differ): .claude/skills/blog-video/SKILL.md (current, ~130 lines — rewrite in place, keep the step + exit-condition style and the Voice rules section); scripts/blog-video-build.ts (storyboard schema + CLI), scripts/blog-video-capture.ts (shot list incl. record), scripts/blog-video-frames.ts (CLI), scripts/blog-video.ts (validate --post); content/blog/README.md.

Keep it under ~170 lines. Include one short example storyboard.json (6-7 scenes) based on the OutdoorHours post content/blog/twelve-places-one-weather-rule-you-set-yourself.md, with real sentences from it as `source`.

Do not touch: anything outside .claude/skills/blog-video/.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
