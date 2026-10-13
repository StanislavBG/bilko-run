# Validation: projects metadata plan

Base: 7dc9cf91eabaf4cc01a7dc2d831eb2daba68d844 (known). Commits: bb6378e (1312), 7d34cbf (1314), d7ace43 (1315), 0027176 (1317), 8355410 (1319).
Cross-PRD run: `pnpm test` -> 100 files, 1099 tests passed (includes mcp-dist-sync, registry-contract, project-catalog, projects-view). `pnpm typecheck` exit 0. `vite build` ok. `playwright e2e/projects-hub.spec.ts` 1 passed. The worktree had no node_modules; I symlinked the main tree's (gitignored, not committed).

## 1312 listing-marketing-fields — VERIFIED
- Schema: mcp-host-server/src/contract/registry.ts:39-62 — enums, callToAction 1-120, avoidClaims max 5 x 1-200, still `.strict()`; existing registry validates (suite green).
- Banned-term scan: registry.ts:103-107 covers callToAction and avoidClaims[i].
- Tool description: mcp-host-server/src/server.ts:282 lists the four keys plus the promoter sentence.
- Tests: tests/registry-contract.test.ts (+44 lines, 41 tests pass).
- dist rebuilt: mcp-host-server/dist/contract/registry.js and dist/server.js in diff; mcp-dist-sync passes.
- Gate: vitest set + typecheck green.

## 1314 projects-row-open-button — VERIFIED
- src/pages/ProjectsPage.tsx:84-112: `.pf-hub-headrow` wraps toggle button and sibling `.pf-hub-open` (no nesting); label `Open →` / `GitHub →` for package; hidden when no href or postponed; calls existing `open()`.
- Drawer `.pf-hub-primary` removed (ProjectsPage.tsx ~131); npm/github/Web Remote links kept. Lede updated (line 181).
- CSS: portfolio.css `.pf-hub-headrow/.pf-hub-open` plus 900px breakpoint rule.
- e2e/projects-hub.spec.ts covers visible Open, aria-expanded before/after hover, toggle click, URL navigation. Passed.
- Gate: typecheck, vite build, playwright green. The 375px no-overflow criterion has no automated check (read only).

## 1315 catalog-marketing-fields — VERIFIED
- src/data/projectsView.ts:62-69,111-114 HubCard + projectCard copy; packageCard untouched.
- src/data/projectCatalog.ts:41-48, 73-76, 87: snake_case fields, '' / [] defaults, avoid_claims deep copy; schema_version unchanged; header comment mentions Burrow must honor avoid_claims (lines 17-19).
- tests/project-catalog.test.ts updated (+21); passes.
- Gate: vitest + typecheck green.

## 1317 projects-admin-metadata-panel — VERIFIED
- src/data/projectMetadata.ts: `projectMetadataRows` with all required keys; listing keys iterated from `ListingSchema.keyof().options`; talkingPoints/avoidClaims newline-joined, other arrays ' · ', missing flagged.
- tests/projects-view.test.ts:50-66 covers git-viewer rows for every listing key and missing `listing.offering`.
- ProjectsPage.tsx:41-57,144: `MetadataPanel` rendered only when `isAdmin && card.type === 'project'`; `<dl className="pf-hub-meta">`, "— not set" dimmed.
- portfolio.css `.pf-hub-meta*` two-column grid, mono keys, wrapping, single column at 900px.
- e2e asserts `.pf-hub-meta` count 0 for anonymous. Passed.
- Gate: vitest, typecheck, vite build, playwright green.

## 1319 doc-listing-marketing-fields — VERIFIED
- docs/host-contract.md: Project row (line 107), limits rows (129-132), example (148-150), "Marketing meta-categories" subsection with showcase/saas definitions and avoidClaims rule, catalog example + additive-under-schema_version-1 note.
- Gate grep chain printed OK.

## Findings
Critical: none.
Important: none.
Minor:
- ProjectsPage.tsx:41-57 / MetadataPanel: admin gating is client-side only; safe because the registry JSON is already in the public bundle (PRD notes this). No secrets involved.
- e2e/projects-hub.spec.ts: the admin panel render path (isAdmin true) has no browser test, only the unit test of the row builder; 375px layout also unchecked.
- src/data/projectMetadata.ts:~27: `host` cast and `(p as {launchedAt?})` bypass types; harmless but could break silently if Project shape changes.
- Security self-review: no new input handling, SQL, paths or secrets in this diff; text renders through React (no HTML injection). The `/security-review` and `/code-review` skills were not run; I reviewed the diff by hand.
