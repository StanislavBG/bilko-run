# Bilko host contract

bilko.run is a **host platform**, not a single product. It hosts many independent "apps" — each with its own product, its own scoring engine, its own UX. Some apps live in this repo; some live in their own repos and are dropped in as static assets; some live on other domains.

This document defines the contract: what the host provides, what an app must implement, and how to add a new app.

## The three host kinds

Every app declares one host kind in `src/data/projectsRegistry.ts`:

| Kind | When to use | Path | Coupling |
|---|---|---|---|
| `react-route` | App needs the shared auth/credit/component kit and is small enough to live alongside the others | `/products/<slug>` | Tight — same Vite build, same Fastify server |
| `static-path` | App is built in its own repo (often its own Claude session) and just needs a URL on bilko.run | `/projects/<slug>/` | Loose — host serves prebuilt static assets, no shared runtime |
| `external-url` | App lives on another domain or subdomain | `https://<host>/...` | None — host only links to it |

Default to `static-path` for new apps unless they need shared auth or credits. `react-route` is for the AI-tool family that already shares the kit.

## What the host provides

These are the OS services. Apps use them; they should not reimplement.

### To every app, regardless of host kind

- **Brand chrome.** Header, footer, blog, /pricing, /privacy, /terms, /admin, ⌘K command palette.
- **Portfolio listing.** Anything in `projectsRegistry.ts` shows up on `/`, `/products`, and ⌘K automatically. No manual wiring.
- **Domain.** `bilko.run/<your-path>`.

### To `react-route` apps additionally

- **Auth: Clerk.** Available via `useUser()` and `useAuth()` from `@clerk/clerk-react`. Server-side: `requireAuth(req, reply)` from `server/clerk.ts` returns the Clerk email or 401s.
- **Credits: token wallet.** Spend via `deductToken(email)` and check via `getTokenBalance(email)` from `server/services/tokens.ts`. Free users get a starter grant via `grantFreeTokens(email)`.
- **Payments: Stripe.** Subscription state via `getActiveSubscriptionLive(email)`; one-time purchases via `hasPurchased(email, productKey)`. Both from `server/services/stripe.ts`.
- **Rate limiting.** `checkRateLimit(ipHash, endpoint, email?, productKey?)` from `server/routes/tools/_shared.ts` — handles free-tier daily caps, paid-tier caps, pro-skip.
- **Page-view analytics.** `usePageView()` hook fires once per route mount.
- **Component kit.** `src/components/tool-page/` — `ToolHero`, `ScoreCard`, `SectionBreakdown`, `CompareLayout`, `Rewrites`, `CrossPromo`, `colors.ts`. Use these instead of building custom UI for grade/score displays.
- **Tool API hook.** `useToolApi()` in `src/hooks/` wraps auth, submit, compare, generate, error/loading/token state.
- **Gemini.** `askGemini(prompt, opts)` from `server/gemini.ts`. Use `parseJsonResponse` (re-exported as `parseResult` in `_shared.ts`) for JSON outputs.
- **Database.** Turso/libSQL via `dbGet/dbAll/dbRun/dbTransaction` from `server/db.ts`. Falls back to local SQLite in dev. All SQL parameterized.

### To `static-path` and `external-url` apps additionally

- **Nothing.** That's the point. Bring your own runtime, your own auth (or none), your own everything. Host just serves the bytes.

## What an app must implement

### Every app

A single entry in `src/data/projectsRegistry.ts`:

```ts
{
  slug: 'my-app',
  name: 'MyApp',
  tagline: 'One sentence: what is this and who is it for.',
  category: 'AI Tool · Content', // or 'Game', 'Data', etc.
  status: 'live', // | 'cooking' | 'archived'
  year: 2026,
  host: { kind: 'static-path', path: '/projects/my-app/' },
  tags: ['Browser', 'Free'],
}
```

### `react-route` apps additionally

- A `<MyAppPage />` React component in `src/pages/MyAppPage.tsx`.
- An entry in `src/config/tools.ts` (`LISTING_TOOLS`) with the slug, tagline, category, and a `loader` (the React.lazy import).
- Backend routes in `server/routes/tools/<my-app>.ts` exporting `registerMyAppRoutes(app)`, registered in `server/routes/tools/index.ts`.
- For paid features, deduct credits via `deductToken(email)` after a successful response; for free-tier, gate via `checkRateLimit()` and increment via `incrementUsage()`.

