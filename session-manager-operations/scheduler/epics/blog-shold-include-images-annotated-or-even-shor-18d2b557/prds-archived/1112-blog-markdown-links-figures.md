---
title: Blog renderer: clickable links and annotated image figures
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T21:33:27.624Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
dependsOn: [blog-video-player]
planId: pl-mv1hf1a8-bb6a82
---
# Goal

Behavior: posts need annotated images (an image plus a caption explaining what to look at), and the current renderer in BlogPostPage.tsx also silently shows markdown links `[text](url)` as raw text even though every post is required to contain full https links. Move the block/inline parsing into a tested module that renders links, and a block-level image with a caption as a figure.

# Acceptance criteria

- [ ] New src/lib/blogMarkdown.ts exports `parseFigure(block: string): { src: string; alt: string; caption: string } | null` for a block that is exactly `![alt](src "caption")` (caption optional); src must match /^\/blog-images\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif|svg)$/ else null.
- [ ] src/lib/blogMarkdown.ts exports `splitInlineLinks(text: string): Array<{ type: 'text'; value: string } | { type: 'link'; text: string; href: string }>`; only `https://` hrefs and site paths starting with a single `/` become links, anything else (javascript:, data:, //host) stays text.
- [ ] src/pages/BlogPostPage.tsx: renderInline renders links as `<a>` (external https: target=_blank rel="noopener noreferrer"; fire-600 underline style) while keeping existing bold and inline-code handling; links inside bullet-list items render too.
- [ ] src/pages/BlogPostPage.tsx: a figure block renders `<figure>` with `<img loading="lazy" alt>` (rounded, bordered, full width) and a `<figcaption>` in small warm-500 text when caption is set; the stale comment claiming links are handled is now true.
- [ ] tests/blog-markdown.test.ts covers parseFigure (valid with/without caption, external URL rejected, path traversal rejected) and splitInlineLinks (https link, site path, javascript: rejected, text around links preserved, multiple links in one line).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/lib/blogMarkdown.ts
- src/pages/BlogPostPage.tsx
- tests/blog-markdown.test.ts

# Implementation notes

Read first: src/pages/BlogPostPage.tsx (all — renderContent ~line 61-91, renderInline ~93-109; a sibling PRD that landed before this one added a BlogVideoPlayer import/render — keep it intact); server/db.ts around line 1095-1110 (a real seeded post body with `[OutdoorHours](/projects/outdoor-hours)` links) for realistic test strings.

Steps:
1. Red: tests/blog-markdown.test.ts against the two pure functions.
2. Create src/lib/blogMarkdown.ts (pure, no React).
3. BlogPostPage: in renderContent, check parseFigure before the paragraph fallback; in renderInline, apply splitInlineLinks to each non-bold/non-code text segment.
Images are same-origin only (site CSP img-src allows 'self'); they will live under public/blog-images/<slug>/. Producing images is out of scope.

Do not touch: src/components/BlogVideoPlayer.tsx, server/, scripts/.

# Out of scope

- Generating or uploading images
- Full markdown library adoption

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-markdown.test.ts tests/blog-video-player.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
