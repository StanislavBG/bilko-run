# Bilko host internals

This is host-side implementation detail — monitoring, QA checks, cost controls, caching, observability, security headers, and the list of sanctioned app-specific host code. It's for whoever is changing the host itself. If you're publishing an app, you want [`docs/host-contract.md`](host-contract.md) instead.

## Synthetic monitoring

When run, a headless Chromium opens each sibling's `manifest.golden.path` and
asserts `manifest.golden.expect` text is present in the page body. Results
land in the `synthetic_runs` table. Three consecutive failures open an alert
(logged via `/api/telemetry/log` as a `synthetic.fail.streak` error event, and
printed to stderr; the Resend mailer in `server/services/mailer.ts` exists but the monitor does not email). Resolution = next passing run.

The `/admin` → Synthetic tab shows a per-sibling 30-day grid (green = pass,
red = fail, grey = no run), latency p50/p95, current failure streak, and any
open alerts.

Run manually:

```bash
cd /home/bilko/Projects/Bilko && pnpm synthetic
```

It runs by hand only: `crontab -l` and `systemctl --user list-timers` show no installed schedule for it. Run `pnpm synthetic` when you want a fresh result.

Tune sensitivity via `STREAK_TO_ALERT` in `scripts/synthetic-monitor.ts`
(default: 3 consecutive failures).

## Sanity QA gate

`scripts/sanity-qa.ts` is an end-to-end QA check you run by hand. It is not enforced anywhere: the real publish gate is the MCP publish gate (see "Publish gate" in [`docs/host-contract.md`](host-contract.md)). A publish PRD can start with:

```bash
cd ~/Projects/Bilko
tsx scripts/sanity-qa.ts --targets=<slug> --fail-fast
test $? -eq 0 || { echo "Sanity QA failed; HALT"; exit 1; }
```

### What it checks

Five subagents run in parallel against every live static-path target:

| Subagent | Checks |
|---|---|
| **Smoke** | Playwright golden-path; game flow for sudoku only (`scripts/sanity-qa-runners/smoke.ts`); no console errors |
| **Security** | CSP headers, HSTS, frame-ancestors, no leaked secrets (sk-/AIza/JWT patterns), SSRF probe on `/api/page-fetch` (**known gap:** that route does not exist, so the probe tests nothing; `scripts/sanity-qa-runners/security.ts`) |
| **Perf** | Lighthouse mobile audit — Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90; LCP ≤ 2.5s, CLS ≤ 0.1, TTI ≤ 3.5s |
| **Size** | reports `manifest.bundle.sizeBytesGz` (no per-app budget, no file-count limit); manifest `fileCount` vs actual files; stale-manifest drift detection |
| **A11y** | axe-core scan (WCAG 2.1 AA) in mobile + desktop viewports; zero serious/critical violations; reduced-motion honored |

### CLI

```bash
# Full run (all live targets)
pnpm sanity-qa

# Single target
tsx scripts/sanity-qa.ts --targets=sudoku

# Multiple targets, fail-fast, custom report path
tsx scripts/sanity-qa.ts --targets=sudoku,mindswiffer --fail-fast --write-report=/tmp/qa.md
```

Exit codes: `0` = PASS, `1` = FAIL, `2` = internal error.

### Decision logic

| Condition | Decision |
|---|---|
| Smoke fails for any target | FAIL |
| Security critical/high finding | FAIL |
| Any a11y serious/critical violation | FAIL |
| Perf score < 80 for any target | FAIL |
| Any warn-level issue (no FAIL) | WARN |
| All clean | PASS |

### Reports

Written to `test-results/sanity-qa-YYYY-MM-DD-HH-MM.md` (gitignored; reports are not committed).

### Cron script (not scheduled)

`scripts/sanity-qa-cron.sh` wraps the run and, on FAIL or ERROR, opens a GitHub issue on `StanislavBG/bilko-run` tagged `qa-failure` with the first 60 lines of the report (needs the `gh` CLI; token from `~/.env.cron`). No crontab entry or systemd timer installs it (`crontab -l`, `systemctl --user list-timers`). Run it by hand:

```bash
cd ~/Projects/Bilko && bash scripts/sanity-qa-cron.sh
```

### Prompt files (AI-subagent mode)

`scripts/sanity-qa-prompts/*.txt` — self-contained prompts for each subagent. These are the spec for `claude -p` invocations if you want AI-driven rather than deterministic runner execution.

## Cost controls

Three layers protect the platform from runaway Gemini spend:

1. **Per-user daily Gemini call cap** (100 calls/day default, 1000 for admin). Returns 429 + friendly message when breached.
2. **Per-app daily ceiling** (the `app_spend_ceilings` table). Returns 503 + inserts a `cost_alerts` row when the app's total daily calls exceed the ceiling. The seed in `server/db.ts` (`PAID_TOOL_SLUGS` and `CEILINGS`) gives each seeded paid tool 2000 calls a day and Academy 200. An app with no row has no ceiling (`getCeiling` in `server/routes/tools/_shared.ts` returns `null`).
3. **Daily cost-of-revenue monitor** (`pnpm cost-monitor`): alerts if Gemini COGS exceeds 25% of Stripe revenue, or if absolute spend exceeds $50/day.

All paid AI tool gateway routes call `enforceCallLimits(ctx)` from `server/routes/tools/_shared.ts` before every Gemini invocation. The free tools (Outdoor-Hours, LocalScore) have no host routes, so none of these layers apply to them.

