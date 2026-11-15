# Ship: card video plan (listing.video)

Pushed SHA: `00bb97a4d0f571aecc3c85e49520797bb12cd25f` to origin (StanislavBG/bilko-run) main, fast-forward from `aa1bfc1b`.
Push time: 2026-11-14 6:28:54 PM PST. Deploy seen: 2026-11-14 6:31:30 PM PST (uptime 38.7 s, 156 s after the push).

## Pre-push checks
- Validation record (validate-card-video.md): all six PRDs VERIFIED; no Critical or Important finding. PASS
- Sibling card-image-versioning commits (04dd1fc1, 7d55b191, 6802503f, 959aa9ef, 5694ec88) already on origin (`git cherry` shows `-`). PASS
- Cherry-pick onto origin/main in /tmp/ship-card-video: no conflicts. PASS
- `pnpm test`: 187 files passed, 2 skipped; 2357 tests passed, 15 skipped. PASS
- `pnpm typecheck`: exit 0. PASS
- `pnpm build`: exit 0. PASS

## Commits pushed (log order; local SHA -> pushed SHA)
| PRD | Local | Pushed | Subject |
| --- | --- | --- | --- |
| listing-video-schema | 3cfe4dc1 | 0f876214 | feat(mcp-host): add optional listing.video (.mp4/.webm in own bundle) to registry schema |
| listing-video-gate | 79104d12 | 7805f488 | feat(mcp-host): share-assets gate validates listing.video (MP4/WebM signature, 8 MB cap) |
| card-video-cache | b8aa9888 | 9d4ad492 | feat(static): immutable Cache-Control for ?v-versioned card videos |
| card-video-url | a8b48a39 | a7eba2b7 | feat(projects): version listing.video in asset map and expose HubCard.video |
| card-video-shot | f6c403aa | d8e7f892 | feat(projects): play listing.video as muted looping hero on the active card |
| listing-video-docs | 04003f75 | 00bb97a4 | docs(host-contract): document optional listing.video card clip |

Nothing else was pushed (plan records and other plans' commits stay on local main).

## Live checks (2026-11-14 6:31:33 PM PST, cookie bilko_internal=1)
- https://bilko.run/api/health uptime below seconds since push (38.7 s < 156 s). PASS
- https://bilko.run/projects -> 200. PASS
- `curl -r 0-99 https://bilko.run/projects/escape-velocity/og.png` -> 206, `content-range: bytes 0-99/4791205`. PASS
- https://bilko.run/ -> 200. PASS

No registry entry sets listing.video yet; Escape Velocity sets it from its own repo.

SHIP: PASS
