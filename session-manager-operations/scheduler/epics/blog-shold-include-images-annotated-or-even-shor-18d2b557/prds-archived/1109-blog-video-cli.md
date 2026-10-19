---
title: blog-video CLI: validate a video file and pick the next post without a video
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T21:32:23.655Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1he6ef-8b1bf4
---
# Goal

Primitive: a script the Blog Video macro uses to (1) choose which post gets a video next — the newest published post with no public/blog-videos/<slug>/index.html — and (2) validate a generated video document is self-contained, network-free, ≤2 MB and declares a 5-30 s duration, before it is committed and served from bilko.run.

# Acceptance criteria

- [ ] New scripts/blog-video.ts exports `validateBlogVideoHtml(html: string): { ok: boolean; errors: string[] }` that rejects: empty input; byte length > 2*1024*1024; every remote-reference and forbidden-API pattern copied from ~/Projects/session-manager/src/main/lib/projectHomeAdminRoutes.cjs lines 35-75 (REMOTE_REFERENCE_CHECKS plus the forbidden-API list, including fetch, XMLHttpRequest, WebSocket, import(, iframe/object/embed, window.open, eval, Function(, top./parent., location navigation); and a missing or out-of-range `<meta name="sm-demo-duration" content="N">` (integer 5..30).
- [ ] scripts/blog-video.ts exports `pickNextPost(posts: {slug: string; publishedAt: string}[], hasVideo: (slug: string) => boolean, now: Date): {slug: string; publishedAt: string} | null` returning the newest post with publishedAt <= now and no video, else null.
- [ ] CLI `pnpm tsx scripts/blog-video.ts next` loads posts via `loadSeededPosts()` from scripts/blog-cadence-gate.ts, checks public/blog-videos/<slug>/index.html existence, prints one JSON line `{"slug":...,"publishedAt":...}` or `{"slug":null}`, exit 0.
- [ ] CLI `pnpm tsx scripts/blog-video.ts validate <file>` prints `OK` and exits 0 on a valid file, else prints each error on its own line and exits 1; unknown subcommand prints usage and exits 2.
- [ ] tests/blog-video.test.ts covers: a minimal valid document passes; each of fetch(, <script src=, @import, top., missing duration meta, duration 31, >2MB fails with a matching error; pickNextPost skips posts with video, skips future-dated posts, returns null when all have video.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-video.ts
- tests/blog-video.test.ts

# Implementation notes

Read first: scripts/blog-cadence-gate.ts (exports loadSeededPosts at ~line 66, SeededPost type, and its CLI main-guard pattern); tests/blog-cadence-gate.test.ts (test style); ~/Projects/session-manager/src/main/lib/projectHomeAdminRoutes.cjs lines 30-125 (read-only reference: copy the regex lists verbatim into TS, keep their messages).

Steps:
1. Red: write tests/blog-video.test.ts importing the two pure functions.
2. Create scripts/blog-video.ts with the pure functions, then a CLI main guarded the same way blog-cadence-gate.ts guards its main (so importing in tests never runs the CLI or touches the DB).
3. Note the `\bFunction\s*\(` rule also matches the keyword `function (` — keep it (video authors must use arrow functions); mention this in the error message text.
Keep it Node-only, no new dependencies.

Do not touch: scripts/blog-cadence-gate.ts (import from it only), server/, src/.

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
