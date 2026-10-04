# Bilko host contract

bilko.run is a **host platform**, not a single product. It hosts many independent "apps" — each with its own product, its own scoring engine, its own UX. Some apps live in this repo; some live in their own repos and are dropped in as static assets; some live on other domains.

This document defines the contract: what the host provides, what an app must implement, and how to add a new app. Host-internal implementation detail (monitoring, QA gates, cost controls, caching, observability, security headers) lives in [`docs/host-internals.md`](host-internals.md) — read that only if you're changing the host itself, not when you're publishing an app.

## The three host kinds

Every app declares one host kind in `src/data/projectsRegistry.ts` (react-route) or `src/data/standalone-projects.json` (static-path / external-url):

| Kind | When to use | Path | Coupling |
|---|---|---|---|
| `react-route` | App needs the shared auth/credit/component kit and is small enough to live alongside the others | `/products/<slug>` | Tight — same Vite build, same Fastify server |
| `static-path` | App is built in its own repo (often its own Claude session) and just needs a URL on bilko.run | `/projects/<slug>/` | Loose — host serves prebuilt static assets, no shared runtime |
| `external-url` | App lives on another domain or subdomain | `https://<host>/...` | None — host only links to it |

Default to `static-path` for new apps — including ones that need a signed-in user (see "Calling authenticated host APIs from a `static-path` app" below). `react-route` is for the AI-tool family that already shares the kit.

## What the host provides

These are the OS services. Apps use them; they should not reimplement.

### To every app, regardless of host kind

- **Brand chrome.** Header, footer, blog, /pricing, /privacy, /terms, /admin, ⌘K command palette.
- **Portfolio listing.** Anything in the registry shows up on `/`, `/products`, and ⌘K automatically. No manual wiring.
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

- **No shared runtime.** Bring your own runtime and your own UI. The host serves the bytes. It does not inject the Clerk SDK, the component kit, or any providers into your page.

### Calling authenticated host APIs from a `static-path` app

A `static-path` app is same-origin with `/api`, so it *can* call authenticated host endpoints (`/api/games/*`, the AI-tool gateways, `/api/academy/*`). There is **one supported way to authenticate: send a Clerk session JWT in `Authorization: Bearer <token>`.** `requireAuth` / `requireAdmin` in `server/clerk.ts` read only that header.

- **Cookies are not accepted.** Clerk's first-party `__session` cookie on bilko.run is **not** read by the host, and `credentials: 'include'` by itself always gets a 401. This is deliberate. That cookie is a 60-second token that only clerk-js refreshes. A static page that doesn't run clerk-js would get intermittent 401s about a minute after page load. Accepting it would also make every mutating `/api` route cookie-authenticated, which means CSRF exposure.
- **How to get the token:** load clerk-js from the host's Clerk Frontend API (`https://clerk.bilko.run/npm/@clerk/clerk-js@5/dist/clerk.browser.js`, with the bilko.run publishable key as `data-clerk-publishable-key`). Call `await Clerk.load()`, then `await Clerk.session?.getToken()` before **each** request. Don't cache the token, because clerk-js already caches and refreshes it. The host CSP already allows `clerk.bilko.run` in `script-src`. Copy the CSP nonce from `<meta name="csp-nonce">` onto the script tag. Reference implementation: `Bilko-Academy/src/lib/auth.ts`.
- **Gate the load cheaply:** a `__client_uat` cookie value > 0 means the user has signed in on bilko.run. If it is absent or `0`, treat the user as signed out without downloading clerk-js.
- **Identity on the server** is always the email from the verified token. Never trust a user id or email in the request body.

## What an app must implement

### Every app

A registry entry — a `static-path`/`external-url` entry in `src/data/standalone-projects.json` (validated by `mcp-host-server/src/contract/registry.ts`; see "Registry rules" below), or a `react-route` entry in `src/config/tools.ts`. Sibling repos add theirs via the [`bilko-host` MCP](../mcp-host-server/README.md) — never by hand-editing this repo.

```json
{
  "slug": "my-app",
  "name": "MyApp",
  "tagline": "One sentence: what is this and who is it for.",
  "category": "AI Tool · Content",
  "status": "live",
  "year": 2026,
  "host": { "kind": "static-path", "path": "/projects/my-app/" },
  "tags": ["Browser", "Free"]
}
```

### `react-route` apps additionally

- A `<MyAppPage />` React component in `src/pages/MyAppPage.tsx`.
- An entry in `src/config/tools.ts` (`LISTING_TOOLS`) with the slug, tagline, category, and a `loader` (the React.lazy import).
- Backend routes in `server/routes/tools/<my-app>.ts` exporting `registerMyAppRoutes(app)`, registered in `server/routes/tools/index.ts`.
- For paid features, deduct credits via `deductToken(email)` after a successful response; for free-tier, gate via `checkRateLimit()` and increment via `incrementUsage()`.

