# Validation: projects-ring-og-image + projects-ring-og-publish

Base: a3d40ce (known). Local commit 487fff1; pushed equivalent 90757d6 is on origin/main.
Gates run from /home/bilko/Projects/Bilko (job worktree has no node_modules; main tree is at the same 487fff1).

## projects-ring-og-image — VERIFIED
- projectCard thumbnail: src/data/projectsView.ts:117 `/og/${p.slug}.png`; packageCard untouched (test asserts undefined).
- CSS: src/styles/projects-ring.css `.pr-shot:has(img){background:#1b1714}`, `.pr-shot img{object-fit:contain;object-position:center}`, mobile aspect-ratio 1200 / 630.
- vite.config.ts: `/og` proxy to localhost:4000 added beside `/api`.
- tests/projects-view.test.ts: new share-card thumbnail test; e2e/projects-hub.spec.ts: new hero test.
- Gate: typecheck exit 0; vitest 3 files / 38 tests pass; build exit 0; playwright projects-hub 5/5 pass (incl. new og test: src ends /og/<slug>.png, naturalWidth 1200, swaps on Next).
- Hero src vs live og:image (ignoring ?v=): session-manager → og:image https://bilko.run/og/session-manager.png?v=284803df, hero src /og/session-manager.png (match; live screenshot). sudoku → og:image /og/sudoku.png?v=d0af28c9, formula `/og/${slug}.png` (match; asserted for all cards by unit test). Both /og/*.png return 200 image/png live.

## projects-ring-og-publish — VERIFIED
- origin/main contains 90757d6 "feat(projects): ring hero shows the /og share card uncropped"; no `content-grade` push evidence.
- `tsx scripts/verify-live-marker.ts /og/` → OK, found in /assets/index-CH5scfS7.js (try 1/20), exit 0.
- Live 1440x900 screenshot of https://bilko.run/projects (/tmp/projects-live-og.png): hero shows the dark share card — "DEV TOOL · CLI", "Session Manager", "Local cockpit for Claude Code CLI sessions", "bilko.run" — uncropped, no striped placeholder.

## Findings
- Critical: none.
- Important: none.
- Minor: the e2e test's hard-coded 1200 naturalWidth assumes every card is a 1200px render; a project shareImage of another size would fail it (e2e/projects-hub.spec.ts:~93).
- Minor: local 487fff1 and origin 90757d6 are distinct SHAs for the same change (rebased duplicate, as the PRD anticipated).
