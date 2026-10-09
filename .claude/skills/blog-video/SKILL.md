---
name: blog-video
description: The Blog Video macro. Make a 30-second animated, narrated video for a bilko.run blog post — picks the newest post without a video (or the slug you name), grounds every scene in that one post's text, builds a self-contained HTML/JS video with on-device Kokoro narration, saves it under public/blog-videos/<slug>/, validates, commits, pushes to origin main and verifies it live. Use for "Blog Video", "make a video for the latest blog post", "30-second video for <slug>". NOT for Project Home demo videos (that is demo-video-builder) and NOT for writing posts (that is blog-from-git).
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

Find the post body: search `server/db.ts` for the slug, in its `INSERT OR IGNORE INTO blog_posts`
seed. Read title, body and links in full. Write a claims list: every caption you plan to show, next
to the sentence in the post it comes from. Drop any caption with no source. No invented numbers,
logos, screenshots or features.
**Exit:** claims list written; each caption maps to a post sentence.

## 3. Storyboard

Write 5-7 scenes whose timings sum to exactly 30 s:

1. Title card — the post title.
2. The hook — the post's opening idea.
3-6. Three or four key-point scenes, each built on ONE real screenshot of the product the post is
   about: a slow Ken Burns pan/zoom to the region that matters, an animated highlight box or arrow
   on that region, and a ≤12-word callout taken from the claims list. A scene whose capture was
   dropped in step 4 falls back to simple animated shapes, SVG or kinetic type.
7. Closing card — the post's main full `https://` link as text, over a dimmed real screenshot.

Hold each scene long enough to read twice.
**Exit:** scene timings sum to 30; every caption is ≤12 words; each key-point scene names its shot.

## 4. Capture

List the post's own full `https://` links to `https://bilko.run/projects/<slug>/` (and its GitHub
repo). Write `<tmp>/shots.json` (`<tmp>` from `mktemp -d`): 3-5 shots, each tied to a storyboard
scene and the post sentence it shows. Shape: an array of
`{ name, url, scrollY?, waitMs?, actions?: [{click: selector}|{fill: [selector, text]}|{press: key}|{wait: ms}] }`
— max 6 shots, max 5 actions, only `https://bilko.run` and `https://github.com` URLs. Use
`scrollY`/`actions` to reach the exact screen a sentence describes. Run:

`pnpm tsx scripts/blog-video-capture.ts --shots <tmp>/shots.json --out <tmp>/shots`

It writes `<tmp>/shots/<name>.jpg` and `manifest.json`. Then LOOK at every image (Read tool) and drop
any that shows an error, blank, loading or sign-in screen. Never commit the capture directory; only
the final `index.html` is committed.
**Exit:** every kept image was viewed and shows the screen its sentence describes; dropped shots
are noted with the reason.

## 5. Build

Build one HTML document per `<output_contract>` and `<audio_policy>` in
`~/.claude/agents/demo-video-builder.md`:

- Kokoro-82M, voice `af_heart`; use `af_bella` if `af_heart` fails or sounds wrong.
- 64 kbps MP3 at the model's native sample rate, base64 in one `<audio>` tag. If Kokoro cannot run,
  ship silent rather than fail.
- Arrow functions only. Expose `window.smDemo = { duration: 30, seek, play, pause }`.
- `<meta name="sm-demo-duration" content="30">`, 1280x720 stage, one rAF clock, no network APIs,
  respects `prefers-reduced-motion`, under 2 MB.
- No outer frame or border on the stage; the player supplies it.
- Budget: images ≤ 1.2 MB total (capture default `--max-bytes 220000`, at most 5 shots) + narration
  ~240 KB keeps the document under the validator's 2 MB cap. If over, drop the weakest shot before
  lowering audio bitrate.

**Exit:** the file exists in memory or a temp path and passes your own read-through against the above.

## Voice rules

- Narration and captions follow `.claude/skills/blog-from-git/voice.md` plain-language rules: say
  "you", use active voice, short common words, ≤12 words per caption.
- Follow `.claude/skills/blog-from-git/blog.config.yaml` `identity:` — no marketing language; never
  claim Bilko is a human or give a location; never mention automation or pipelines.
- Images are real captures only. Crop, scale, pan/zoom and overlay annotations are allowed; never
  edit, repaint or composite the page content itself, and never use mockups or stock images.
- Embed images as `data:image/jpeg;base64` in `<img>` or CSS — no file references.
- Annotation coordinates (boxes, arrows, callouts) are in the 1280x720 capture space, so they line
  up with the screenshot after scaling.
- Palette: Bilko fire orange accent on warm neutrals, with a light and a dark variant that both keep
  enough contrast.

## 6. Write and validate

Write `public/blog-videos/<slug>/index.html`, then run
`pnpm tsx scripts/blog-video.ts validate public/blog-videos/<slug>/index.html`. On failure, fix the
reported problem and re-run, up to 3 fixes.
**Exit:** validator passes. After 3 failed fixes, HALT and report the last validator output.

## 7. Commit and push

`git add public/blog-videos/<slug>/index.html && git commit -m "feat(blog): 30-second video for <slug>"`
— that path only. Then `git pull --rebase origin main && git push origin main`. Push to `origin`
(`StanislavBG/bilko-run`) only; never the `content-grade` remote.
**Exit:** push succeeded. On a rebase conflict, HALT and report.

## 8. Verify live

Poll at most 20 tries, 30 s apart, until both hold:

- `https://bilko.run/blog-videos/<slug>/` returns 200.
- `https://bilko.run/api/blog/<slug>` has a non-null `video_url`.

**Exit:** both pass, or 20 tries ran out — then report "pushed, deploy not yet live" with the last
status codes. Never loop past 20.

## Report

- Storyboard as a short list: scene, timing, source sentence from the post.
- Shot list: name, url, scene, post sentence — plus any dropped captures with the reason.
- Live URL: `https://bilko.run/blog/<slug>`.
- Anything skipped (e.g. silent video because Kokoro was unavailable).
