# Bilko host internals

This is host-side implementation detail — monitoring, QA gates, cost controls, caching, observability, and security headers. It's for whoever is changing the host itself. If you're publishing an app, you want [`docs/host-contract.md`](host-contract.md) instead.

## Synthetic monitoring

Every 6h a headless Chromium opens each sibling's `manifest.golden.path` and
asserts `manifest.golden.expect` text is present in the page body. Results
land in the `synthetic_runs` table. Three consecutive failures open an alert
(logged via `/api/telemetry/log` as a `synthetic.fail.streak` error event, and
printed to stderr — email integration is a follow-up once an SMTP provider is
chosen). Resolution = next passing run.

The `/admin` → Synthetic tab shows a per-sibling 30-day grid (green = pass,
red = fail, grey = no run), latency p50/p95, current failure streak, and any
open alerts.

Run manually:

```bash
cd /home/bilko/Projects/Bilko && pnpm synthetic
```

Schedule via the `schedule` skill at `0 */6 * * *` using the PRD at
`~/.claude/session-manager/scheduled-plans/prds/90-platform-synthetic-cron.md`.

Tune sensitivity via `STREAK_TO_ALERT` in `scripts/synthetic-monitor.ts`
(default: 3 consecutive failures).

## Sanity QA gate

`scripts/sanity-qa.ts` is an end-to-end QA gate that must pass before any publish PRD proceeds. Every publish PRD should start with:

```bash
cd ~/Projects/Bilko
tsx scripts/sanity-qa.ts --targets=<slug> --fail-fast
test $? -eq 0 || { echo "Sanity QA failed; HALT"; exit 1; }
```

### What it checks

Five subagents run in parallel against every live static-path target:

| Subagent | Checks |
|---|---|
| **Smoke** | Playwright golden-path; game-specific flows for sudoku/mindswiffer/game-academy; no console errors |
| **Security** | CSP headers, HSTS, frame-ancestors, no leaked secrets (sk-/AIza/JWT patterns), SSRF probe on `/api/page-fetch` |
| **Perf** | Lighthouse mobile audit — Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90; LCP ≤ 2.5s, CLS ≤ 0.1, TTI ≤ 3.5s |
| **Size** | `manifest.bundle.sizeBytesGz` vs per-app budget (games: 250 KB, academy: 400 KB, others: 200 KB); fileCount ≤ 30; stale-manifest drift detection |
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

Written to `test-results/sanity-qa-YYYY-MM-DD-HH-MM.md`. The nightly cron (03:00 PDT) commits the report and opens a GitHub issue tagged `qa-failure` on FAIL.

### Cron schedule

```
0 10 * * * cd /home/bilko/Projects/Bilko && bash scripts/sanity-qa-cron.sh >> /tmp/sanity-qa-cron.log 2>&1
```

`10:00 UTC = 03:00 PDT` (DST anchor; during PST it fires at 02:00 PST — acceptable).

- On FAIL or ERROR: opens a GitHub issue on `StanislavBG/bilko-run` tagged `qa-failure` with the first 60 lines of the report (requires `gh` CLI; token sourced from `~/.env.cron`).
- Report committed to `test-results/` and pushed to `origin`.
- PRD: `~/.claude/session-manager/scheduled-plans/prds/93-sanity-qa-cron.md`.

### Prompt files (AI-subagent mode)

`scripts/sanity-qa-prompts/*.txt` — self-contained prompts for each subagent. These are the spec for `claude -p` invocations if you want AI-driven rather than deterministic runner execution.

## Cost controls

Three layers protect the platform from runaway Gemini spend:

1. **Per-user daily Gemini call cap** (100 calls/day default, 1000 for admin). Returns 429 + friendly message when breached.
2. **Per-app daily ceiling** (stored in `app_spend_ceilings` table, default 2000). Returns 503 + inserts a `cost_alerts` row when the app's total daily calls exceed the ceiling.
3. **Daily cost-of-revenue monitor** (`pnpm cost-monitor`): alerts if Gemini COGS exceeds 25% of Stripe revenue, or if absolute spend exceeds $50/day.

