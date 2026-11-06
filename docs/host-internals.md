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

It runs by hand only: `crontab -l` and `systemctl --user list-timers` show no installed schedule for it (checked 2026-11-06). Run `pnpm synthetic` when you want a fresh result.

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
| **Size** | `manifest.bundle.sizeBytesGz` vs per-app budget from `mcp-host-server/src/contract/app-budgets.ts` (default 200 KB gz; overrides: academy 700 KB, session-manager 1.3 MB, escape-velocity ~30 MB, game-academy 5 MB; that file is the source, the publish gate reads it too); fileCount ≤ 30; stale-manifest drift detection |
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

Written to `test-results/sanity-qa-YYYY-MM-DD-HH-MM.md` (gitignored; reports are not committed). `scripts/sanity-qa-cron.sh` opens a GitHub issue tagged `qa-failure` on FAIL, but only when someone runs it.

### Cron script (not scheduled)

`scripts/sanity-qa-cron.sh` wraps the run and, on FAIL or ERROR, opens a GitHub issue on `StanislavBG/bilko-run` tagged `qa-failure` with the first 60 lines of the report (needs the `gh` CLI; token from `~/.env.cron`). No crontab entry or systemd timer installs it (`crontab -l`, `systemctl --user list-timers`). Run it by hand:

```bash
cd ~/Projects/Bilko && bash scripts/sanity-qa-cron.sh
```

The report stays local in `test-results/` (gitignored, never pushed).

### Prompt files (AI-subagent mode)

`scripts/sanity-qa-prompts/*.txt` — self-contained prompts for each subagent. These are the spec for `claude -p` invocations if you want AI-driven rather than deterministic runner execution.

## Cost controls

Three layers protect the platform from runaway Gemini spend:

1. **Per-user daily Gemini call cap** (100 calls/day default, 1000 for admin). Returns 429 + friendly message when breached.
2. **Per-app daily ceiling** (stored in `app_spend_ceilings` table, default 2000). Returns 503 + inserts a `cost_alerts` row when the app's total daily calls exceed the ceiling.
3. **Daily cost-of-revenue monitor** (`pnpm cost-monitor`): alerts if Gemini COGS exceeds 25% of Stripe revenue, or if absolute spend exceeds $50/day.

All paid AI tool gateway routes call `enforceCallLimits(ctx)` from `server/routes/tools/_shared.ts` before every Gemini invocation. Free tools (Outdoor-Hours, LocalScore) use the existing IP-only rate limiter and are exempt.

Open alerts are visible at `/admin/cost`. Ceilings can be tuned per-app via the admin UI or directly in the `app_spend_ceilings` table.

The cost monitor runs by hand only (`pnpm cost-monitor`); no crontab entry or systemd timer installs it.

## Static-asset caching

Render bills origin egress, so the host caches everything it serves out of `dist/`. Apps get this for free — there is nothing to configure in a sibling repo — but the policy determines how fast a publish becomes visible, so know it before you publish.

| File | `Cache-Control` | Effect |
|---|---|---|
| `*.html` (including `/projects/<slug>/index.html`) | `public, max-age=0, must-revalidate` | Revalidated on every view; a publish is visible immediately |
| `assets/*-<hash>.<ext>` (Vite content-hashed) | `public, max-age=31536000, immutable` | Never re-fetched; the filename changes when the bytes do |
| Images, fonts, audio, video | `public, max-age=86400` | One day |
| Everything else — `app.jsx`, `styles.css`, generated `data-*.js` | `public, max-age=600` | Up to 10 minutes stale after a publish |
| SPA fallback HTML (`setNotFoundHandler`) | `private, no-store` | Carries a per-request CSP nonce, so it can never be shared |

Two consequences worth designing around:

- **Unhashed assets can be up to 10 minutes stale.** If your app publishes on a cron and needs fresher data than that, serve the data from an API route (see `server/routes/project-data.ts`, `public, max-age=60`) rather than from a static file — that is what SocialSignalsTrader's snapshot endpoint does.
- **Content-hash your bundles if you want immutable caching.** Emit them into an `assets/` directory with a Vite-style `-<hash>` suffix and they are cached for a year. A plain `app.js` gets the 10-minute tier.

`server/static-cache.ts` also strips `Vary: Origin` and the `Access-Control-*` headers from same-origin requests for publicly cacheable assets. `@fastify/cors` runs with an allow-list, which makes it stamp `Vary: Origin` on everything, and most CDNs refuse to cache a response that varies on anything but `Accept-Encoding`. Cross-origin requests (which carry an `Origin` header) still get full CORS headers.