### `static-path` apps additionally

- A standalone build that emits to `dist/` in your own repo.
- A sync step (manual or scripted) that copies `dist/` into `public/projects/<slug>/` of this repo.
- The build's `index.html` must use relative or `/projects/<slug>/`-prefixed asset paths (Vite: set `base: '/projects/<slug>/'`).
- No assumption about parent-page layout — your bundle owns the entire page.
- **A `manifest.json` at the bundle root** (`dist/manifest.json`) — see "Manifest contract" below. `publish_static_project` refuses bundles without one.

### `external-url` apps

- Just the URL.

## URL canonicalization

- `/products/<slug>` is the canonical path for every `react-route` app.
- `/projects/<slug>` redirects (301-style SPA `Navigate replace`) to `/products/<slug>`.
- `/app/<old-slug>` redirects to `/products/<canonical-slug>` per the `APP_TO_PRODUCT` map in `src/App.tsx`. (Pre-refactor compatibility.)
- `/projects/<slug>/` (trailing slash, `static-path`) does **not** redirect — it's a different host kind serving different bytes.

## Adding a new app — checklist

1. Decide the host kind. Default `static-path` unless you need shared auth/credits → `react-route`.
2. Build it.
   - `react-route`: page + route entry + per-tool server file.
   - `static-path`: standalone repo, `vite build`, copy `dist/` into `public/projects/<slug>/`.
3. Register it in `src/data/standalone-projects.json` (`static-path`/`external-url`) or `src/config/tools.ts` (`react-route`). Sibling sessions should use the [`bilko-host` MCP](../mcp-host-server/README.md) — see below.
4. Run `pnpm test && pnpm exec tsc --noEmit && pnpm exec vite build` — all must pass.
5. Commit and push to both remotes (`origin` and `content-grade`). Render auto-deploys.
6. Verify the project shows up on `/`, `/products`, and in ⌘K.

## Adding from a sibling-repo Claude session (MCP)

A sibling repo (e.g. `~/Projects/Outdoor-Hours`) should NOT edit this repo by hand. Wire up the [`bilko-host` MCP server](../mcp-host-server/README.md) in your sibling's `.mcp.json`:

```json
{
  "mcpServers": {
    "bilko-host": {
      "command": "node",
      "args": ["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]
    }
  }
}
```

Then per session:

```
1. bilko-host__get_host_contract                         # read this file
2. bilko-host__list_projects                             # check slug isn't taken
3. (build your app: pnpm build → dist/)
4. bilko-host__register_static_project { slug, name, … }   # first deploy only
5. bilko-host__publish_static_project { slug, distPath }   # every deploy
6. bilko-host__status                                    # verify
```

The MCP commits + pushes to both host remotes automatically; Render redeploys within ~minute.

## Removing an app

1. Delete its entry from `src/data/standalone-projects.json` (or `src/config/tools.ts` if `react-route`). Sibling sessions: `bilko-host__unregister_project { slug, deleteAssets: true }` does both.
2. For `react-route`: also delete the page (`src/pages/<slug>Page.tsx`) and per-tool server file (`server/routes/tools/<slug>.ts`) and remove the call from `server/routes/tools/index.ts`.
3. For `static-path`: `rm -rf public/projects/<slug>/` (or pass `deleteAssets: true` to the MCP).
4. Add a redirect in `src/App.tsx` if the slug is still being linked from outside.

## Telemetry contract

Every sibling app SHOULD call `initTelemetry({ app, version })` from
`@bilkobibitkov/host-kit` at boot. This wires three signals automatically:

- `track(name, props)` → `analytics_events` (same table as `/api/analytics/event`)
- `log.info|warn|error(msg, fields)` → `app_logs` (info sampled at 10% by default)
- Uncaught `window.error` + `unhandledrejection` → `app_errors` (100% sampled, de-duped at 3/min per fingerprint)

The SDK is non-blocking and batched (5s buffer, flush on page-hide). It uses
`sendBeacon` so late-lifecycle errors are not dropped. PII keys matching
`/(email|password|token|key|ssn|card|cvv|apikey)/i` are redacted client-side
before any send.

