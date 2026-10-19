---
title: Blog list: keep the ▶ Video badge on one line, stacked under the category
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-17T23:37:37.597Z
sourcePromptId: blog-post-tile-blog-post-tile-the-test-of-video--15774a58
tag: bug
agentType: dev-lead
planId: pl-mvd1e1j1-497c80
---
# Goal

behavior: On /blog each post row's tag column is a fixed 100px grid track (`.pf-post-row` grid-template-columns `100px 1fr 100px 80px`). The `▶ Video` pill is rendered inline after the category label ("PRODUCT") with an inline style and no `white-space: nowrap`, so it wraps onto a second line and also breaks inside the pill: "▶" stays on line 1 and "VIDEO" drops to line 2, which looks clipped. Fix it so the category label and the Video badge stack as a column (label on top, badge below) and the badge always stays on a single line.

# Acceptance criteria

- [ ] src/pages/BlogPage.tsx: the Video badge `<span>` no longer has an inline `style` prop. It uses a new class `pf-video-badge` instead, and its text stays `▶ Video`.
- [ ] src/styles/portfolio.css: `.pf-post-row .pf-tag` lays out as a flex column with items aligned to the start (left) and a small gap (~4-6px), so the category label sits above the badge.
- [ ] src/styles/portfolio.css: `.pf-video-badge` has `white-space: nowrap`, `display: inline-block` and the existing look (padding 1px 6px, border-radius 999px, 1px solid currentColor border, font-size 10px). It has no left margin.
- [ ] The mobile rule at the @media block (`.pf-post-row .pf-tag { display: none }`) still hides the tag column on narrow screens. The `display: flex` rule must not override it, so check the cascade and specificity.
- [ ] New e2e/blog-list.spec.ts: it mocks `**/api/blog` with `page.route`, returning 2 posts (one `category: 'product'` with `video_url: '/blog-videos/x/'`, one without a video), and visits `/blog` at a 1280x800 viewport. It asserts: (a) the `.pf-video-badge` has text `▶ Video`; (b) the badge's boundingBox height is under 20px, so it is a single line; (c) the badge's top is greater than the category text's bottom, so it is stacked in a column; (d) the row without video_url renders no `.pf-video-badge`.
- [ ] `pnpm typecheck` and `npx playwright test e2e/blog-list.spec.ts` both pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/BlogPage.tsx
- src/styles/portfolio.css
- e2e/blog-list.spec.ts

# Implementation notes

Bug evidence: screenshot of /blog at ~1250px wide. The tag column shows "PRODUCT (▶" on line 1 and "VIDEO)" on line 2.

Read first:
- src/pages/BlogPage.tsx lines 40-95 (fetch of `${API}/blog`, row markup; badge at ~76-83)
- src/styles/portfolio.css lines 380-397 (.pf-post-row rules) and 585-592 (mobile media query)
- e2e/projects-hub.spec.ts (spec style) and playwright.config.ts (webServer `pnpm dev` on :3002, reuseExistingServer)
- Check the shape of the `/api/blog` response in BlogPage.tsx so the mock matches. If the fetch expects `{ posts: [...] }` or a bare array, mirror that exactly. Include title, slug, excerpt, category, published_at and video_url.

Steps:
1. Write e2e/blog-list.spec.ts first and run it to see it fail (red), capturing the output per standards §11.
2. BlogPage.tsx: replace the inline-styled span with `<span className="pf-mono pf-video-badge">▶ Video</span>`.
3. portfolio.css: next to the existing `.pf-post-row .pf-tag` rule, add `display: flex; flex-direction: column; align-items: flex-start; gap: 6px;`. Add a `.pf-video-badge` rule. Confirm the @media rule `display: none` still wins: it comes later in the file with the same specificity, so it should. Verify it anyway.
4. Run the gate last.

Keep the 100px grid track as is; the column layout makes it fit. Do not touch the post page player (src/components/BlogVideoPlayer.tsx). Tests must not hit production bilko.run.

# Out of scope

- Changing grid column widths or the mobile layout
- BlogPostPage / BlogVideoPlayer
- Category label text

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 240 npx playwright test e2e/blog-list.spec.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
