# Validation: Projects Ring plan

Base: c66fcacb56b4e3922866da5a0280d321e17a63a5. Local commits c3efd8d, deb8d79, d44a933, 564279b, 0ef575e. origin/main carries the rebased ring commits (414f02d, 50262e3, e101edf).
Re-run in this worktree (node_modules symlinked from the main checkout):
- `pnpm vitest run` on the ring, view, catalog and open-core tests: 54 passed.
- `pnpm test`: 103 files, 1155 tests passed.
- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.
- `pnpm exec playwright test e2e/projects-hub.spec.ts`: 3 passed.
- `tsx scripts/verify-live-marker.ts pr-stage --tries 2 --interval 5`: found in /assets/index-ByEpzuk2.js, exit 0.

## projects-ring-math — VERIFIED
- src/data/projectsRing.ts:11 ringOffset, :16 heroBox, :34 spineGeom, :66 tickStyle, :72 pad3, :6 RING_DOTS, :74 ringStats all exist and match the formulas in the PRD.
- HubCard `thumbnail` is added in src/data/projectsView.ts (+3 lines).
- tests/projects-ring.test.ts: 17 tests pass. tests/projects-view.test.ts and tests/project-catalog.test.ts pass.

## projects-ring-page — VERIFIED
- Evidence in src/pages/ProjectsPage.tsx: `SECTION 02 · PORTFOLIO` (:248), prev/next aria-labels (:261, :263), wheel listener with `{passive:false}` (:205), ResizeObserver (:193), story-panel wheel guard (:196), `.pr-hero` (:301), `aria-expanded` Full story (:327), `.pr-scrubber` (:341), page-scoped font link (:57).
- src/styles/projects-ring.css exists and is imported from src/index.css.
- Fidelity: checked by reading markup and CSS against the README and the e2e flow (counter, ticks, Open, Full story). I did not do a pixel comparison.
- Gate: typecheck, tests, build and Playwright all green.

## projects-ring-polish — VERIFIED
- aria-live="polite" on the hero (ProjectsPage.tsx:301).
- useSearchParams with a replace-mode setSearchParams (:130, :225).
- src/styles/projects-ring.css has a `prefers-reduced-motion` block (:74) and a `max-width: 900px` block (:79).
- `grep -rn 'pf-hub-(row|list|drawer|head|rail|caret)' src` returns nothing.
- The e2e spec covers the deep link, URL sync and the 390px viewport; all 3 tests pass.

## projects-ring-publish-live — VERIFIED
- origin/main contains the ring commits (rebased SHAs e101edf, 50262e3, 414f02d).
- The live marker check exits 0 against production.
- scripts/verify-live-marker.ts is committed locally (0ef575e) and has not been pushed yet. The PRD expects it to ride along with the next push.
- The screenshot criterion was not re-done here. The PRD asks for it in the dev run's report.

## Findings
### Critical
- none
### Important
- none
### Minor
- Local branch SHAs differ from origin/main because origin was rebased, so SHA lookups must use the subject lines.
- scripts/verify-live-marker.ts is not yet on origin/main.
- The `git diff` of the base range also includes unrelated sm-relay and registry commits, which are outside this plan.
- Code and security self-review of the ring diff: no secrets, no unsafe input handling and no path traversal found. `?p=` is only matched against known slugs, and the font link is a fixed Google Fonts URL.
