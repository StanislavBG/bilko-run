---
title: Blog Video skill: make it the macro's system of record and feed it the blog DAG outputs
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-10T16:41:54.647Z
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: feature
agentType: dev-lead
disposition: new-head
planId: pl-mv2mggrb-647c67
---
# Goal

doc: bring `.claude/skills/blog-video/SKILL.md` up to date with the new blog-from-git content DAG, and make it the stated system of record for the Session Manager "Blog Video" HOT KEYS macro. Today the skill picks its "you can" moments by guessing the post's emphasis, and it ignores the DAG's per-post artifacts. Those artifacts are the `outline.json` sections and figure fields under the gitignored drafts folder, and the real screenshots under `public/blog-images/<slug>/`.

# Acceptance criteria

- [ ] Near the top of `.claude/skills/blog-video/SKILL.md`, a 'System of record' note says three things: this file is the single source of truth for the Blog Video macro; the macro's prompt only points here; and behaviour changes go in this file, never in the macro text.
- [ ] Step 2 Ground checks for `/home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/<slug>/outline.json`. When it exists, the step uses its sections (heading + point) and `figure` fields to choose the 'you can' moments and their captures, and `evidence.json` to confirm each claim. When it is missing, the step falls back to the post's emphasis exactly as today.
- [ ] Step 3 Capture says that when `public/blog-images/<slug>/` exists, its committed screenshots show which screens the post emphasises and should guide the shot list. Fresh captures via `scripts/blog-video-capture.ts` are still required, because those screenshots are stills and the moments need motion clips.
- [ ] The Story spine or Step 2 says every scene `source` must be a verbatim PROSE sentence of the post. Figure lines (`![alt](src "caption")`) and their alt or caption text never count as a source.
- [ ] The Closing beat uses the post's one primary project link, the same `https://` URL the post itself links to. Every other existing step, exit line, command and the example storyboard stay unchanged.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-video/SKILL.md

# Implementation notes

Work in /home/bilko/Projects/Bilko.

Read first:
- `.claude/skills/blog-video/SKILL.md` (whole, about 176 lines).
- `.claude/skills/blog-from-git/dag.md` (the artifact schemas: `outline.json` sections have `id`, `heading`, `point`, `evidence_ids` and an optional `figure`; `evidence.json` items have `id`, `claim` and `source`).
- `.claude/skills/blog-from-git/images.md` lines 1-30.

Keep the edit small and in the file's existing voice: plain English, numbered steps, a bold **Exit:** line per step. The drafts folder is gitignored and lives only in the main checkout at the absolute path above, so say that the outline may be absent (older posts) and the fallback is normal.

Do not touch: `scripts/` and `tests/` (no code change; the validator already checks that sources appear in the post), `.claude/skills/blog-from-git/`, and `public/`. Commit only `.claude/skills/blog-video/SKILL.md`.

# Out of scope

- Editing the HOT KEYS macro (done separately via macro_save)
- Changing blog-video scripts or the validator
- Building any video

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-video.test.ts tests/blog-video-build.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