Open alerts are visible at `/admin/cost`. Ceilings can be tuned per-app via the admin UI or directly in the `app_spend_ceilings` table.

The cost monitor runs by hand only (`pnpm cost-monitor`); no crontab entry or systemd timer installs it.

## Static-asset caching

Render bills origin egress, so the host caches everything it serves out of `dist/`. Apps get this for free — there is nothing to configure in a sibling repo — but the policy determines how fast a publish becomes visible, so know it before you publish.

The policy is `staticCacheControl` in `server/static-cache.ts`, applied by `setStaticCacheHeaders` (the `@fastify/static` `setHeaders` callback in `server/index.ts`). It sorts files into HTML (revalidated on every view, so a publish shows at once), Vite content-hashed `assets/*-<hash>.<ext>` (immutable for a year), media (`MEDIA_EXT`, one day) and everything else (10 minutes). The SPA fallback HTML from `setNotFoundHandler` in `server/index.ts` is `private, no-store`, because it carries a per-request CSP nonce. Read the code for the exact values.

Two consequences worth designing around:

- **Unhashed assets can be stale for up to the everything-else lifetime (10 minutes).** If your app publishes on a cron and needs fresher data than that, serve the data from an API route (see `server/routes/project-data.ts`, `public, max-age=60`) rather than from a static file — that is what SocialSignalsTrader's snapshot endpoint does.
- **Content-hash your bundles if you want immutable caching.** Emit them into an `assets/` directory with a Vite-style `-<hash>` suffix and they are cached for a year. A plain `app.js` gets the 10-minute tier.

`registerStaticCorsTrim` in `server/static-cache.ts` strips `Vary: Origin` and the `Access-Control-*` headers from same-origin requests for publicly cacheable assets. `@fastify/cors` runs with an allow-list, which makes it stamp `Vary: Origin` on everything, and most CDNs refuse to cache a response that varies on anything but `Accept-Encoding`. Cross-origin requests (which carry an `Origin` header) still get full CORS headers.

