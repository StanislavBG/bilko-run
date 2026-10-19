---
title: Blog Video skill: pick a post, storyboard, narrate, validate, publish
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T21:33:11.363Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1hf77n-aaa03b
---
# Goal

Doc: write the project skill the one-click "Blog Video" HOT KEYS macro runs. It repurposes the Project Home demo-video-builder contract (30 s self-contained HTML/JS animation + on-device Kokoro narration) but grounds every scene in ONE blog post's text instead of the repo, writes it where the blog serves videos, validates, commits, pushes and verifies it live.

# Acceptance criteria

- [ ] New .claude/skills/blog-video/SKILL.md with frontmatter `name: blog-video` and a `description` that mentions: Blog Video macro, 30-second video for a bilko.run blog post, picks newest post without a video.
- [ ] Step 1 (pick): if the human named a slug use it, else run `pnpm tsx scripts/blog-video.ts next`; on `{"slug":null}` report that every post already has a video and stop.
- [ ] Step 2-4 (ground + storyboard + build): read the post body from its `INSERT OR IGNORE INTO blog_posts` seed in server/db.ts (search by slug); claims list where every caption traces to a sentence in the post; 5-7 scene storyboard summing to exactly 30 s (title card with post title → the hook → 3-4 key points → closing card showing the post's main full https link); HTML built per the `<output_contract>` and `<audio_policy>` sections of ~/.claude/agents/demo-video-builder.md (Kokoro-82M, voice af_heart then af_bella as fallback, 64 kbps MP3 at native sample rate, arrow functions only, window.smDemo API, sm-demo-duration=30, prefers-reduced-motion).
- [ ] Voice rules section: narration and captions follow .claude/skills/blog-from-git/voice.md plain-language rules (you, active voice, short common words, ≤12 words per caption) and blog.config.yaml identity: no marketing language, never claim Bilko is a human or give a location, no mention of automation/pipelines; Bilko palette (fire orange accent on warm neutrals) light and dark.
- [ ] Steps 5-7 (publish): write public/blog-videos/<slug>/index.html; run `pnpm tsx scripts/blog-video.ts validate <path>` and fix up to 3 times, else HALT; commit only that path; `git pull --rebase origin main && git push origin main` (never the content-grade remote); then a bounded check (at most 20 tries × 30 s) that https://bilko.run/blog-videos/<slug>/ returns 200 and https://bilko.run/api/blog/<slug> has a non-null video_url; report storyboard (scene, timing, source sentence) and live URL https://bilko.run/blog/<slug>.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-video/SKILL.md

# Implementation notes

Read first: ~/.claude/agents/demo-video-builder.md (all — reuse its storyboard/output_contract/audio_policy wording by reference, don't fork the Kokoro install instructions: tell the reader to follow that file's audio_policy); .claude/skills/blog-from-git/SKILL.md lines 1-60 (frontmatter + house style for skills in this repo); .claude/skills/blog-from-git/voice.md lines 1-60; .claude/skills/blog-from-git/blog.config.yaml lines 1-40.

Facts the skill must state (they are true once sibling PRDs land): videos live at public/blog-videos/<slug>/index.html, served at /blog-videos/<slug>/ under a sandboxed no-network CSP; the server discovers them at boot, so a video only appears on the live post after the Render deploy that follows the push; the blog post page shows them in the shared BlogVideoPlayer (src/components/BlogVideoPlayer.tsx) — the video itself must not draw an outer frame/border of its own, the player provides it; the validator rejects `function(`/`function (` and `parent.`/`top.`.
Keep the skill under ~150 lines, numbered steps, each with its exit condition, in the same terse style as blog-from-git's sub-skills.

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
