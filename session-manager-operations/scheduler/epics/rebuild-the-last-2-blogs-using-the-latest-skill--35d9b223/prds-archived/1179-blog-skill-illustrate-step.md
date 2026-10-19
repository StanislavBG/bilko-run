---
title: Add an Illustrate step (real screenshot figures) to the blog-from-git skill
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-10T04:30:44.882Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
agentType: dev-lead
disposition: new-head
planId: pl-mv1wc6mq-70228b
---
# Goal

doc: the blog-from-git skill has no guidance for images, although the post page renders captioned figures (`parseFigure` in src/lib/blogMarkdown.ts, served from /blog-images/<slug>/). Add a sub-skill file images.md describing how to capture 2-3 real screenshots of the live product and place them as figures, and wire it into SKILL.md's pipeline table and final self-check, so the next post rewrites follow it.

# Acceptance criteria

- [ ] New file .claude/skills/blog-from-git/images.md exists and covers: when (after Draft, before Approve), how many (2-3, max 4), real screenshots only of https://bilko.run or https://github.com pages captured with `pnpm tsx scripts/blog-video-capture.ts --shots <tmp>/shots.json --out <tmp>/shots` (never mockups or generated art), save path `public/blog-images/<slug>/<kebab-name>.jpg` matching FIGURE_SRC_RE in src/lib/blogMarkdown.ts, size cap 220 KB, exact syntax `![alt](/blog-images/<slug>/<file>.jpg "caption")` as its own paragraph placed right after the sentence it illustrates, alt describes the image, caption at most 20 plain words telling the reader what to notice, and a mandatory visual check (open each JPEG with the Read tool; reject blank, loading, cookie-banner or cropped-headline frames; at most 2 recapture rounds)
- [ ] images.md states that figures for an already-live post ship through a server/blog-rewrites/<slug>.ts entry whose content matches content/blog/<slug>.md, pointing at seed.md Gotchas
- [ ] SKILL.md pipeline table gains a row `5b | Illustrate` pointing at images.md with its gate, and the folder map lists images.md
- [ ] SKILL.md final self-check gains one line: every figure is a real screenshot, viewed, captioned, and its src matches /blog-images/<slug>/
- [ ] No other skill file is edited

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/images.md
- .claude/skills/blog-from-git/SKILL.md

# Implementation notes

Read first: .claude/skills/blog-from-git/SKILL.md (whole, 128 lines), .claude/skills/blog-video/SKILL.md lines 55-75 (section 3 Capture: the shots.json shape `{ name, url, scrollY?, waitMs?, actions?, record? }`, max 6 shots, allowlist), src/lib/blogMarkdown.ts lines 1-25, .claude/skills/blog-from-git/seed.md lines 78-89 (Gotchas: edits to live posts need server/blog-rewrites/).
Steps:
1. Write .claude/skills/blog-from-git/images.md in the same terse style as research.md / ground.md (headed sections, numbered steps, an Exit line). For stills only: do not use `record` (that is for video clips). Note that blog-video-capture.ts writes 1280x720 JPEGs capped by --max-bytes (use 220000).
2. Edit SKILL.md: add the 5b row between Draft (5) and Approve (6); add the self-check line; add images.md to the folder map.
Keep the whole images.md under 70 lines. Plain language.

# Out of scope

- Changing blog-video-capture.ts
- Writing or editing any post

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
