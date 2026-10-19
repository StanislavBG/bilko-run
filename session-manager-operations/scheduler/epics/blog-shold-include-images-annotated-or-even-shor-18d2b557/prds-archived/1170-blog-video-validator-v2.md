---
title: Video validator: 4 MB cap for clips, voice marker, read posts from content/blog
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-10T02:02:35.727Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1r1npr-9a7229
---
# Goal

Behavior: real motion clips need more room than 2 MB (videos are click-to-load, so page weight is unaffected until the reader presses play), and the validator could not confirm which narration voice was used. Raise the cap, require a voice marker, and add a grounding check that every claim's source sentence really appears in the post file (posts now live in content/blog/<slug>.md, not server/db.ts).

# Acceptance criteria

- [ ] scripts/blog-video.ts: MAX_VIDEO_BYTES is 4 * 1024 * 1024; validateBlogVideoHtml additionally requires `<meta name="blog-video-voice" content="...">` with a non-empty value.
- [ ] scripts/blog-video.ts exports `checkClaimsGrounded(html: string, postMarkdown: string): string[]` that parses `<script type="application/json" id="blog-video-claims">` ([{sceneId, source}]) and returns an error per claim whose source (whitespace-collapsed, markdown links `[t](u)` reduced to `t`, case-sensitive) is not a substring of the post body or title after the same normalization; missing claims block is an error.
- [ ] CLI `validate <file> [--post content/blog/<slug>.md]` also runs checkClaimsGrounded when --post is given, and prints each error; exit codes unchanged.
- [ ] tests/blog-video.test.ts: existing tests updated for the new meta + cap; new tests for 3.9 MB passes / 4.1 MB fails, missing voice meta fails, a grounded claim passes, a paraphrased claim fails, a claim matching only after link-stripping passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-video.ts
- tests/blog-video.test.ts

# Implementation notes

Read first: scripts/blog-video.ts (all, 129 lines); tests/blog-video.test.ts; content/blog/twelve-places-one-weather-rule-you-set-yourself.md (post format: YAML frontmatter with title, then markdown body); server/blog-posts.ts lines 1-80 (how frontmatter is parsed — reuse its parser if it is exported, else a minimal frontmatter split).

Note: the two currently committed videos lack the voice meta and will fail the new rule — that is expected; sibling PRDs regenerate both. Do not edit them.

Do not touch: public/, scripts/blog-video-capture.ts, scripts/blog-video-runtime.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-video.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
