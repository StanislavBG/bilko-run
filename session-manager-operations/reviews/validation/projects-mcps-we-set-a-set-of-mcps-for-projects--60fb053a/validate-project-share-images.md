# Validation: project share images (PRDs 1321-1326)

Base: 7dc9cf91eabaf4cc01a7dc2d831eb2daba68d844. PRD files read from `prds-archived/`.
Combined run: `pnpm test` = 101 files / 1127 tests passed; `pnpm typecheck` exit 0 (after `pnpm install --offline` in the worktree). Commits: 402067f, 54b0276, 885a1b4, 506d33d, bbe8098, 3f91aaf.

## listing-share-image-fields (1321) — VERIFIED
- `mcp-host-server/src/contract/registry.ts` `ProjectAssetPathSchema`: regex `^/projects/[a-z0-9-]+/...\.png$`, max 200, refine rejects `..` and `//`; used for `icon`/`shareImage`.
- `RegistrySchema` superRefine rejects non-own-slug prefix, message names slug and field.
- `server.ts` update_project_listing description mentions icon/shareImage, PNG in own bundle, square / 1200x630.
- tests/registry-contract.test.ts and tests/mcp-dist-sync.test.ts pass in the full run; dist rebuilt (`dist/gates/share-assets.js` present).

## og-custom-share-image (1322) — VERIFIED
- `server/og-assets.ts` `readProjectPng`: base-prefix check, size/signature/IHDR checks, null on error.
- `og-meta.ts` OgProject icon/shareImage + OgContext.staticRoot; `og-routes.ts` serves exactly 1200x630 with warn + fallback; `server/index.ts:115` passes `staticRoot: distPath`.
- tests/og-routes.test.ts pass (full run).

## publish-gate-share-assets (1323) — VERIFIED
- `gates/share-assets.ts` covers all listed failures and the pass-with-none case; registered in `GATES`; `GateContext.listing` added; `server.ts declaredShareAssets` prefers the bilko.listing.json patch, else registry.
- tests/mcp-share-assets-gate.test.ts and dist-sync pass.

## og-card-icon (1324) — VERIFIED
- `og-image.ts`: `iconPng`, 160x160 at x=960 (`ICON_X`), base64 data URI, cache key includes icon sha1.
- `og-routes.ts` loads icon with 512 KB cap, square + 128–1024 check; `og-meta.ts` `?v=` 8-hex sha1, memoized.
- tests/og-image.test.ts, og-meta.test.ts pass.

## catalog-share-image-url (1325) — VERIFIED
- `src/data/projectCatalog.ts:52,81` field set to `${SITE_ORIGIN}/og/<slug>.png`; header comment line 20 notes X unfurl; tests/project-catalog.test.ts passes.

## doc-share-images (1326) — VERIFIED
- docs/host-contract.md: resolution order (L201-202), `?v=` (L194), 4-step recipe and share-assets gate (L210-214), limits rows (L133-134), `share_image_url` (L547 area). Gate greps all exit 0.

## Findings

### Critical
- none

### Important
- none

### Minor
- `server/og-assets.ts:19` and `mcp-host-server/src/gates/share-assets.ts:22`: containment uses lexical `resolve`, not `realpath`. A symlink inside a published bundle pointing outside it would be followed. The publish path is operator-controlled, so risk is low; consider `realpathSync` on both ends. Lexical `..` traversal is blocked at schema, gate and reader (three layers), and slug is regex-validated in the route.
- `server/og-assets.ts:23` the `size > maxBytes` check is done on the fd (good, no TOCTOU); `og-meta.ts projectVersion` reads icon/shareImage with `readFileSync` and no size cap (only once per project, memoized, but an oversized file would be read fully). Low impact.
- `gates/share-assets.ts` accepts an asset path lacking the `/projects/<slug>/` prefix by stripping leading slashes, so the gate can pass a path the schema would reject; schema validation runs elsewhere, so not exploitable.
- `og-meta.ts` version memo is keyed on staticRoot and paths, not file mtime: a changed asset needs a server restart (a deploy does this) to change `?v=`.