`registerCrossOriginAssetCors` in `server/static-cache.ts` serves every GET and HEAD under `CROSS_ORIGIN_ASSET_PREFIXES` (`/projects/session-manager/widget/`, Session Manager's embeddable feedback widget) with `Access-Control-Allow-Origin: *`, whatever the request `Origin` and on 200, 304 and 404 alike, with no `Access-Control-Allow-Credentials` and no `Origin` in `Vary`, so third-party sites can load the script with SRI and its fonts and one cached copy serves them all. It runs after `@fastify/cors` and the trim. The rest of every static path keeps the allow-list policy above.

**Note on the edge:** bilko.run's DNS is at Porkbun, pointing straight at Render. The `server: cloudflare` / `cf-cache-status: DYNAMIC` headers you'll see come from Render's own edge, not a Cloudflare zone we control — so `DYNAMIC` on a correctly-cached asset is not a bug in this repo. The caching above is browser-side and revalidation-side: repeat views serve from disk cache, and anything that does revalidate returns a 0-byte 304 instead of the full asset.

`normalizeStaticMtimes` in `server/static-cache.ts` rewrites every file's mtime at boot to a value derived from that file's content hash, because `@fastify/send` derives its ETag from `size + mtime` and a deploy's git checkout stamps every file with a fresh mtime. Without that normalization, every deploy would invalidate every visitor's cached copy of every unchanged file — and with published projects republishing on a 30-minute cron, that is ~48 full cache resets a day. Do not "fix" a stale asset by touching mtimes; change the bytes.

## Observability dashboard

`/admin/observability` is the Observability Command console: a full-viewport view with 7 swappable modules (globe, sessions journeys, app health, traffic, audience, top clicks, bandwidth), a KPI strip and a ticker. It aggregates per-sibling:

- 24h traffic, errors, log warnings/errors
- Synthetic monitor pass rate + load times (p50/p95)
- Manifest version + host-kit drift
- Bundle size + git sha
- Open cost / synthetic / manifest alerts

It is a read-only page over existing tables — no new ingest. To add a column, add a JOIN in `server/routes/admin-observability.ts`. Auto-refresh defaults to 5m (options 30s, 1m, 5m, off).

Host-kit drift is computed against `BILKO_LATEST_HOST_KIT` env var (set via Render dashboard). Rows for siblings with no telemetry show `—` instead of `0` to avoid false "everything's broken" signals.

Admin-console rules:

- Each module renders its own loading, error and empty state; a failing source never blanks the whole page.
- Every fetch goes through `useAdminFetch` (`src/hooks/useAdmin.ts`), which uses Clerk bearer auth. Add no new endpoint for it; reuse the existing `/api/admin/*` ones.
- The page is admin-only: non-admins are redirected to `/`.

When something feels wrong on bilko.run, this is the first place to look.

## Security headers

bilko.run sends a strict CSP plus the OWASP-recommended security header set on every response. `registerSecurityHeaders` in `server/security-headers.ts` applies them in Fastify hooks, so they cover both host SPA routes and `/projects/*` static-path siblings. The code is the spec; read it rather than a copy:

- **Headers:** the `onRequest` hook in `registerSecurityHeaders` sets HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (the `PERMISSIONS` list), `Cross-Origin-Opener-Policy` and the CSP header.
- **CSP:** `buildCsp` builds the policy per request with a fresh nonce. Its comments explain each origin and directive. `isStaticProjectPath` decides the `/projects/*` differences (`frame-ancestors 'self'` so Game Academy can frame engine games, and `blob:` images); everywhere else is `frame-ancestors 'none'`.
- **Blog videos:** `/blog-videos/<slug>/` (`isBlogVideoPath`) gets `BLOG_VIDEO_CSP` instead: always enforced and sandboxed, with no network.
- **Nonce injection:** the on-send hook adds the nonce to every `<script>` and `<style>` tag in HTML payloads (strings and streams, which it buffers) and adds a `<meta name="csp-nonce">` for host-kit runtime CSS. `nonceScriptPreloads` stamps script preload `<link>` tags that lack a nonce, because `'strict-dynamic'` requires it even for same-origin preloads. HTML sent as an attachment (the Field Manual offline edition) passes through untouched.

### Mode toggle

`BILKO_CSP_ENFORCE=1` enforces `Content-Security-Policy` on the host's own pages only. Static-path apps (`/projects/<slug>/`) stay `Content-Security-Policy-Report-Only` even then (`cspIsEnforced`): they are sibling-owned code with engine-specific needs (Godot needs `'unsafe-eval'`, engines draw from `blob:` images). Before enforcing on `/projects/`, that has to become a per-project policy declared in the registry. Default (unset) is report-only everywhere.

### Violation reporting

Browsers POST violations to `/api/security/csp-report`. Reports are persisted in the `csp_violations` table (columns: `blocked_uri`, `violated_dir`, `document_uri`, `source_file`, `line_number`, `user_agent`, `created_at`). The endpoint keeps one row per distinct (directive, blocked URI, document) per hour and at most 10 new rows per IP per minute. A repeat of a report already on file does not count toward that limit. Every report gets `204`, including a dropped one: no browser acts on the status, and a `429` logged `Failed to load resource` in the visitor's console. Inspect violations with the admin SQL view or directly:

```sql
SELECT blocked_uri, violated_dir, document_uri, COUNT(*) as n
FROM csp_violations
GROUP BY 1, 2, 3
ORDER BY n DESC
LIMIT 50;
```

## Host stack and code helpers

Stack: React 18, Vite 6, Tailwind v4, Fastify 5, Turso/libSQL (local SQLite in dev), Clerk, Stripe, Gemini.

### Gateway pattern for the AI-tool siblings

Each AI tool with a file in `server/routes/tools/` ships its React page from the sibling repo, but its Gemini-backed scoring endpoint stays in the host at `server/routes/tools/<slug>.ts`. The sibling calls it same-origin with a Clerk JWT, so there is no CORS and no cross-origin auth. The split is deliberate. PageRoast owns 6 endpoints plus the `PAGEROAST_TOKENS` one-time-purchase tier; AudienceDecoder owns its own one-time-purchase tier. Academy and the free tools (OutdoorHours, LocalScore) are not in this pattern; the free tools have no host-side route and deduct no credits.

Shared helpers in `server/routes/tools/_shared.ts`: the rate limiter, IP hashing, usage tracking, `freeTierGate` (free-tier rate limit), `creditGate` (paid credit check and deduct), `askGeminiJson` (Gemini call plus JSON parse), `toolErrorReply` (uniform error reply) and `handleGenerateEndpoint` (inverse-mode generator). `index.ts` there registers every tool. To extract a tool to a sibling repo, lift its file and the page; no other server change is needed.

### Host code helpers

- `server/db.ts` has the Turso client (local SQLite in dev), `dbGet`, `dbAll`, `dbRun`, `dbTransaction`, `txGet`, `txRun`, migrations and seed data; table definitions are in `server/db-schema.ts`.
- `server/gemini.ts` is the Gemini client (key in a header, not the URL); `server/utils.ts` has `parseJsonResponse`, the shared Gemini output parser.
- `server/bearer.ts` has `bearerMatches`, the timing-safe compare for shared-secret bearer routes.
- `server/blog-posts.ts` loads the `content/blog/*.md` seed posts.
- Page views and clicks come from the beacon the host injects into every HTML page (`server/click-beacon.ts`); there is no client hook to call. Clerk state comes straight from `@clerk/clerk-react`; there is no host-side `useAuth` wrapper.
- The portfolio (`/`, `/projects`, `⌘K`) reads `src/data/projectsRegistry.ts`. Static-path and external apps load as a full page (Fastify serves the bundle); React routes use SPA navigation.

Leaving `react-route` turns in-process auth and credit calls (`requireAuth`, `deductToken`) into HTTP round-trips to `/api`, authenticated with a Bearer token.

## React-route apps

`react-route` apps live in this bundle at `/products/<slug>`; Session Manager is the only one. The app contract for every other kind is [`docs/host-contract.md`](host-contract.md).

### What the host provides to `react-route` apps

- **Auth: Clerk.** Available via `useUser()` and `useAuth()` from `@clerk/clerk-react`. Server-side: `requireAuth(req, reply)` from `server/clerk.ts` returns the Clerk email or 401s.
- **Credits: token wallet.** Spend via `deductToken(email)` and check via `getTokenBalance(email)` from `server/services/tokens.ts`. Free users get a starter grant via `grantFreeTokens(email)`.
- **Payments: Stripe.** Subscription state via `getActiveSubscriptionLive(email)`; one-time purchases via `hasPurchased(email, productKey)`. Both from `server/services/stripe.ts`.
- **Rate limiting.** `checkRateLimit(ipHash, endpoint, email?, productKey?)` from `server/routes/tools/_shared.ts` — handles free-tier daily caps, paid-tier caps, pro-skip.
- **Analytics, Gemini and the database.** See "Host code helpers" above. The beacon sets the `bilko_vid`/`bilko_sid` session cookies (~/Projects/Bilko/docs/observability.md); `askGemini(prompt, opts)` is in `server/gemini.ts` and `parseJsonResponse` is re-exported as `parseResult` in `_shared.ts`; all SQL is parameterized.

### What a `react-route` app must implement

- A `<MyAppPage />` React component in `src/pages/MyAppPage.tsx`.
- A registry mapping in `src/data/projectsRegistry.ts` (see the react-route path map there) and a route in `src/App.tsx`.
- Backend routes in `server/routes/tools/<my-app>.ts` exporting `registerMyAppRoutes(app)`, registered in `server/routes/tools/index.ts`.
- For paid features, deduct credits via `deductToken(email)` after a successful response; for free-tier, gate via `checkRateLimit()` and increment via `incrementUsage()`.

### Adding and removing a `react-route` app

- Adding: build the page, route entry and per-tool server file above, and register it by hand in `src/data/projectsRegistry.ts`; the `bilko-host` MCP covers only `static-path` and `external-url`. Then run the host's test suite (below), commit and push to `origin`.
- Removing: delete the page (`src/pages/<slug>Page.tsx`) and per-tool server file (`server/routes/tools/<slug>.ts`), and remove the call from `server/routes/tools/index.ts`.
- Add a redirect in `src/App.tsx` for any removed slug still linked from outside.

### URL canonicalization

- `/products/<slug>` is the canonical path for every `react-route` app.
- `/projects/<slug>` redirects (301-style SPA `Navigate replace`) to `/products/<slug>`.
- `/app/<old-slug>` redirects to `/products/<canonical-slug>` per the `APP_TO_PRODUCT` map in `src/App.tsx`.

## Host test suite

Before pushing a host change (including a hand-registered `react-route` app), run `pnpm test && pnpm exec tsc --noEmit && pnpm exec vite build`; all must pass. The full command list is in [`CLAUDE.md`](../CLAUDE.md#testing).

## Admin and webhook internals

- **Manifests.** The host stores the latest manifest per app in the `app_manifests` Turso table, shown at `/admin` → Manifests tab.
- **Drift indicator.** The Manifests tab shows a per-app drift badge computed from `hostKit.version`: **green** matches the highest version seen across all manifests (`current`), **yellow** is exactly 1 minor version behind (`minor_behind`), **red** is ≥2 minors behind or a different major (`major_behind`).
- **Publish gate bypasses** are logged to the `publish_overrides` table (slug, gate, reason, admin_email, timestamp).

Web-product admin endpoint:

| Endpoint | Auth | Success | Errors |
|---|---|---|---|
| `GET /api/admin/web-products?days=30&exclude_self=1` | `requireAdmin` (`days` clamped 1–365; `exclude_self` defaults to 1) | 200 `{ days, excludeSelf, products[], daily[] }` — per product: views, unique visitors, checkout starts, expired + recovered checkouts, orders, revenue (cents), downloads, unique download sessions, last order/download, `releaseStored`; `daily` is per-slug per-day counts | 401/403 per `requireAdmin` |
| `GET /api/admin/checkout-starts?days=7&limit=200` | `requireAdmin` (`days` clamped 1–365, default 7; `limit` clamped 1–1000, default 200) | 200 `{ days, since, labelsSince, totals: { counted, all, starts, ownerFlagged }, listed, truncated, starts[] }` — one row per `checkout_start` in the window, newest first, nothing filtered, each with its source, Stripe checkout session id and mode, path, `label` (human, automated or unlabeled) and `labelReasons`, `counted` (false only for owner-flagged `is_admin` rows), `mine` and `mineReasons`, visitor and session ids, the joined `session` (landing path, referrer, utm, country, device) or a `sessionNote` saying why there is none, `visitorClasses`, `hit` (agent-buy rows only, else null: the `/buy/<offer>` page hit matched by IP hash and time, 30 s before to 5 s after, with its visitor class, country, device, browser, os, referrer host, status, path and time, never the IP or user agent; a matched hit sets `visitorClasses` to its class) and `metadata`; `totals.counted` equals `checkoutStartsAll` of `GET /api/admin/web-products` at its default `exclude_self=1`, and `totals.all` adds the owner-flagged starts | 401/403 per `requireAdmin` |

The Stripe webhook (`checkout.session.completed`) dispatches on `metadata.web_product` before any generic branch: it records the order only if paid, the line-item price equals the product's resolved price id, and an email is present; it also writes a one-time purchase row (`productKey` = `wp_<slug>`). `/stripe/success` redirects web-product sessions to the product's thanks page. `checkout.session.expired` (non-test, non-owner-IP) writes a `checkout_expired` funnel row; a completed session with `recovered_from` writes `checkout_recovered`. The live endpoint must subscribe to `checkout.session.expired`.

## Web-product host steps

The sibling's half of a new downloadable web product (zip, upload, landing and thanks pages) is the playbook in [`docs/host-contract.md`](host-contract.md) → "Selling a downloadable web product". The host's half:

1. **Stripe:** create a live Product + one-time Price. Set product/session metadata `web_product=<slug>` (the checkout route sets it on the session; the webhook relies on it).
2. **Declare it:** add a `WEB_PRODUCTS` entry in `shared/web-products.ts` — `slug`, `name`, `productKey` (`wp_` + slug with `-` → `_`), `priceEnvVar` (`STRIPE_PRICE_WP_*`), `defaultPriceId`, `displayPrice`, `downloadLimit`, and `release: { version, filename, bytes, sha256 }` from the sibling's zip. `validateWebProducts` checks the shape, including the optional `includes` and `preview` fields. Commit and push to `origin/main`; Render deploys. The env var, when set, overrides `defaultPriceId`.
3. **Prices:** `tests/web-product-pages.test.ts` fails when a published landing or thanks page shows a dollar amount that is not a catalog price, when the landing page lacks its own `displayPrice`, or when a sellable product's landing or thanks page is missing. To change a price, edit `shared/web-products.ts`; the test stays red until the sibling republishes the page.
4. **Monitor** in `/admin` → Products (views, checkout starts, orders, revenue, downloads, release stored).

## Contract code map

Where the parts of [`docs/host-contract.md`](host-contract.md) are implemented:

- Social share cards: `server/og-meta.ts` (resolves meta from the registry and rewrites the head), `server/og-image.ts` (renders the PNG card), and `server/og-routes.ts` (the `/og/<slug>.png` route and HTML injection wiring). Caching: every `/og/<slug>.png` response has an ETag. A versioned URL (with `?v=`) is cached for a day (`max-age=86400`), since a new image gets a new URL. An unversioned URL, such as an old link that was shared before, is cached for 5 minutes (`max-age=300`); after that the browser revalidates with the ETag and gets a `304` when the image has not changed.
- Card media: the tool is in `mcp-host-server/src/` (`listing-media-tool.ts`, `contract/`, `gates/share-assets.ts`), the shared checks in `shared/listing-media.ts`, the serve and upload routes in `server/routes/listing-media.ts` with storage in `server/services/`, and the card player in `src/components/ProjectCardShot.tsx`.
- Public project catalog: `server/routes/project-catalog.ts`; tests in `tests/project-catalog.test.ts`.
- Realtime relay code: `server/realtime/relay.ts` (socket), `server/realtime/lobbies.ts` (directory) and `server/routes/realtime.ts` (ticket + directory routes). Tests: `tests/realtime-relay.test.ts`, `tests/realtime-lobbies.test.ts`.
- Authoritative game rooms: `server/rooms/runtime.ts` (the game-agnostic room), `server/rooms/socket.ts` (WebSocket transport and tickets) and `server/routes/rooms.ts` (matchmaking, escrow and settlement). Tests: `tests/rooms-runtime.test.ts`, `tests/rooms-socket.test.ts`, `tests/rooms-routes.test.ts`, `tests/rooms-settlement.test.ts`.
- Play currency code: `server/routes/play-currency.ts`, `server/services/play-currency.ts`, `server/services/apple-iap.ts`, and the play-pack branch of the Stripe webhook in `server/routes/stripe.ts`.
- Sign-in capture ("sign in for updates"): ~/Projects/Bilko/docs/site.md.

### robots.txt

`public/robots.txt` keeps `/api/` private but explicitly allows `/mcp`, `/llms.txt`, `/api/offers` and `/api/projects` (longest match wins). It disallows `/buy/` because a browser GET creates a live Checkout session; agents acting for a user hand the link to the user, whose browser opens checkout.

### Game services config

Each game is a `GameConfig` in `GAME_CONFIGS`: its `slug`, `scoreOrder` (`desc` = higher is better), `maxPlausibleScore` (scores above it are rejected) and its `achievements` catalog. The interface is in `shared/game-config.ts`.

Adding a game or a new achievement key is a code change to `shared/game-config.ts`. Achievement keys are stable (see "Game services" in [`docs/host-contract.md`](host-contract.md)).

Optional score signing: set `BILKO_GAME_HMAC_KEY` ([`docs/deployment.md`](deployment.md#env-vars)).

### Room and play-currency wiring

Modules are registered in `ROOM_MODULES` in `server/rooms/modules.ts`, keyed by app id. An app also needs an entry in `PLAY_APPS` (`shared/play-currency-catalog.ts`). An app with no module or no `PLAY_APPS` entry gets `unknown_app`. A registered app's tables are open. It gets `rooms_closed` only while the owner lists its id in the `ROOMS_CLOSED` emergency switch (~/Projects/Bilko/docs/deployment.md).

Three Winds: `ROOM_MODULES` registers the engine's own `threeWindsRoomModule` from `@threewinds/engine` (`npm:@bilkobibitkov/threewinds-engine`), with no host overrides: its `nextDealer`, `timeoutAction` and `deadlineMs` (the R4.6 claim window) come from the engine, so a rule change is an engine release plus a pin bump of that dependency.

`hand_over`, `settled` and the `insufficient_taels` error come from `server/routes/rooms.ts`; the `RoomMessage` type in `server/rooms/runtime.ts` covers only `state`, `error` and `hand_over`.

- **Deploy drain order** (`suspendRoomTables` in `server/routes/rooms.ts`, run by `server/shutdown.ts` before anything closes). On SIGTERM the old instance:
  1. Freezes every table. Actions are dropped without a reply (send the action again after the table resumes). No AI move, autoplay, AI fill or new deal runs. Every ticket request gets `503 table_moving`.
  2. Lets work already in flight finish. A hand that is settling pays and sends `settled`. A hand being dealt stops before the deal: the next instance voids it, releases its escrows and deals the next hand.
  3. Saves each table's final state, then suspends it for the next instance.
  4. Closes every socket with `1012`.

  Nothing changes between the final save and the `1012` close, so a resumed table is exactly what its players last saw: the same `seq` and the same view.

A sweeper (every 60 s) releases held escrows older than 60 s whose table is not in this process.

## Session Manager relay paired clients

A paired client is a headless service or app that drives its owner's Session Manager desktops over the relay the way the phone does, without a Clerk session. The relay knows nothing about what the client is: its socket is an ordinary `role:'browser'` conn of the owner's account (same `fromConn` stamping, `toConn` unicast and per-account browser-conn cap), and what it may do is decided by the desktop over E2E. Code: `server/routes/sm-relay.ts` (routes), `server/sm-relay/tokens.ts` (store, table `sm_relay_paired_clients`), `server/sm-relay/owner-auth.ts` (owner auth), `server/sm-relay/router.ts` (closing a revoked client's sockets).

- Pairing: an owner mints a single-use 8-character client code (5 minutes), the client redeems it for a client token. Client codes and device codes (`POST /api/sm-relay/otp`) are not interchangeable; a code redeemed at the wrong route is `400 invalid_code` and stays valid.
- Client tokens are 32 random bytes, stored only as a SHA-256 hash, never logged, and never expire: a pairing lasts until it is revoked. Revoking deletes the row, drops the client's unused WS tickets and closes its live sockets with `4001 token_revoked`; the owner's devices then get `event:client:disconnected` with `reason: "token_revoked"`.
- "Owner" auth takes `Authorization: Bearer <token>`: a token with exactly two dots is a Clerk session, anything else is checked as a device token. A client token is never an owner token, so a client cannot mint codes, list or revoke clients, or manage drop boxes.
- An email outside `SM_RELAY_ALLOWED_EMAILS`: `403 not_allowed`, for owners and clients alike.

| Route | Auth | Request | Response |
| --- | --- | --- | --- |
| `POST /api/sm-relay/client-otp` | owner (Clerk session or device token) | — | `200 { code }` for the owner's account; `401`; `429 rate_limited` (shares the account's 10 codes an hour with device codes) |
| `POST /api/sm-relay/client-pair` | — (10 an hour per IP, shared with `POST /api/sm-relay/pair`) | `{ code, clientName? }` (`clientName` up to 64 characters) | `200 { clientToken, clientId }`; `400 missing_fields` / `invalid_code_format` / `invalid_client_name` / `invalid_code` / `code_expired`; `429 rate_limited` |
| `POST /api/sm-relay/client-ticket` | client token (10 a minute per token) | — | `200 { ticket }`, a one-time `role:'browser'` WS ticket (30 s) for the client's account; `401 missing_token` / `invalid_token`; `429 rate_limited` |
| `GET /api/sm-relay/client/devices` | client token (10 a minute per token) | — | `200 { devices: [{ deviceId, email, issuedAt, expiresAt: null, isOnline, devicePubKey }] }`, the account's devices only |
| `GET /api/sm-relay/clients` | owner (Clerk session or device token) | — | `200 { clients: [{ clientId, email, clientName, issuedAt, expiresAt: null }] }` |
| `DELETE /api/sm-relay/clients/:clientId` | owner (Clerk session or device token) | — | `200 { ok: true }`; `404 client_not_found` (unknown or another account's client) |

The panic `DELETE /api/sm-relay/devices` (Clerk session) also revokes every client of the account and answers `{ ok: true, revokedCount, revokedClientCount }`.

## Session Manager relay drop boxes

A drop box lets a website widget send a sealed report to its owner's paired Session Manager desktop. The widget encrypts the report to the box's P-256 public key (an `SMF1` envelope); the host stores the opaque bytes and never decrypts, parses, hashes or logs them. Code: `server/routes/sm-relay-boxes.ts` (owner routes), `server/routes/sm-relay-box-ingest.ts` (public routes), `server/sm-relay/boxes.ts` (store), with the device purge paths in `server/routes/sm-relay.ts`.

### Auth

Every owner route takes `Authorization: Bearer <token>`. A token with exactly two dots is a Clerk session; anything else is checked as a device token from `POST /api/sm-relay/pair`.

- No or empty bearer: `401 missing_token`. Bad Clerk session: `401` from `requireAuth`. Bad device token: `401 invalid_token`.
- An email outside `SM_RELAY_ALLOWED_EMAILS` (Clerk or device): `403 not_allowed`.
- A device token sees only the boxes of its own device; a Clerk session sees every box of the account (the account id is the Clerk email). A box the caller does not own is `404 box_not_found`.
- Only a device token can create a box or drain one; a Clerk session there gets `403 device_token_required`.
- Creating a box also needs the account email to pass `SM_RELAY_BOXES_ALLOWED_EMAILS`, else `403 not_enabled`. Unset means site admins (`ADMIN_EMAILS` in `server/clerk.ts`) only, `*` means every account, otherwise a comma-separated email list. Both switches are read on every call ([`docs/deployment.md`](deployment.md#env-vars)).

### Owner routes (`server/routes/sm-relay-boxes.ts`)

A box in JSON is `{ boxId, label, allowedOrigins, publicKey, state, pending, pendingBytes, createdAt, lastReceivedAt, deviceId }` (`pending` and `pendingBytes` count the stored envelopes; times are ISO strings, `lastReceivedAt` may be `null`).

| Route | Auth | Request | Response |
| --- | --- | --- | --- |
| `POST /api/sm-relay/boxes` | device token | `{ label, publicKey, allowedOrigins }` | `201 { boxId, state: "open", createdAt }`; `400 invalid_label` / `invalid_public_key` / `invalid_allowed_origins`; `403 device_token_required` / `not_enabled` / `box_limit_reached` |
| `GET /api/sm-relay/boxes` | device token or Clerk session | — | `200 { boxes: [box] }` |
| `PATCH /api/sm-relay/boxes/:boxId` | device token or Clerk session | any of `{ label, allowedOrigins, state }` (`state` is `open` or `paused`) | `200 box`; `400 invalid_label` / `invalid_allowed_origins` / `invalid_state`; `404 box_not_found` |
| `DELETE /api/sm-relay/boxes/:boxId` | device token or Clerk session | — | `200 { ok: true }` (deletes the box and every envelope in it); `404 box_not_found` |
| `GET /api/sm-relay/boxes/:boxId/envelopes?limit=1..20` | owning device token | `limit` defaults to 20 | `200 { envelopes: [{ envelopeId, hostId, clientReportId, receivedAt, origin, bytes }] }`, oldest first; `400 invalid_limit`; `403 device_token_required`; `404 box_not_found` |
| `GET /api/sm-relay/boxes/:boxId/envelopes/:envelopeId` | owning device token | — | `200` the exact stored bytes, `application/octet-stream`, `cache-control: no-store`, uncompressed; `404 envelope_not_found` |
| `DELETE /api/sm-relay/boxes/:boxId/envelopes/:envelopeId` | owning device token | — | `200 { ok: true }` (the acknowledge: deletes the envelope); `404 envelope_not_found` |

Validation: `label` is 1-80 characters after trimming. `publicKey` is the unpadded base64url of a 65-byte uncompressed P-256 point that is on the curve. `allowedOrigins` is 1-10 bare origins (`https:`, or `http:` on `localhost` / `127.0.0.1`), no wildcards, deduplicated.

### Public routes (`server/routes/sm-relay-box-ingest.ts`)

| Route | Request | Response |
| --- | --- | --- |
| `GET /api/sm-relay/boxes/:boxId/key` | — | `200 { boxId, publicKey, state }` with `access-control-allow-origin: *` and `cache-control: public, max-age=60`; `404 box_not_found` |
| `OPTIONS /api/sm-relay/boxes/:boxId/envelopes` | CORS preflight | `204` with `access-control-allow-methods: POST`, `access-control-allow-headers: Content-Type, X-Sm-Envelope, X-Sm-Report-Id`, `access-control-max-age: 600`; same `404` / `403` / `410` checks as the POST |
| `POST /api/sm-relay/boxes/:boxId/envelopes` | body `application/octet-stream` starting with `SMF1`; headers `X-Sm-Envelope: 1` and `X-Sm-Report-Id: <uuid>` | `201 { id }` (new envelope; the owning desktop gets a `box:envelope` nudge over its relay socket, with no body bytes); `200 { id }` (same report id already stored, nothing new stored); errors below |

POST checks, in order: `429 rate_limited` with `retry-after` (per IP), `404 box_not_found`, `403 origin_not_allowed`, `410 box_paused`, `429 rate_limited` with `retry-after` (per box), `413 too_large` (`Content-Length` over the cap; a body over the cap with no length also gets `413` from the body parser), `400 bad_envelope` (missing `X-Sm-Envelope: 1`), `400 invalid_report_id` (not a UUID), `400 bad_envelope` (wrong content type, or a body that does not start with `SMF1`), then `507 box_full`.

**Per-box CORS.** These routes skip the global CORS plugin. The envelope routes echo `access-control-allow-origin: <Origin>` with `vary: Origin` only when the request's `Origin` is in that box's `allowedOrigins`, and the header is set before the body is read, so error replies carry it too. A missing or unlisted origin gets `403 origin_not_allowed`. The key route sends `*`. No public route sends `Access-Control-Allow-Credentials`.

### Caps

- 25 boxes per account (`403 box_limit_reached`); the count and the insert are one statement.
- 12 MiB per envelope body (`413`).
- 10 envelope POSTs per minute per IP and 60 per hour per box (`429`). These are in-process sliding windows that every POST counts toward; a restart resets them.
- 500 envelopes or 200 MiB of stored envelopes per box, whichever comes first (`507 box_full`).

### Retention and purge paths

An envelope is kept at most 30 days. It is deleted when:

- the owning desktop acknowledges it (`DELETE /api/sm-relay/boxes/:boxId/envelopes/:envelopeId`);
- its box is deleted (`DELETE /api/sm-relay/boxes/:boxId`);
- the device is revoked (`DELETE /api/sm-relay/devices/:deviceId`) or every device of the account is revoked (`DELETE /api/sm-relay/devices`): the device's boxes and their envelopes go with it;
- the device id is paired to a different account (`POST /api/sm-relay/pair`): the old account's boxes on that device are deleted first;
- it is older than 30 days: an hourly sweep in `server/routes/sm-relay.ts` (`runEnvelopePurgeTick`) deletes it and logs the count when it purged any.

## Sanctioned app-specific host code


Host code is framework by default — it should not know about one specific app. These exceptions are allowed because the app can't work without a host-side gateway:

- AI-tool gateway routes — `server/routes/tools/` (includes the PageRoast `roast_page` MCP tool, `server/routes/tools/page-roast.ts`, registered on the `/mcp` catalog server), the `PAID_TOOL_SLUGS` ceiling seed in `server/db.ts`, and the `audience: 'audience-decoder'` entry of `APP_TO_PRODUCT` in `src/App.tsx`
- PageRoast `roast_page` on the agent surface — its name in the tool list in `server/routes/agent-storefront.ts` and its agent-key check on `/mcp` in `server/routes/project-catalog.ts`
- Stepproof package card — the `stepproof` entry in `src/data/packages.ts`
- Observability Command preview — the per-app sample rows (`COUNTRIES` through `HITS`) in `src/pages/admin/command/PreviewPage.tsx`
- Session Manager — `CROSS_ORIGIN_ASSET_PREFIXES` in `server/static-cache.ts` (its widget prefix), `server/sm-relay/`, `server/routes/sm-relay.ts`, `server/routes/sm-relay-boxes.ts`, `server/routes/sm-relay-box-ingest.ts`, `server/routes/manual.ts`, `server/routes/admin-session-manager-usage.ts`, `src/pages/session-manager-landing/` (includes `SessionManagerPage.tsx` and `ManualPage.tsx`), `shared/manual-catalog.ts`, `server/services/manual.ts`, `src/lib/manualClient.ts`, `src/styles/session-manager-*.css`, `data/manual/`
- Academy gateway — `server/routes/academy.ts`, `server/services/academy-quota.ts`, `shared/academy-models.ts`
- Shared Bilko coffee tip jar — `GET /coffee` in `server/routes/stripe.ts` plus catalog defaults in `shared/product-catalog.ts`; linked from the site footer (`src/components/Layout.tsx`) and the Session Manager landing header (`src/pages/session-manager-landing/Header.tsx`, link text and href in `copy.ts`)
- Game config — `shared/game-config.ts`
- Realtime input relay and lobby directory (Game Academy online play, game-agnostic) — `server/realtime/relay.ts`, `server/realtime/lobbies.ts`, `server/routes/realtime.ts`; contract in `docs/host-contract.md` → "Realtime relay"
- Bilko Launch Kit web product — its WEB_PRODUCTS entry in shared/web-products.ts (price id + release sha256 only; the paid zip lives in the private ~/Projects/Bilko-Launch-Kit repo and the web_product_releases table)
- Bilko Agent Factory Kit web product — its WEB_PRODUCTS entry in shared/web-products.ts (price env var + release/preview sha256 only; the zip is built in the private ~/Projects/Bilko-Launch-Kit repo and stored in the web_product_releases table)
- Human For Hire page, free hour and Bilko hour — the `bilko-hour` entry in `shared/web-products.ts`, the `'human-for-hire'` slot entry in `shared/service-slots.ts`, `shared/bilko-profile.ts` (the public contact email), `shared/booking-page.ts`, `shared/free-hour-topics.ts`, `src/pages/BookingPage.tsx`, `src/pages/BookingSteps.tsx`, `src/lib/bookingView.ts`, `src/styles/booking-page.css`, `server/bilko-profile-routes.ts` (serves `/book`, the Hire page, and 301s `/bilko`, `/hire`, `/human-for-hire` and `/projects/human-for-hire/*` to it), `server/routes/free-hour.ts` (including its `free_hour_booked` funnel event), the `free_hours_booked` count in `server/routes/admin-funnel.ts`, `server/routes/admin-bookings.ts`, the `'human-for-hire'` entry of `NO_COMMIT_SIGNAL` in `scripts/refresh-commit-order.ts` (its `host.localPath` `~/Self` is bound only so Self can edit the card), `HOST_PAGE_SLUG` and `HOST_PAGE_PATHS` in `server/page-hits.ts` (they file the page's traffic and count its views in `server/routes/admin-web-products.ts`), and the free-hour functions in `server/services/service-bookings.ts` (the generic booking code in `server/routes/service-bookings.ts`, `server/services/service-bookings.ts` and `server/services/mailer.ts` is framework)
- Git Viewer hosted portfolios — `server/routes/tools/git-viewer.ts` (`/api/git-viewer/u/:login`, `/api/git-viewer/claim`, in-process generation + daily refresh), `server/routes/admin-git-viewer.ts` (`GET /api/admin/git-viewer/profiles`: portfolio totals without the showcase logins, `git_viewer` subscription counts and the newest 500 rows, never an email; the bilko-host `git_viewer_report` tool reads it), the `git_viewer_profiles` table (its `created_at` and `built_by` columns are set only by a row's first insert; `built_by` holds just the class, `owner`, `automation`, `visitor` or `showcase`, and both are NULL on older rows), `verifyClerkGitHubUser` in `server/clerk.ts`, and the `git_viewer` subscription tier ($5/yr; `STRIPE_PRICE_GITVIEWER`; `priceToPlanTier` → `git_viewer` for the current price and the retired $5/mo one kept in `legacyPriceIds`, which sets `gitViewer` but never `isPro`). Generation uses the `@bilkobibitkov/git-viewer` library, loaded lazily
- Bilko credits menu — `shared/bilko-menu.ts` and the menu order code built on it (`server/services/menu-orders.ts`, `server/routes/menu-orders.ts`); see [`docs/commerce.md`](commerce.md)
- ContentGrade is retired. There are no license keys and no Pro sales. `/upgrade` redirects home. The subscription lifecycle (webhook `saveSubscription`, billing portal, `priceToPlanTier`) stays only until Stripe shows zero active ContentGrade subscriptions.
- Three Winds (3PMahjong) play currency and rooms: `shared/play-currency-catalog.ts` (tiers, tael packs, tile sets), `server/rooms/modules.ts` (registers the engine's `threeWindsRoomModule` as is; its rule hooks, including the R4.6 claim-window deadline, live in the engine) and the `@threewinds/engine` dependency (`npm:@bilkobibitkov/threewinds-engine`). The ledger, room runtime and routes are framework.

Any new app-specific host code must be added to this list in the same commit, or live in the sibling repo instead.
