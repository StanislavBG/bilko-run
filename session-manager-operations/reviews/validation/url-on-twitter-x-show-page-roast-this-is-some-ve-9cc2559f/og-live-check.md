# Live OG check — bilko.run (2026-10-10)

Pushed `main` (04564be..441efb7) to origin (StanislavBG/bilko-run). Render deploy
detected by polling `/og/default.png` until Content-Type was `image/png`.
Note: the first poll returned 200 `text/html` (old build's SPA fallback), so a bare
`curl -sf` is not a sufficient deploy signal; image/png appeared on poll 8 of the second loop.

## Card images (plain GET)

| URL | HTTP | Content-Type | Bytes |
|---|---|---|---|
| https://bilko.run/og/session-manager.png | 200 | image/png | 86072 |
| https://bilko.run/og/page-roast.png | 200 | image/png | 81497 |
| https://bilko.run/og/default.png | 200 | image/png | 99777 |

Viewed each PNG: session-manager card reads "Session Manager / Local cockpit for Claude Code CLI sessions";
page-roast card reads "PageRoast / Brutally honest landing page audits"; default card reads "bilko.run / A studio of one shipping small AI tools…".

## Pages fetched with `-A Twitterbot`

| URL | HTTP | og:title | og:image | "AI Advisory" hits |
|---|---|---|---|---|
| https://bilko.run/projects/page-roast/ | 200 | PageRoast — bilko.run | https://bilko.run/og/page-roast.png | 0 |
| https://bilko.run/products/session-manager | 200 | Session Manager — bilko.run | https://bilko.run/og/session-manager.png | 0 |
| https://bilko.run/ | 200 | bilko.run — Small AI tools, one at a time | https://bilko.run/og/default.png | 0 |

Result: all criteria met. The legacy "AI Advisory for Small Business" / og-bilko.png card is no longer served.