### `static-path` apps additionally

- A standalone build that emits to `dist/` in your own repo.
- Publish by calling the MCP's `publish_static_project` with `distPath` pointing at that `dist/` — it copies the bytes into `public/projects/<slug>/` of this repo directly. There is no separate manual sync step.
- The build's `index.html` must use relative or `/projects/<slug>/`-prefixed asset paths (Vite: set `base: '/projects/<slug>/'`).
- No assumption about parent-page layout — your bundle owns the entire page.
- **A `manifest.json` at the bundle root** (`dist/manifest.json`) — see "Manifest contract" below. `publish_static_project`'s `manifest` gate refuses bundles without one, and that gate cannot be bypassed.

### `external-url` apps

- Just the URL.

## Registry rules

The registry (`src/data/standalone-projects.json`) is validated by `mcp-host-server/src/contract/registry.ts` on every MCP write:

- **Slug format:** 2–40 chars of `[a-z0-9-]`, no leading or trailing hyphen.
- **Status:** one of `live`, `cooking`, `postponed`, `archived`.
- **Slugs are unique** across the registry.
- A `static-path` entry's `host.path` must equal `/projects/<slug>/` exactly.
- An `external-url` entry's `host.url` must start with `https://`.

## URL canonicalization

- `/products/<slug>` is the canonical path for every `react-route` app.
- `/projects/<slug>` redirects (301-style SPA `Navigate replace`) to `/products/<slug>`.
- `/app/<old-slug>` redirects to `/products/<canonical-slug>` per the `APP_TO_PRODUCT` map in `src/App.tsx`. (Pre-refactor compatibility.)
- `/projects/<slug>/` (trailing slash, `static-path`) does **not** redirect — it's a different host kind serving different bytes.

### Sub-paths of a `react-route` product

A `react-route` app may own arbitrary sub-paths of `/products/<slug>/` — React
Router's static segments outrank the `/products/*` splat, and a Fastify route
declared for a specific sub-path outranks `@fastify/static`'s `/*` wildcard, so
either the SPA or a server handler can claim one. Use this to keep a product's
whole surface under one root instead of scattering it across top-level paths.

Worked example — Session Manager owns everything under `/products/session-manager`:

| Path | Served by |
|---|---|
| `/products/session-manager` | SPA, outside `<Layout />` (own chrome) |
| `/products/session-manager/manual` | SPA, inside `<Layout />` — the Field Manual reader (free since 2.0.1) |
| `/products/session-manager/my-manual` | Fastify (`server/routes/manual.ts`) — "it's free now" page for past buyers (receipt-email target) |
| `/products/session-manager/remote` | Fastify 301 → the published web-remote bundle |
| `/manual`, `/my-manual` | Fastify 301 → the two paths above, **permanently** |

The two legacy top-level paths can never be deleted: they are printed in Stripe
receipt emails already in customers' inboxes (`server/routes/stripe.ts`).

### What must NOT move under `/products/<slug>/`

A published `static-path` **bundle**. `public/projects/<slug>/` is the only
prefix `publish_static_project` writes, and a bundle's own URL can be compiled
into deployed clients. Session Manager's web-remote is the case in point: its
relay URL is baked into already-paired phones, so `/products/session-manager/remote`
is a **301 to the bundle**, not a second copy of it.

### One publisher per `/projects/<slug>/` prefix

`publish_static_project` stages the new build, then atomically swaps it in for
`public/projects/<slug>/` (copy → rename-swap). That swap still means two
publishers targeting one slug overwrite each other on their next publish —
including when one writes only sub-directories (`/home/`, `/feature/`,
`/architecture/`) that the other's bundle doesn't contain.

**Rule: a slug's static prefix has exactly one publisher.** A project with a
second static surface (project-home lenses, docs, a demo) either folds those
files into the same bundle before publishing, or registers them under a distinct
slug. For `session-manager`, the owning publisher is the **web-remote phone app**;
project-home lenses must not target that prefix.

## Adding a new app — checklist

1. Decide the host kind. Default `static-path` unless you need shared auth/credits → `react-route`.
2. Build it.
   - `react-route`: page + route entry + per-tool server file.
   - `static-path`: standalone repo, `vite build`.