All paid `react-route` tools call `enforceCallLimits(ctx)` from `server/routes/tools/_shared.ts` before every Gemini invocation. Free tools (Outdoor-Hours, LocalScore) use the existing IP-only rate limiter and are exempt.

Open alerts are visible at `/admin/cost`. Ceilings can be tuned per-app via the admin UI or directly in the `app_spend_ceilings` table.

Scheduled cron: `91-platform-cost-monitor-daily.md` runs `pnpm cost-monitor` daily at 7am PT.

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

`/admin/observability` is the single ops view. It aggregates per-sibling:

- 24h traffic, errors, log warnings/errors
- Synthetic monitor pass rate + load times (p50/p95)
- Manifest version + host-kit drift
- Bundle size + git sha
- Open cost / synthetic / manifest alerts

It is a read-only page over existing tables — no new ingest. To add a column, add a JOIN in `server/routes/admin-observability.ts`. Auto-refresh defaults to 30s (configurable to 1m, 5m, off).

Host-kit drift is computed against `BILKO_LATEST_HOST_KIT` env var (set via Render dashboard). Rows for siblings with no telemetry show `—` instead of `0` to avoid false "everything's broken" signals.

When something feels wrong on bilko.run, this is the first place to look.

## Security headers

bilko.run sends a strict CSP plus the OWASP-recommended security header set on every response. All headers are applied at the Fastify hook level (`server/security-headers.ts`) so they cover both host SPA routes and `/projects/*` static-path siblings.

### Headers sent on every response

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, mic, USB, geolocation capped to `self` or `()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Content-Security-Policy[-Report-Only]` | Per-request nonce; see spec below |

### CSP spec

```
default-src 'self';
script-src  'self' 'nonce-{NONCE}' 'wasm-unsafe-eval' https://js.clerk.com https://js.stripe.com 'strict-dynamic';
style-src   'self' 'nonce-{NONCE}';
img-src     'self' data: https://*.clerk.com https://*.stripe.com https://avatars.githubusercontent.com;
font-src    'self' data:;
connect-src 'self' https://*.clerk.com https://api.stripe.com;
frame-src   https://*.clerk.com https://js.stripe.com https://hooks.stripe.com;
object-src  'none';
base-uri    'self';
form-action 'self' https://*.stripe.com;
frame-ancestors 'none';
report-uri  /api/security/csp-report;
upgrade-insecure-requests;
```

A fresh nonce is generated per request via `crypto.randomBytes(16)`. The on-send hook auto-injects `nonce="…"` onto every `<script>` and `<style>` tag in HTML string payloads, plus a `<meta name="csp-nonce">` for host-kit runtime CSS. Static-file streams served by `@fastify/static` are not rewritten (streams pass through unchanged).

`'wasm-unsafe-eval'` in `script-src` allows WebAssembly compilation (not JS `eval`) for Godot/WebAssembly apps like the escape-velocity game and LocalScore's WebGPU pipeline.

### Mode toggle

`BILKO_CSP_ENFORCE=1` → `Content-Security-Policy` (enforced).
Default (unset) → `Content-Security-Policy-Report-Only` (report-only burn-in).

### Violation reporting

Browsers POST violations to `/api/security/csp-report`. Reports are persisted in the `csp_violations` table (columns: `blocked_uri`, `violated_dir`, `document_uri`, `source_file`, `line_number`, `user_agent`, `created_at`). The endpoint is rate-limited to 60 req/min/IP. Inspect violations with the admin SQL view or directly:

```sql
SELECT blocked_uri, violated_dir, document_uri, COUNT(*) as n
FROM csp_violations
GROUP BY 1, 2, 3
ORDER BY n DESC
LIMIT 50;
```
