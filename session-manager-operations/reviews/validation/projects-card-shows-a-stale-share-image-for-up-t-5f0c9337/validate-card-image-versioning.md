# Validation: card image versioning plan

Base: 19b30e124b9ad1af27a414e4853caf70f3e731c4 (known). Commits: 04dd1fc1, 7d55b191, 6802503f, 959aa9ef, 5694ec88.
Gates re-run in the foreground: vitest (asset-versions, og-meta, og-routes, projects-view, project-catalog: 5 files, 64 tests pass), `pnpm typecheck` exit 0, `vite build` exit 0, harness run below.

## asset-versions-primitive — VERIFIED
- shared/asset-versions.ts:1-87 exports CardProject, toCardProject, LISTING_ASSET_KEYS, cardVersion, fileVersion, AssetVersions, buildAssetVersions; imports only crypto/fs/path.
- cardVersion (shared/asset-versions.ts:60-70) is the old projectVersion body (sha1 of [name, tagline, category], then icon, shareImage bytes, inside-dir guard, 8 hex). fileVersion :73-76 returns undefined for escaping/missing.
- server/og-meta.ts:19-20 `OgProject = CardProject`; :72 `raw.map(toCardProject)`; :82 projectVersion delegates, cache kept.
- og:image v= unchanged: ran a script reimplementing the base algorithm over all 30 registry entries against public/ and compared to buildAssetVersions cards: `projects 30 mismatch 0`.
- tests/asset-versions.test.ts: 5 tests pass.

## og-route-etag-revalidate — VERIFIED
- server/og-routes.ts:14-34 ifNoneMatch (exact, W/, list, *) and sendPng: ETag = quoted first 16 hex of sha1; 304 with etag/cache-control headers; max-age=86400 only for non-empty `v`, else 300.
- All three 200 paths (shareImage :51, generated cards :70) go through sendPng; 404 path untouched.
- tests/og-routes.test.ts: 20 tests pass (ETag, 304, stale, ?v=, ETag changes after rewrite).

## card-image-versioned-url — VERIFIED
- vite.config.ts:9-14,43 and vitest.config.ts:9-17 define __ASSET_VERSIONS__ from buildAssetVersions(registry, public/).
- src/data/assetVersions.ts: typeof guard, type-only import, cardImageUrl/assetUrl as specified.
- src/data/projectsView.ts:118 `thumbnail: cardImageUrl(p.slug)`.
- tests/projects-view.test.ts:37-48 asserts every project card thumbnail === `/og/<slug>.png?v=<v>` with v from resolveOg(...).image; passes, so every card v= equals its og:image v=.
- `vite build` exit 0.

## og-card-cache-harness — VERIFIED
- scripts/og-card-cache-harness.ts (189 lines) only touches scripts/. Fresh run printed: visit2 src changed, second /og request made, colour=blue; `CONTROL: stale as expected` (control, one request, red); `HARNESS: PASS`. Typecheck (includes scripts) exit 0.

## docs-card-image-versioning — VERIFIED
- docs/host-contract.md:230 states card URL `/og/<slug>.png?v=<hash>`, same hash as og:image, build-time from card copy plus icon and shareImage bytes, next visit after deploy.
- docs/host-contract.md:247 states ETag, max-age=86400 versioned, max-age=300 unversioned with 304 revalidation. Matches code above. No personal details.

## Findings
Critical: none.
Important: none.
Minor:
- vite.config.ts:11 and vitest.config.ts:11 duplicate the same registry-read/buildAssetVersions block; a shared helper would avoid drift.
- shared/asset-versions.ts reads files synchronously for ~30 entries at config load (acceptable; a large shareImage such as the 4.8 MB one is hashed twice per project: card and file).
- Review tooling: /code-review and /security-review not run; self-review found no secrets, and path-escape handling uses the existing resolve+prefix guard (shared/asset-versions.ts:46-48). `v` is only tested for non-emptiness, not reflected.
