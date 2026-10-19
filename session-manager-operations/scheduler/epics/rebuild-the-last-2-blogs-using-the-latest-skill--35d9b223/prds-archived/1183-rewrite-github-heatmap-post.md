---
title: Rewrite the GitViewer post with the blog-from-git skill, plus real screenshot figures
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-10T04:32:14.364Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
agentType: dev-lead
dependsOn: [1177-blog-readability-figure-aware, 1179-blog-skill-illustrate-step]
planId: pl-mv1waavv-83d93c
---
# Goal

doc: rewrite the live post content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md (GitViewer, published 2026-10-03) from scratch by running the current blog-from-git skill as a best-effort test of it, and add 2-3 real screenshot figures using the skill's new Illustrate step (images.md). The subject stays GitViewer; slug, published_at, order and category stay unchanged. This PRD only writes the markdown file and the images; a later PRD ships it to the live database.

# Acceptance criteria

- [ ] content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md has a newly written title (under 60 chars), excerpt and body; frontmatter slug, published_at (2026-10-03T16:08:44.000Z), order (42), category and published are unchanged
- [ ] The body passes every line of the final self-check in .claude/skills/blog-from-git/SKILL.md (tone from voice.md named in the report; opening names the coolest thing a reader can do; primary link https://bilko.run/projects/git-viewer/ ; open-source claim links https://github.com/StanislavBG/git-viewer ; every number traced to a source actually read)
- [ ] public/blog-images/turn-your-github-year-into-a-heatmap-and-badge-wall/ holds 2-4 real 1280x720 JPEG screenshots of https://bilko.run/projects/git-viewer/ (or its GitHub repo), each under 220 KB, each viewed with the Read tool and free of blank/loading/cropped frames
- [ ] Each image is referenced exactly once in the body as its own paragraph `![alt](/blog-images/turn-your-github-year-into-a-heatmap-and-badge-wall/<file>.jpg "caption")`, right after the sentence it illustrates
- [ ] The final report lists: tone, every number with its source, each figure with its post sentence, and any skill step that was unclear or did not fit a rewrite (this run is a test of the skill)

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md
- public/blog-images/turn-your-github-year-into-a-heatmap-and-badge-wall/

# Implementation notes

Read first: .claude/skills/blog-from-git/SKILL.md (whole), .claude/skills/blog-from-git/images.md (whole, landed by PRD blog-skill-illustrate-step), .claude/skills/blog-from-git/voice.md, .claude/skills/blog-from-git/ground.md. Then the current post content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md.
Steps:
1. Mode: Spotlight-style rewrite of an existing post, owner override of rotation (phase 1 rotation does NOT apply; do not add a ledger row; do not edit blog-ledger.md). Run phase 2 Scan scoped to the git-viewer repo only (GitHub StanislavBG/git-viewer via `gh`, plus a local checkout under ~/Projects if one exists) to pick up anything shipped up to today, phase 3-4 Research and Ground against the live page https://bilko.run/projects/git-viewer/, its registry entry in src/data/standalone-projects.json, the repo README and source. Live numbers (streaks, repo counts) must be re-read today, not copied from the old post. Reading the sibling repo is fine; never edit it.
2. Phase 5 Draft per voice.md: one tone, within its length target, plain ~8th-grade English, full https links (readers are early-college; cool side first).
3. Phase 5b Illustrate per images.md: write shots.json in a `mktemp -d` dir, run `pnpm tsx scripts/blog-video-capture.ts --shots <tmp>/shots.json --out <tmp>/shots --max-bytes 220000`, view every JPEG with Read, copy the keepers into public/blog-images/turn-your-github-year-into-a-heatmap-and-badge-wall/ with kebab-case names. At most 2 recapture rounds; if still bad, ship fewer figures (minimum 2) and say so.
4. Run `npx tsx scripts/blog-readability.ts content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md --check-live` and fix until it exits 0 (at most 4 rounds, else HALT with the output).
Do not touch: server/blog-rewrites/ (later PRD), content/blog/twelve-places-one-weather-rule-you-set-yourself.md (sibling PRD), public/blog-videos/. Do not push; commit only the md file and the image folder.

# Out of scope

- Shipping to the live DB (server/blog-rewrites)
- Video
- blog-ledger.md / rotation state
- Editing the git-viewer repo

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 npx tsx scripts/blog-readability.ts content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md --check-live
timeout 300 pnpm vitest run tests/blog-posts-loader.test.ts tests/blog-markdown.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
