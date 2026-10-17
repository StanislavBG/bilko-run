# Validation: blog-list-video-badge-one-line

Base: d161d3c306fc58cc88a73bb4f42b4eed6f56893f. Commit: 92a8d03 (touches only BlogPage.tsx, portfolio.css, e2e/blog-list.spec.ts).

## blog-list-video-badge-one-line — VERIFIED

- AC1 (no inline style, class `pf-video-badge`, text `▶ Video`): src/pages/BlogPage.tsx:77 `<span className="pf-mono pf-video-badge">▶ Video</span>`.
- AC2 (`.pf-tag` flex column, start-aligned, ~6px gap): src/styles/portfolio.css:394 `display:flex; flex-direction:column; align-items:flex-start; gap:6px`.
- AC3 (badge nowrap, inline-block, pill look, no left margin): portfolio.css:395 `display:inline-block; white-space:nowrap; padding:1px 6px; border-radius:999px; border:1px solid currentColor; font-size:10px`; no margin. Selector is `.portfolio-shell .pf-video-badge` (deliberate, to beat `.portfolio-shell .pf-mono` font-size).
- AC4 (mobile hide still wins): portfolio.css:591 `.pf-post-row .pf-tag, ... {display:none}` in the 900px media block; same specificity as line 394 and later in the file, so it wins.
- AC5 (new e2e spec): e2e/blog-list.spec.ts mocks `**/api/blog` with a bare array (matches BlogPage.tsx:47 `Array.isArray(d)`), 1280x800, asserts text, height <20, badge top below label bottom, and no badge on the no-video row.
- AC6 gates re-run: `pnpm typecheck` — clean (tsc client/server/scripts, no errors); `npx playwright test e2e/blog-list.spec.ts` — 1 passed.

## Findings

Critical: none. Important: none.

Minor:
- e2e/blog-list.spec.ts:40 stacking check uses `labelBottom - 1` tolerance; fine, but the narrow-screen (<900px) hiding is not covered by a test (cascade verified by reading only).
- Deviation from PRD: selector is `.portfolio-shell .pf-video-badge` rather than `.pf-video-badge`; justified and documented.

Reviews: /code-review and /security-review not run as separate tools; self-reviewed the diff (CSS/markup only, no input handling, secrets, or paths).
