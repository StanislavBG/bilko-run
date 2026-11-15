# Validation: card video plan (listing.video)

Base: 19b30e124b9ad1af27a414e4853caf70f3e731c4. Plan commits: 3cfe4dc1, 79104d12, b8aa9888, a8b48a39, f6c403aa, 04003f75.
Gates re-run on HEAD: `pnpm vitest run` over the 10 plan test files: 10 files, 199 tests, all pass. `pnpm typecheck`: clean. `vite build --outDir /tmp/card-video-url-build`: exit 0.
Not validated, by design: card-asset-version-helper (1760), card-video-view (1761), withdrawn and archived. `scripts/card-asset-version.ts` does not exist.
Review commands (/code-review, /security-review): self-reviewed instead (not run as a skill).

## listing-video-schema: VERIFIED
- registry.ts:58-62 ProjectVideoPathSchema (max 200, mp4|webm regex, no `..` or `//`); :78 `video` in ListingSchema; :151 prefix loop includes 'video'.
- gates/index.ts:10 widened; server.ts:411-419 declaredShareAssets returns video; server.ts:353 tool description names video, own bundle, muted loop, poster, PNG previews.
- tests/mcp-listing-patch.test.ts (26 pass) and tests/mcp-dist-sync.test.ts pass.

## listing-video-gate: VERIFIED
- share-assets.ts:9 VIDEO 8 MB; checkVideo :27-36 gives 'not an MP4' / 'not a WebM' / 'is N bytes, over the 8 MB limit'; readHead :14-24 reads 12 bytes via openSync/readSync.
- declaredAssets :78 iterates video; validShareAssetFiles includes it; budget.ts comment-only change.
- tests/mcp-share-assets-gate.test.ts 25 pass; dist in sync.

## card-video-url: VERIFIED
- shared/asset-versions.ts:18 LISTING_ASSET_KEYS includes 'video'; buildAssetVersions :78-85 puts the declared path into files. cardVersion and og:image hash untouched.
- projectsView.ts:73-74 field with doc comment; :121 `assetUrl(p.listing.video)`; one hashing implementation (no scripts/card-asset-version.ts).
- tests/asset-versions.test.ts and tests/projects-view.test.ts pass; vite build ok.

## card-video-shot: VERIFIED
- ProjectCardShot.tsx: `<video>` with src, poster, muted, loop, playsInline, autoPlay, preload=auto, aria-label, no controls; ref effect sets muted then play() with catch; onError falls back to `<img>`.
- useAllowCardMotion starts false, checks reduced-motion and saveData, listens for changes with cleanup.
- ProjectsPage.tsx renders it only inside the active card's hero (not StoryPanel); inactive cards never mount a `<video>`.
- CSS projects-ring.css:54-55 matches. tests/project-card-shot.test.ts 5 pass.

## card-video-cache: VERIFIED
- static-cache.ts:129-165 versionedMediaCacheControl (regex, non-empty v, immutable year) and registerVersionedMediaCache (200/206); server/index.ts registers it just before registerStaticCorsTrim.
- tests/static-cache.test.ts:275-335 covers unit cases and a 206 Range request (uncompressed, immutable) plus unversioned one-day case. 27 pass.

## listing-video-docs: VERIFIED
- host-contract.md:129 ownership row, :157 field row, :263-284 "Card video" (behaviour, reduced motion/Save-Data, PNG previews, year cache, no sound, 5-step recipe), :259 budget sentence, :524/:528 gate rows.
- Names asset-versions.ts / assetVersions.ts / ProjectCardShot / versionedMediaCacheControl, all present at HEAD. No mention of scripts/card-asset-version.ts.

## Cross-diff checks
- mcp-host-server/dist matches src (mcp-dist-sync passes).
- CSP: server/security-headers.ts and vite/CSP unchanged since base. No registry entry edited (standalone-projects.json untouched).
- Poster-only under reduced motion/Save-Data: cardShotMode returns image unless video && allowMotion.

## Findings
### Critical
- none
### Important
- none
### Minor
- ProjectCardShot.tsx cardShotMode takes an extra optional `thumbnail` param beyond the PRD's `{ video, allowMotion }`; behaviour is a superset and tested.
- Doc line 267 calls the poster `/og/<slug>.png?v=<hash>`; the card actually uses `card.thumbnail`, which is that URL only for cards without a custom thumbnail. Wording is approximate.
