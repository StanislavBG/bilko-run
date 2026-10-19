---
title: Consistent BlogVideoPlayer on blog posts + Video badge on the blog list
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T21:33:03.680Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1hf1a8-bb6a82
---
# Goal

Behavior: one reusable player component every blog video plays in, so all videos look the same regardless of who generated them. The API (sibling PRD) returns `video_url` (e.g. `/blog-videos/<slug>/`) or null per post; when present, the post page shows the player between the header and the body, and the /blog list marks the post with a small Video badge.

# Acceptance criteria

- [ ] New src/components/BlogVideoPlayer.tsx exports `BlogVideoPlayer({ src, title }: { src: string; title: string })` and `isSafeBlogVideoUrl(src: string): boolean` (true only for /^\/blog-videos\/[a-z0-9-]+\/$/); the player renders nothing when the URL is unsafe.
- [ ] BlogVideoPlayer initially renders a 16:9 poster button (post title, a play icon, label `Watch the 30-second version`) and NO iframe; after click it renders `<iframe src={src} sandbox="allow-scripts" allow="autoplay; fullscreen" title={`Video: ${title}`}>` filling the same 16:9 frame (never allow-same-origin). Below the frame: caption `30-second video version of this post` and an `Open in new tab` link to src (target=_blank, rel=noopener).
- [ ] src/pages/BlogPostPage.tsx: FullPost has `video_url?: string | null`; when set, renders `<BlogVideoPlayer src={post.video_url} title={post.title} />` after the header and before the content.
- [ ] src/pages/BlogPage.tsx: list item type has `video_url?: string | null`; posts with one show a small `▶ Video` pill beside the category pill.
- [ ] tests/blog-video-player.test.ts (node env, react-dom/server renderToStaticMarkup like tests/session-manager-windows-download.test.ts) asserts: initial markup has the poster label and no `<iframe`; isSafeBlogVideoUrl accepts `/blog-videos/a-b-1/` and rejects `https://evil.test/x/`, `/blog-videos/../x/`, `javascript:alert(1)`; unsafe src renders empty markup.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/components/BlogVideoPlayer.tsx
- src/pages/BlogPostPage.tsx
- src/pages/BlogPage.tsx
- tests/blog-video-player.test.ts

# Implementation notes

Read first: src/pages/BlogPostPage.tsx (all, 161 lines — header ~line 122-133, content ~136); src/pages/BlogPage.tsx (85 lines — category pill markup); tests/session-manager-windows-download.test.ts lines 1-30 (renderToStaticMarkup pattern in node env).

Steps:
1. Red: write tests/blog-video-player.test.ts.
2. Create the component with useState(false) for `playing`. Style with existing Tailwind tokens used on these pages (warm-*, fire-*): outer `my-8`, frame `relative w-full aspect-video rounded-2xl overflow-hidden bg-warm-900 shadow`, poster as a full-size `<button type=button>` with a centered round fire-500 play disc and the title in white; iframe `absolute inset-0 w-full h-full border-0`. Add aria-label on the poster button (`Play video: <title>`).
3. Wire into BlogPostPage and BlogPage as described. Do not change renderContent/renderInline (a sibling PRD rewrites those after this one).
Videos carry their own internal play/pause/progress controls; the player is the consistent outer frame + click-to-load, so nothing loads until the reader asks (keeps the page fast).
Visual check: if feasible within the time budget, run `pnpm dev` is NOT required — the validator takes screenshots.

Do not touch: server/, scripts/, src/lib/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-video-player.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
