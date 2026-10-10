---
name: blog-video
description: The Blog Video macro. Make a 30-second animated, narrated video for a bilko.run blog post — picks the newest post without a video (or the slug you name), grounds every scene in that one post's text, follows a fixed story spine, shows the product moving in real motion clips, authors a storyboard.json (never HTML), builds it with scripts/blog-video-build.ts with on-device Kokoro narration, reviews its own frames, saves it under public/blog-videos/<slug>/, validates, commits, pushes to origin main and verifies it live. Use for "Blog Video", "make a video for the latest blog post", "30-second video for <slug>". NOT for Project Home demo videos (that is demo-video-builder) and NOT for writing posts (that is blog-from-git).
---

# Blog Video — one post, 30 seconds, live

Repurposes the Project Home demo-video contract (`~/.claude/agents/demo-video-builder.md`), but every
scene is grounded in ONE blog post's text, not the repo. Where this file says "per `<output_contract>`"
or "per `<audio_policy>`", read that section of the agent file and follow it — including the Kokoro
install and model download steps. Do not restate or fork them here.

Facts that hold once the blog-video feature has landed:

- Videos live at `public/blog-videos/<slug>/index.html`, served at `/blog-videos/<slug>/` under a
  sandboxed, no-network CSP.
- The server discovers videos at boot, so a video appears on the live post only after the Render
  deploy that follows your push.
- The post page shows the video in the shared `BlogVideoPlayer` (`src/components/BlogVideoPlayer.tsx`).
  The player draws the frame — the video must NOT draw its own outer frame or border.
- The validator rejects `function(` / `function (` and `parent.` / `top.`.

## 1. Pick

If the human named a slug, use it. Otherwise run `pnpm tsx scripts/blog-video.ts next`.
**Exit:** you have one slug. If the output is `{"slug":null}`, report "every post already has a
video" and stop.

## 2. Ground

Read the post in full from `content/blog/<slug>.md` (frontmatter title + body; see
`content/blog/README.md`). Find the project the post links to (`https://bilko.run/projects/<p>/`) and
take its `name` and `tagline` from `src/data/standalone-projects.json`. Write a claims list: every
caption, callout and narration line next to the verbatim post sentence it comes from. Drop any with
no source. No invented numbers, logos, screens or features.
**Exit:** claims list written; project name/tagline read from the registry.

## Story spine

Every video follows this 30 s arc. Each beat's `source` is a verbatim post sentence. Pick the
`you can` moments by the post's emphasis (what it spends the most words on), not by what is easiest
to capture.

1. **Title** (3-4 s, `title`): project name + post title over the real product.
2. **Problem** (4 s, `text`): the post's opening tension, in the reader's words.
3. **Reveal** (5 s, `screen`, still): the product's first screen with the one-line promise.
4-5. **You can** (two or three moments, 5-7 s each, `screen`): a REAL motion clip of the exact
   interaction a post sentence describes (move a dial, switch a view, pick a place), with a `focus`
   rect and a callout of ≤7 words.
6. **Payoff** (3-4 s, `text`): the post's own sharpest result sentence.
7. **Closing** (3-4 s, `closing`): project name + full `https://` link.

Durations sum to exactly 30; builder limits: scene 3-8 s, caption ≤12 words, ≥3 `screen` scenes.
**Exit:** every beat has a scene, a source sentence and a duration; the sum is 30.

## 3. Capture

Write `<tmp>/shots.json` (`<tmp>` from `mktemp -d`): an array of
`{ name, url, scrollY?, waitMs?, actions?: [{click: selector}|{fill: [selector, text]}|{press: key}|{wait: ms}], record?: {seconds} }`
— max 6 shots, max 5 actions, `record.seconds` 1-6, only `https://bilko.run` and `https://github.com`
URLs. Stills (no `record`) for title, reveal and closing only; `record: {seconds}` for EVERY
`you can` moment, with `actions` performing the interaction the sentence describes. Run:

`pnpm tsx scripts/blog-video-capture.ts --shots <tmp>/shots.json --out <tmp>/shots`

It writes `<name>.jpg` (and `<name>.mp4` for recorded shots) plus `manifest.json`. Then LOOK at
every JPEG (Read tool) and, for each clip, a mid-clip frame
(`ffmpeg -ss <N> -frames:v 1 <tmp>/shots/<name>.mp4 <tmp>/shots/<name>-mid.jpg`); drop any capture
showing an error, blank, loading or sign-in screen. Measure each `focus` rect (x, y, w, h in 1280x720)
from the real capture: element bounding boxes via the capture actions, or by inspecting the image.
Never guess a rect. Never commit the capture directory.
**Exit:** every kept capture was viewed (clips at mid-frame); dropped ones noted with the reason;
every focus rect is measured.

## 4. Storyboard

Author `<tmp>/storyboard.json` (see example). Scene fields: `id`, `type` (`title|text|screen|closing`),
`duration`, `caption`, `callout?`, `source`, `asset?` (shot name; the builder prefers `<asset>.mp4`
over `.jpg`), `focus?` `{x,y,w,h}`, `narrationSeconds?`. Top level: `slug`, `voice`,
`project: {name, url}`. Do not write HTML.
**Exit:** file written with every beat of the spine.

## 5. Narrate and build

Narration: Kokoro per `<audio_policy>` in `~/.claude/agents/demo-video-builder.md` (`af_heart`, else
`af_bella`; follow its install/model steps). Synthesize one line per scene FIRST (the caption or a
close paraphrase of it), record each clip's real length as that scene's `narrationSeconds`, shorten
any line that overruns `duration - 0.3` and re-synthesize, then lay the clips on one track, each
starting at its scene start, as 64 kbps MP3. Put the voice name in storyboard `voice`. If Kokoro
genuinely cannot run, build without `--audio` and say why.

