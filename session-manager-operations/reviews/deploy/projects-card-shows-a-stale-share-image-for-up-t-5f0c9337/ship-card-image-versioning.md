# Ship: card image versioning

Date: 2026-11-14 (PST). Validation record: all five PRDs VERIFIED, Critical none, Important none.

## Pushed

origin/main dbc9a03a..aa1bfc1b (StanislavBG/bilko-run). Cherry-picked in log order onto origin/main; plan records under session-manager-operations/ not shipped.

| PRD | local | pushed |
| --- | --- | --- |
| asset-versions-primitive | 04dd1fc1 | 24fe249c |
| og-route-etag-revalidate | 7d55b191 | 857c2683 |
| card-image-versioned-url | 6802503f | b0a9075a |
| og-card-cache-harness | 959aa9ef | b98d62eb |
| docs-card-image-versioning | 5694ec88 | aa1bfc1b |

## Pre-push gate (in /tmp/ship-card-image-versioning, origin/main + picks)

- `pnpm test`: first run 1 failed / 2327 passed (flaky, not reproduced); two reruns: 186 files passed, 2 skipped; 2328 tests passed, 15 skipped.
- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0 (vite built in 13.30s, precompress 361 files).
- The ship tree and its symlinks were removed after the push.

## Deploy

/api/health uptime fell to 46 s at 158 s after the push (try 5 of 20): deployed.

## Live checks (cookie bilko_internal=1 on every request)

`curl -sI https://bilko.run/og/escape-velocity.png`
```
HTTP/2 200
content-length: 4791205
cache-control: public, max-age=300
etag: "e3dbcf4ef4776e1c"
```

GET with `If-None-Match: "e3dbcf4ef4776e1c"`
```
HTTP/2 304
cache-control: public, max-age=300
etag: "e3dbcf4ef4776e1c"
```

og:image on https://bilko.run/projects/escape-velocity/
```
<meta property="og:image" content="https://bilko.run/og/escape-velocity.png?v=0ba6019e" />
```

`curl -sI https://bilko.run/og/escape-velocity.png?v=0ba6019e`
```
HTTP/2 200
cache-control: public, max-age=86400
etag: "e3dbcf4ef4776e1c"
```

Headless Chromium (repo @playwright/test) on https://bilko.run/projects, clicked `[aria-label="Open Escape Velocity"]`:
```
pr-shot src: /og/escape-velocity.png?v=0ba6019e
```
Same v as og:image.

SHIP: PASS