**Note on the edge:** bilko.run's DNS is at Porkbun, pointing straight at Render. The `server: cloudflare` / `cf-cache-status: DYNAMIC` headers you'll see come from Render's own edge, not a Cloudflare zone we control — so `DYNAMIC` on a correctly-cached asset is not a bug in this repo. The caching above is browser-side and revalidation-side: repeat views serve from disk cache, and anything that does revalidate returns a 0-byte 304 instead of the full asset.

Implementation lives in `server/static-cache.ts`. It also rewrites every file's mtime at boot to a value derived from that file's content hash, because `@fastify/send` derives its ETag from `size + mtime` and a deploy's git checkout stamps every file with a fresh mtime. Without that normalization, every deploy would invalidate every visitor's cached copy of every unchanged file — and with published projects republishing on a 30-minute cron, that is ~48 full cache resets a day. Do not "fix" a stale asset by touching mtimes; change the bytes.

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

bilko.run sends a strict CSP plus the OWASP-recommended security header set on every response (blog videos get `BLOG_VIDEO_CSP` instead of the nonce policy). All headers are applied at the Fastify hook level (`server/security-headers.ts`) so they cover both host SPA routes and `/projects/*` static-path siblings.

### Headers sent on every response

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | accelerometer, camera, gyroscope, magnetometer, USB off (`()`); geolocation, microphone, payment `(self)` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Content-Security-Policy[-Report-Only]` | Per-request nonce; see spec below |

### CSP spec

Built per request by `buildCsp` in `server/security-headers.ts`:

```
default-src 'self';
script-src  'self' 'nonce-{NONCE}' 'wasm-unsafe-eval' https://js.clerk.com https://js.stripe.com https://clerk.bilko.run 'strict-dynamic';
style-src   'self' 'nonce-{NONCE}' https://fonts.googleapis.com;
style-src-attr 'unsafe-inline';
img-src     'self' data: [blob: on /projects/ only] https://*.clerk.com https://*.stripe.com https://avatars.githubusercontent.com;
font-src    'self' data: https://fonts.gstatic.com;
connect-src 'self' https://*.clerk.com https://clerk.bilko.run https://api.stripe.com;
frame-src   'self' https://*.clerk.com https://js.stripe.com https://hooks.stripe.com;
object-src  'none';
base-uri    'self';
form-action 'self' https://*.stripe.com;
frame-ancestors 'none' | 'self';
report-uri  /api/security/csp-report;
upgrade-insecure-requests;   (only when enforced)
```

- `frame-ancestors` is `'self'` for `/projects/*` (Game Academy frames engine games as same-origin iframes) and `'none'` everywhere else.
- `upgrade-insecure-requests` is emitted only when the policy is enforced; browsers ignore it in report-only and log a console error.
- `style-src-attr 'unsafe-inline'` covers React `style={{}}` attributes, which a nonce cannot cover; `<style>` elements stay nonce-gated.
- Blog videos (`/blog-videos/<slug>/`) skip this policy and get `BLOG_VIDEO_CSP`: always enforced, `default-src 'none'`, inline script and style, `connect-src 'none'`, `frame-ancestors 'self'`, `sandbox allow-scripts`.

A fresh nonce is generated per request via `crypto.randomBytes(16)`. The on-send hook injects `nonce="..."` onto every `<script>` and `<style>` tag in HTML payloads (strings and streams, which it buffers), plus a `<meta name="csp-nonce">` for host-kit runtime CSS. HTML sent as an attachment (the Field Manual offline edition) passes through untouched.

`'wasm-unsafe-eval'` in `script-src` allows WebAssembly compilation (not JS `eval`) for Godot/WebAssembly apps like escape-velocity and LocalScore's WebGPU pipeline.

### Mode toggle

`BILKO_CSP_ENFORCE=1` enforces `Content-Security-Policy` on the host's own pages only. Static-path apps (`/projects/<slug>/`) stay `Content-Security-Policy-Report-Only` even then (decision on record 2026-10-26): they are sibling-owned code with engine-specific needs (Godot needs `'unsafe-eval'`, engines draw from `blob:` images). Before enforcing on `/projects/`, that has to become a per-project policy declared in the registry. Default (unset) is report-only everywhere.

### Violation reporting

Browsers POST violations to `/api/security/csp-report`. Reports are persisted in the `csp_violations` table (columns: `blocked_uri`, `violated_dir`, `document_uri`, `source_file`, `line_number`, `user_agent`, `created_at`). The endpoint is rate-limited to 10 req/min/IP, and deduplicated to one row per distinct (directive, blocked URI, document) per hour. Inspect violations with the admin SQL view or directly:

```sql
SELECT blocked_uri, violated_dir, document_uri, COUNT(*) as n
FROM csp_violations
GROUP BY 1, 2, 3
ORDER BY n DESC
LIMIT 50;
```

## Sanctioned app-specific host code


Host code is framework by default — it should not know about one specific app. These exceptions are allowed because the app can't work without a host-side gateway:

- AI-tool gateway routes — `server/routes/tools/` (includes the PageRoast `roast_page` MCP tool, `server/routes/tools/page-roast.ts`, registered on the `/mcp` catalog server)
- Session Manager — `server/sm-relay/`, `server/routes/sm-relay.ts`, `server/routes/manual.ts`, `server/routes/admin-session-manager-usage.ts`, `src/pages/session-manager-landing/` (includes `SessionManagerPage.tsx` and `ManualPage.tsx`), `shared/manual-catalog.ts`, `server/services/manual.ts`, `src/lib/manualClient.ts`, `src/styles/session-manager-*.css`, `data/manual/`
- Academy gateway — `server/routes/academy.ts`, `server/services/academy-quota.ts`, `shared/academy-models.ts`
- Shared Bilko coffee tip jar — `GET /coffee` in `server/routes/stripe.ts` plus catalog defaults in `shared/product-catalog.ts`; linked from the site footer, home hero and Session Manager header
- Game config — `shared/game-config.ts`
- Realtime input relay and lobby directory (Game Academy online play, game-agnostic) — `server/realtime/relay.ts`, `server/realtime/lobbies.ts`, `server/routes/realtime.ts`; contract in `docs/host-contract.md` → "Realtime relay"
- Bilko Launch Kit web product — its WEB_PRODUCTS entry in shared/web-products.ts (price id + release sha256 only; the paid zip lives in the private ~/Projects/Bilko-Launch-Kit repo and the web_product_releases table)
- Bilko Agent Factory Kit web product — its WEB_PRODUCTS entry in shared/web-products.ts (price env var + release/preview sha256 only; the zip is built in the private ~/Projects/Bilko-Launch-Kit repo and stored in the web_product_releases table)
- Human For Hire page, free hour and Bilko hour — the `bilko-hour` entry in `shared/web-products.ts`, the `'human-for-hire'` slot entry in `shared/service-slots.ts`, `shared/bilko-profile.ts` (the public contact email), `shared/booking-page.ts`, `shared/free-hour-topics.ts`, `src/pages/BookingPage.tsx`, `src/pages/BookingSteps.tsx`, `src/lib/bookingView.ts`, `src/styles/booking-page.css`, `server/bilko-profile-routes.ts` (serves `/book`, the Hire page, and 301s `/bilko`, `/hire`, `/human-for-hire` and `/projects/human-for-hire/*` to it), `server/routes/free-hour.ts` (including its `free_hour_booked` funnel event), the `free_hours_booked` count in `server/routes/admin-funnel.ts`, `server/routes/admin-bookings.ts`, `HOST_PAGE_SLUG` and `HOST_PAGE_PATHS` in `server/page-hits.ts` (they file the page's traffic and count its views in `server/routes/admin-web-products.ts`), and the free-hour functions in `server/services/service-bookings.ts` (the generic booking code in `server/routes/service-bookings.ts`, `server/services/service-bookings.ts` and `server/services/mailer.ts` is framework)
- Git Viewer hosted portfolios — `server/routes/tools/git-viewer.ts` (`/api/git-viewer/u/:login`, `/api/git-viewer/claim`, in-process generation + daily refresh), the `git_viewer_profiles` table, `verifyClerkGitHubUser` in `server/clerk.ts`, and the `git_viewer` subscription tier ($5/yr; `STRIPE_PRICE_GITVIEWER`; `priceToPlanTier` → `git_viewer` for the current price and the retired $5/mo one kept in `legacyPriceIds`, which sets `gitViewer` but never `isPro`). Generation uses the `@bilkobibitkov/git-viewer` library, loaded lazily
- Bilko credits menu — `shared/bilko-menu.ts` and the menu order code built on it (`server/services/menu-orders.ts`, `server/routes/menu-orders.ts`); see [`docs/commerce.md`](commerce.md)
- ContentGrade was retired on 2026-10-09. There are no license keys and no Pro sales. `/upgrade` redirects home. The subscription lifecycle (webhook `saveSubscription`, billing portal, `priceToPlanTier`) stays only until Stripe shows zero active ContentGrade subscriptions.

Any new app-specific host code must be added to this list in the same commit, or live in the sibling repo instead.
