---
title: Blog Video skill: build scenes around real, annotated product screenshots
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T23:05:43.703Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1kq7fb-6d6508
---
# Goal

Doc: update the Blog Video skill so the key-point scenes show REAL screenshots of the product the post is about (captured live with scripts/blog-video-capture.ts), animated with pan/zoom and annotated with highlight boxes, arrows and callouts whose text comes from the post — instead of abstract shapes only.

# Acceptance criteria

- [ ] .claude/skills/blog-video/SKILL.md has a new step `Capture` between Storyboard and Build: list the post's own full https links to https://bilko.run/projects/<slug>/ (and its GitHub repo), write a shot list JSON (3-5 shots, each tied to a storyboard scene and a post sentence; use scrollY/actions to reach the exact screen a sentence describes), run `pnpm tsx scripts/blog-video-capture.ts --shots <tmp>/shots.json --out <tmp>/shots`, then LOOK at every image (Read tool) and drop any that shows an error, blank, loading or sign-in screen.
- [ ] Storyboard step is rewritten: title card → hook → 3-4 key-point scenes each built on one real screenshot (slow Ken Burns pan/zoom to the region that matters, an animated highlight box or arrow on that region, a ≤12-word callout from the claims list) → closing card with the full https link over a dimmed real screenshot. The old `never a fake screenshot` shapes-only wording is replaced; shapes remain the fallback for a scene whose capture was dropped.
- [ ] Rules section states: images are real captures only — crop, scale, pan/zoom and overlay annotations are allowed; never edit, repaint, or composite the page content itself, never use mockups or stock images; embed as `data:image/jpeg;base64` in <img> or CSS (no file references); annotation coordinates are in the 1280x720 capture space so they line up after scaling.
- [ ] Budget line: total images <= 1.2 MB (capture default --max-bytes 220000, at most 5 shots) + narration ~240 KB keeps the document under the validator's 2 MB cap; if over, drop the weakest shot before lowering audio bitrate.
- [ ] Report section adds: the shot list (name, url, scene, post sentence) and any dropped captures with the reason. The file stays under ~150 lines.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-video/SKILL.md

# Implementation notes

Read first: .claude/skills/blog-video/SKILL.md (all, ~102 lines — edit in place, keep its step/exit-condition style); ~/Projects/session-manager/plugins/session-manager-dev/skills/blog-for-project-feature/3-capture/SKILL.md (read-only reference for the real-screenshot rules: drop unreachable steps, never mock, look at what actually rendered).

The capture CLI (landed by a sibling PRD, scripts/blog-video-capture.ts) takes `--shots <file.json> --out <dir> [--max-bytes N]`; shot JSON is an array of { name, url, scrollY?, waitMs?, actions?: [{click: selector}|{fill: [selector, text]}|{press: key}|{wait: ms}] } (max 6 shots, max 5 actions, only https://bilko.run and https://github.com URLs); it writes <dir>/<name>.jpg and <dir>/manifest.json. Describe it in the skill exactly like that. Capture output goes to a mktemp -d directory and is never committed — only the final index.html is.

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