```ts
import { initTelemetry } from '@bilkobibitkov/host-kit';
initTelemetry({ app: 'my-app', version: '1.0.0' });
```

Server endpoints (all rate-limited per IP, append-only tables):

| Endpoint | Table | Rate limit |
|---|---|---|
| `POST /api/telemetry/event` | `funnel_events` | 1200/min |
| `POST /api/telemetry/log` | `app_logs` | 600/min |
| `POST /api/telemetry/error` | `app_errors` | 300/min |

`track()` works without `initTelemetry` (falls back to pre-0.3.0 direct-send).
Apps that don't call `initTelemetry` get no structured logs or error capture.

Out of scope for this contract version: source-map symbolication, log retention
TTL, Node/CLI SDKs, real-time streaming, cross-app trace IDs.

## Manifest contract

Every `static-path` sibling MUST emit `dist/manifest.json` as part of its build. The `publish_static_project` MCP tool validates this file and refuses to publish if it's absent or invalid. The host stores the latest manifest per app in the `app_manifests` Turso table, visible at `/admin` → Manifests tab.

### Schema

Defined in `shared/manifest-schema.ts` (Zod). All fields required unless marked optional.

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` (literal) | Must be exactly `1` |
| `slug` | `string` | Must match the registered slug. Regex: `/^[a-z0-9-]{2,40}$/` |
| `version` | `string` | Semver, e.g. `"1.2.3"`. Read from `package.json` |
| `builtAt` | ISO 8601 UTC string | `new Date().toISOString()` at build time |
| `gitSha` | `string` | 7–40 hex chars. `git rev-parse --short HEAD` |
| `gitBranch` | `string` | `git rev-parse --abbrev-ref HEAD` |
| `hostKit.version` | `string` | Version of `@bilkobibitkov/host-kit` in use. `"0.0.0"` if not used |
| `golden.path` | `string` | URL path the synthetic monitor GETs. Must start with `/` |
| `golden.expect` | `string` | Optional CSS selector or text the monitor checks for |
| `health.path` | `string` (optional) | If present, host health poller GETs this path every N minutes |
| `bundle.sizeBytesGz` | `integer` | Total gzip size of all dist files in bytes |
| `bundle.fileCount` | `integer` | Total number of files in the bundle |

**Limit**: The raw JSON must be under 16 KB. Larger files are rejected with an actionable error.

### Worked example (Stack-Audit)

```json
{
  "schemaVersion": 1,
  "slug": "stack-audit",
  "version": "1.0.0",
  "builtAt": "2026-05-08T14:30:00.000Z",
  "gitSha": "abc1234",
  "gitBranch": "main",
  "hostKit": { "version": "0.3.0" },
  "golden": {
    "path": "/projects/stack-audit/",
    "expect": "StackAudit"
  },
  "health": {},
  "bundle": {
    "sizeBytesGz": 245760,
    "fileCount": 38
  }
}
```

### How to emit it (build script)

Add `scripts/emit-manifest.mjs` to your repo (see Stack-Audit or Outdoor-Hours for a working example), then wire it into your build script:

```json
"build": "tsc -b && vite build && node scripts/emit-manifest.mjs"
```

The script reads `package.json`, walks the `dist/` tree, computes gzip sizes, and writes `dist/manifest.json`. It requires no additional dependencies — only Node.js built-ins.

### Drift indicator

`/admin` → Manifests tab shows a per-app drift badge computed from `hostKit.version`:
- **green** — matches the highest version seen across all manifests (`current`)
- **yellow** — exactly 1 minor version behind (`minor_behind`)
- **red** — ≥2 minors behind or different major (`major_behind`)

## Why this contract exists

The 10 AI tools were originally built as one product with one codebase. They've grown into 10 independent products that happen to share a host. This contract makes that explicit, so:

- Adding the 11th tool is a checklist, not an architectural decision.
- A failing tool can't break the others (per-tool server files, code-split frontend bundles).
- Any tool can be extracted to its own repo later by following the `static-path` migration: build standalone, drop into `public/projects/<slug>/`, switch the host kind. No URL change for users.

The OutdoorHours and Boat Shooter migrations are the reference implementations of the `static-path` lane.
