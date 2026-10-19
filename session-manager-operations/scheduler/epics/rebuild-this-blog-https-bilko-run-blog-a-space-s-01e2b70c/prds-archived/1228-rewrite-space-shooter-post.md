---
title: Rewrite the Escape Velocity space-shooter post with the latest blog-from-git DAG, plus real gameplay figures
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-11T01:31:42.103Z
sourcePromptId: rebuild-this-blog-https-bilko-run-blog-a-space-s-01e2b70c
agentType: dev-lead
planId: pl-mv35ds46-72e8e1
---
# Goal

doc: rewrite the live post content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md (Escape Velocity, published 2026-09-26) from scratch by running the current blog-from-git skill end to end, including its six-step content DAG (dag.md) and Illustrate step (images.md). The owner wants a COOL, share-worthy post that can go viral: lead with the most surprising, playable thing (a full space-survivors game across Sol's eight planets in a browser tab, with the 43.4 MB to 14.6 MB shrink as the hook number), short punchy sections, real gameplay screenshots. Slug, published_at, order and category stay unchanged; a later PRD ships it live.

# Acceptance criteria

- [ ] The DAG artifacts exist under the absolute main-checkout folder /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/ : questions.json, evidence.json, outline.json, renditions/linkedin.md and renditions/x.md, in the exact shapes from .claude/skills/blog-from-git/dag.md. None of them are committed.
- [ ] npx tsx scripts/blog-pipeline-check.ts /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/a-space-shooter-shrank-66-percent-to-fit-in-your-browser content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md exits 0.
- [ ] content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md has a newly written title (under 60 chars, curiosity-driven, still truthful), excerpt and body. Frontmatter slug, published_at (2026-09-26T19:00:00.000Z), order (41), category (product) and published are unchanged.
- [ ] The body passes every line of the final self-check in .claude/skills/blog-from-git/SKILL.md. The opening sentence names the coolest thing a reader can do right now. The one primary link is the full URL https://bilko.run/projects/escape-velocity/ (no relative link). No open-source or repo link is claimed, because starry-night-2 has no GitHub remote. Every number traces to an evidence.json item.
- [ ] public/blog-images/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/ holds 2-4 real 1280x720 JPEG screenshots of https://bilko.run/projects/escape-velocity/ (at least one mid-gameplay, not only the title screen), each under 220 KB and viewed with Read, free of blank/loading/cropped frames. Each is referenced exactly once as its own paragraph ![alt](/blog-images/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/<file>.jpg "caption"), chosen from an outline.json section's figure field.
- [ ] The final report has: the tone chosen and why it suits a share-worthy post; the pipeline-check JSON summary; every number with its source; each figure with its post sentence; the LinkedIn and X renditions pasted verbatim; every skill/DAG step that was unclear or did not fit a rewrite.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md
- public/blog-images/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/

# Implementation notes

Work in /home/bilko/Projects/Bilko.

Read first:
- .claude/skills/blog-from-git/dag.md (whole: the recipe and artifact schemas)
- .claude/skills/blog-from-git/SKILL.md (whole)
- .claude/skills/blog-from-git/voice.md, research.md, ground.md, images.md
- the current post content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md and server/blog-rewrites/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.ts (the live text from the 2026-10-03 readability rewrite, commit 81b409b)

Mode: owner-requested rewrite of an existing post. Phase 1 Rotation does NOT apply: add no ledger row and do not edit blog-ledger.md.

Steps:
1. Scan, scoped to Escape Velocity only: the local repo ~/Projects/starry-night-2 (README, CLAUDE.md, docs, git log; read only, never edit; it has no GitHub remote, so skip gh) for what the game is and anything shipped since 2026-09-26 (e.g. new bosses, the FROST HELL / frostball work on 2026-10-04). Also the escape-velocity entry in src/data/standalone-projects.json and the live page https://bilko.run/projects/escape-velocity/. Re-verify the 43.4 MB -> 14.6 MB numbers against a real source (commit, build output, or the served bundle size via curl -sI) before using them; if they cannot be re-verified, cite the original post's commit as the source and say so.
2. Run the DAG (3a Decompose, 3b Gather, 5a Outline, 5b Write, 5c Compose). Burrow-brain community evidence (browser games / wasm / Godot web export) is optional per ground.md floors; if unreachable, skip and say so.
3. Virality, inside the skill's rules (do not invent facts or hype): hook in the first sentence is the playable thing plus the surprising number; title is a curiosity gap that stays true; each section earns one 'huh, cool' fact; the close tells the reader exactly what to try first in the game (e.g. which planet or boss). Renditions: X under 280 chars with the full https link; LinkedIn 120-250 words. Do not post them anywhere.
4. Write artifacts into the ABSOLUTE main-checkout drafts folder above (mkdir -p), not the job worktree.
5. Illustrate per images.md: write shots.json in a mktemp -d dir, run pnpm tsx scripts/blog-video-capture.ts --shots <tmp>/shots.json --out <tmp>/shots --max-bytes 220000. The game is keyboard-only: for gameplay shots, focus the canvas and send key presses (start + arrow/WASD movement) and wait a few seconds before capture. View every JPEG with Read. At most 2 recapture rounds; if gameplay never renders headless, ship the best real frames (minimum 2) and say so.
6. Run npx tsx scripts/blog-readability.ts content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md --check-live and the pipeline check; fix and re-run each at most 4 rounds, else HALT with the output.
7. Commit exactly content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md and public/blog-images/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/. Do not push.

Do not touch: server/blog-rewrites/ (next PRD), public/blog-videos/, blog-ledger.md, the starry-night-2 repo, skill docs and scripts (report problems instead).

# Out of scope

- Shipping to the live DB (server/blog-rewrites)
- Video
- Editing skill docs or scripts
- Posting the renditions anywhere
- Editing the starry-night-2 repo

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 npx tsx scripts/blog-pipeline-check.ts /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/a-space-shooter-shrank-66-percent-to-fit-in-your-browser content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md
timeout 120 npx tsx scripts/blog-readability.ts content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md --check-live
timeout 300 pnpm vitest run tests/blog-posts-loader.test.ts tests/blog-markdown.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