Build (never hand-written HTML):

`pnpm tsx scripts/blog-video-build.ts --storyboard <tmp>/storyboard.json --assets <tmp>/shots --post content/blog/<slug>.md --out public/blog-videos/<slug>/index.html --audio <tmp>/narration.mp3`

The builder enforces the story and grounding rules, inlines assets and runs the validator. Fix every
reported error in the storyboard and re-run. The player draws the frame; the document must stay
under the validator's 2 MB cap (drop the weakest still or shorten a clip before lowering bitrate).
**Exit:** the build prints no errors and the file exists.

## Voice rules

- Narration and captions follow `.claude/skills/blog-from-git/voice.md` plain-language rules: say
  "you", use active voice, short common words, ≤12 words per caption.
- Follow `.claude/skills/blog-from-git/blog.config.yaml` `identity:` — no marketing language; never
  claim Bilko is a human or give a location; never mention automation or pipelines.
- Images are real captures only. Crop, scale, pan/zoom and overlay annotations are allowed; never
  edit, repaint or composite the page content itself, and never use mockups or stock images.
- The builder inlines assets as data: URIs; you never write HTML.
- Annotation coordinates (boxes, arrows, callouts) are in the 1280x720 capture space, so they line
  up with the capture after scaling.
- Palette: Bilko fire orange accent on warm neutrals, with a light and a dark variant that both keep
  enough contrast.

## 6. Review frames

Run `pnpm tsx scripts/blog-video-frames.ts public/blog-videos/<slug>/index.html --out <tmp>/frames`.
LOOK at `contact.jpg` (Read tool) against this rubric:

- no blank frame (the script flags them);
- no clipped headline, no text cut mid-word;
- each callout points at the right thing;
- the caption is readable;
- every moment visibly shows the product doing what the post says;
- the look is consistent across scenes.

Revise the storyboard (focus, callout, caption, timing, or recapture) and rebuild, at most 2 rounds.
**Exit:** rubric passes, or 2 rounds are spent — then publish and list the failed items in the report.

## 7. Validate, commit, push

`pnpm tsx scripts/blog-video.ts validate public/blog-videos/<slug>/index.html --post content/blog/<slug>.md`
— up to 3 fixes, else HALT with the last output. Then
`git add public/blog-videos/<slug>/index.html && git commit -m "feat(blog): 30-second video for <slug>"`
(that path only), `git pull --rebase origin main && git push origin main`. Push to `origin`
(`StanislavBG/bilko-run`) only; never the `content-grade` remote.
**Exit:** push succeeded. On a rebase conflict, HALT and report.

## 8. Verify live

Poll at most 20 tries, 30 s apart, until both hold:

- `https://bilko.run/blog-videos/<slug>/` returns 200.
- `https://bilko.run/api/blog/<slug>` has a non-null `video_url`.

**Exit:** both pass, or 20 tries ran out — then report "pushed, deploy not yet live" with the last
status codes. Never loop past 20.

## Example storyboard.json (OutdoorHours post)

```json
{
  "slug": "twelve-places-one-weather-rule-you-set-yourself",
  "voice": "af_heart",
  "project": { "name": "OutdoorHours", "url": "https://bilko.run/projects/outdoor-hours/" },
  "scenes": [
    { "id": "title", "type": "title", "duration": 3, "caption": "OutdoorHours: set your own weather rule", "asset": "reveal", "source": "Every weather app tells you the temperature." },
    { "id": "problem", "type": "text", "duration": 4, "caption": "None of them say if it was nice enough to go outside", "source": "None of them tell you if it was actually nice enough to go outside." },
    { "id": "reveal", "type": "screen", "duration": 5, "caption": "Twelve real places, ten years of comfortable hours", "asset": "reveal", "focus": { "x": 80, "y": 120, "w": 1120, "h": 480 }, "source": "Open it and compare twelve real places" },
    { "id": "dials", "type": "screen", "duration": 6, "caption": "Build your own rule with seven dials", "callout": "Move a dial, charts update", "asset": "dial", "focus": { "x": 860, "y": 200, "w": 360, "h": 300 }, "source": "Move a dial, and every chart on the page updates right away." },
    { "id": "drill", "type": "screen", "duration": 6, "caption": "Click a point to open that month", "callout": "Click down to one hour", "asset": "drill", "focus": { "x": 120, "y": 260, "w": 700, "h": 300 }, "source": "Click any point on the chart and it opens that month." },
    { "id": "payoff", "type": "text", "duration": 3, "caption": "Now you set the rule yourself", "source": "Now you set the rule yourself, and you can run it across any of the twelve places at once." },
    { "id": "closing", "type": "closing", "duration": 3, "caption": "bilko.run/projects/outdoor-hours", "asset": "reveal", "source": "Try it yourself at [the OutdoorHours project page](https://bilko.run/projects/outdoor-hours/)." }
  ]
}
```

(Durations total 30. Rects are illustrative — measure yours from your own captures.)

## Report

- Storyboard as a short list: scene, timing, source sentence.
- Shot list: name, url, still or clip, scene, post sentence — plus dropped captures and why.
- Contact sheet path (`<tmp>/frames/contact.jpg`) and the rubric result, with rounds used.
- Live URL: `https://bilko.run/blog/<slug>`.
- Anything skipped (e.g. silent video because Kokoro was unavailable).