3. Register and publish via the [`bilko-host` MCP](../mcp-host-server/README.md) — see below. `react-route` apps still register by hand in `src/config/tools.ts`.
4. Run `pnpm test && pnpm exec tsc --noEmit && pnpm exec vite build` — all must pass.
5. Commit and push to `origin`. Render auto-deploys. (Never push to `content-grade` — it's a separate, unrelated project with diverged history.)
6. Verify the project shows up on `/`, `/products`, and in ⌘K.

## Adding from a sibling-repo Claude session (MCP)

A sibling repo (e.g. `~/Projects/Outdoor-Hours`) should NOT edit this repo by hand. Wire up the [`bilko-host` MCP server](../mcp-host-server/README.md) in your sibling's `.mcp.json`, then per session:

```
1. bilko-host__get_host_contract                          # read this file
2. bilko-host__list_projects                              # check slug isn't taken
3. (build your app: pnpm build → dist/)
4. bilko-host__register_static_project { slug, name, … }  # first deploy only
5. bilko-host__publish_static_project { slug, distPath, sourceRepoPath }  # every deploy
6. bilko-host__status                                     # verify
```

The MCP commits + pushes to `origin` automatically, from a dedicated clean
checkout kept in sync with `origin/main` (never your own working tree); Render
redeploys within ~minute. If the push fails (conflicting concurrent publish,
network error), the tool call returns an error instead of silently dropping
your publish — retry it.

## Removing an app

1. Delete its entry from the registry. Sibling sessions: `bilko-host__unregister_project { slug, deleteAssets: true }` does both the registry edit and the asset removal.
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

## Manifest contract

Every `static-path` sibling MUST emit `dist/manifest.json` as part of its build. The `publish_static_project` MCP tool's `manifest` gate validates this file and refuses to publish if it's absent or invalid — this is the one gate that cannot be bypassed. The host stores the latest manifest per app in the `app_manifests` Turso table, visible at `/admin` → Manifests tab.

### Schema

Defined in `shared/manifest-schema.ts` (Zod) and mirrored in `mcp-host-server/src/manifest-schema.ts` (the MCP's own copy, used by the `manifest` gate at publish time — keep both in sync). All fields required unless marked optional.

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

### Multi-document bundles

A `static-path` app is one registry slug pointing at one `dist/` tree
(`public/projects/<slug>/`), served verbatim by Fastify static — nothing
requires that tree to contain only a single page. A sibling can ship any
number of additional HTML documents alongside its root page, each reachable
at `bilko.run/projects/<slug>/<subpath>/` for free, with no new host
capability required. Two things about the contract apply across the **whole
bundle**, not per-document:

- **`budget` gate is bundle-wide.** The gzip budget — and the 200 KB default
  limit it's checked against — covers *every* file under `dist/`, summed.
  Adding a second or third document eats into the same budget as the root
  page, not a fresh allowance each. Request a higher per-app budget in
  `mcp-host-server/src/contract/app-budgets.ts` if a multi-document bundle
  needs it.
- **`golden` gate only covers the root document.** `manifest.golden.path`
  is a single URL the synthetic monitor and `golden` gate check — point it
  at the root (`/projects/<slug>/`) unless you deliberately want the
  golden check to watch a different document instead. There is no
  per-document golden check.

## Publish gate

Every static-path publish runs five gates in order, against `distPath` (and `sourceRepoPath`, where required). All must pass, or be explicitly bypassed, before the bundle is swapped into `public/projects/<slug>/`.

| Gate | What it checks | Bypassable |
|---|---|---|
| `manifest` | `manifest.json` exists at the bundle root, parses, validates against the Zod schema, and its `slug` matches the registered slug | **No — never bypassable** |
| `budget` | Real gzipped size of every file under `distPath`, measured fresh by the gate (`mcp-host-server/src/contract/app-budgets.ts`), not the manifest's self-reported number — must be ≤ the app's budget (default 200 KB gz) | `budget` |
| `golden` | `tests/golden.spec.ts` exists in `sourceRepoPath` and passes under `pnpm exec playwright test` | `golden` |
| `a11y` | axe-core scan of `manifest.golden.path`, served from a local static server over the staged bundle, finds zero `serious`/`critical` violations | `a11y` |
| `audit` | `pnpm audit --prod --audit-level=high --json` run in `sourceRepoPath`; the gate reads vulnerability counts from the JSON output regardless of the process's exit code, and fails if `high + critical > 0` | `audit` |

The `manifest` gate short-circuits the pipeline — if it fails, the other four are skipped (their results would be meaningless without a valid manifest).

### `sourceRepoPath` requirement

`sourceRepoPath` is the sibling repo root (e.g. `"/home/bilko/Projects/Stack-Audit"`) and is needed by the `golden` and `audit` gates to locate `tests/golden.spec.ts` and run `pnpm audit`. Pass it on every publish call — without it, both gates fail outright (and both are in the default, non-bypassed set), so in practice a publish cannot clear the gate without it unless you explicitly bypass `golden` and `audit`.

### Bypassing a gate

Pass `bypass` (comma-separated gate names) and `bypassReason` (at least 15 characters) to `publish_static_project`. Multiple gates can be bypassed in a single call — e.g. `bypass: "golden,audit"` with one shared `bypassReason` — each is logged as its own row:

```
bilko-host__publish_static_project {
  slug: "stack-audit",
  distPath: "/home/bilko/Projects/Stack-Audit/dist",
  sourceRepoPath: "/home/bilko/Projects/Stack-Audit",
  bypass: "a11y",
  bypassReason: "Known contrast issue tracked in issue #42, fix ships next build"
}
```

`manifest` is rejected as a bypass name — that gate cannot be skipped. An unknown gate name, or a reason under 15 characters, is also rejected before any gate runs. Every accepted bypass is logged to the `publish_overrides` table (slug, gate, reason, admin_email, timestamp).

### App budget table

Default budget per app: **200 KB gzipped**, from `DEFAULT_BUDGET_GZ_BYTES` in `mcp-host-server/src/contract/app-budgets.ts`. Per-app overrides live in that same file's `APP_BUDGETS_GZ_BYTES` map — add an entry there (with a one-line comment explaining why) to raise a slug's limit; there's no DB/SQL path for this anymore.

## Game services

For games hosted on bilko.run (current: Boat Shooter; upcoming: Sudoku), the host provides three platform services accessed via the `@bilkobibitkov/host-kit` React hooks `useLeaderboard`, `useSaveState`, and `useUnlocks`.

### Endpoints

All endpoints live under `/api/games/:slug/`. Endpoints marked *Required* need a Bearer token (see "Calling authenticated host APIs from a `static-path` app").

Leaderboard and achievement endpoints require `slug` to be registered in `shared/game-config.ts`. **Save-state endpoints accept any slug** — they're a per-user, per-slug blob store (≤ 32 KB) with no `GAME_CONFIGS` entry needed. Non-game apps rely on this, e.g. Academy stores course progress at `/api/games/academy/save`. `tests/game-services.test.ts` guards that behavior.

#### Leaderboard

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST /api/games/:slug/scores` | Required | Submit `{ score, mode?, payload?, sig?, ts? }`. Rate-limited 60/hour/user. Validates `score ≤ maxPlausibleScore`. |
| `GET /api/games/:slug/scores` | Open | Query `range=today\|week\|all`, `mode`, `limit` (max 500). Returns `{ scores: ScoreRow[] }`. `display_name` is the email prefix. |

#### Save state (one row per user per game)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET /api/games/:slug/save` | Required | Returns `{ blob, version, updated_at }`. |
| `PUT /api/games/:slug/save` | Required | Body `{ blob, expectedVersion? }`. CAS: if `expectedVersion` ≠ current, returns 409 with `currentVersion`. Blob ≤ 32 KB. |
| `DELETE /api/games/:slug/save` | Required | Clears the save for the authenticated user. |

#### Achievements

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST /api/games/:slug/unlock` | Required | Body `{ key }`. Idempotent. Returns `{ ok, alreadyUnlocked, unlocked_at }`. |
| `GET /api/games/:slug/unlocks` | Required | Returns `{ unlocks: Array<{key, unlocked_at}> }` for authenticated user. |
| `GET /api/games/:slug/achievements` | Open | Returns full `{ achievements }` catalog (declared in `GAME_CONFIGS`). |

### Registry shape (`shared/game-config.ts`)

```ts
export interface GameConfig {
  slug: string;
  scoreOrder: 'asc' | 'desc';   // 'desc' = higher better; 'asc' = lower time
  maxPlausibleScore: number;     // score above this is rejected as cheat
  achievements: Array<{
    key: string;                 // stable id — changing breaks existing unlocks
    name: string;
    description: string;
    icon: string;
    secret?: boolean;            // hides name/desc until unlocked
  }>;
}
```

Adding a new achievement key is a code change to `shared/game-config.ts`. Keys are stable — never rename a key after it has been unlocked by real users.

Access all three from `@bilkobibitkov/host-kit`'s `useLeaderboard(slug, opts)`, `useSaveState<T>(slug)`, and `useUnlocks(slug)` hooks.

### Anti-cheat

Score submission is rate-limited to 60/hour per (user × game) and scores above `maxPlausibleScore` are rejected with 400. Optional HMAC: set `BILKO_GAME_HMAC_KEY`; the client signs `${slug}:${score}:${mode}:${ts}` and the server validates the `sig` field on POST.

## Why this contract exists

The AI tools were originally built as one product with one codebase. They've grown into independent products that happen to share a host. This contract makes that explicit, so:

- Adding a new tool is a checklist, not an architectural decision.
- A failing tool can't break the others (per-tool server files, code-split frontend bundles).
- Any tool can be extracted to its own repo later by following the `static-path` migration: build standalone, publish into `public/projects/<slug>/` via the MCP, switch the host kind. No URL change for users.

See [`docs/host-internals.md`](host-internals.md) for monitoring, QA, cost, caching, observability, and security-header detail.
