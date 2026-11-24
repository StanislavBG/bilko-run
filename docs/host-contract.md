# Bilko host contract

bilko.run is a **host platform**, not a single product. It hosts many independent "apps" — each with its own product, its own scoring engine, its own UX. Some apps live in this repo; some live in their own repos and are dropped in as static assets; some live on other domains.

This document defines the contract: what the host provides, what an app must implement, and how to add a new app. Host-internal implementation detail (monitoring, QA gates, cost controls, caching, observability, security headers) lives in ~/Projects/Bilko/docs/host-internals.md — read that only if you're changing the host itself, not when you're publishing an app.

## Contents

- [The three host kinds](#the-three-host-kinds)
- [What the host provides](#what-the-host-provides)
- [What an app must implement](#what-an-app-must-implement)
- [Where an app keeps its state](#where-an-app-keeps-its-state)
- [Bilko-DB](#bilko-db)
- [App backends (forwarding)](#app-backends-forwarding)
- [Registry rules](#registry-rules)
- [Project listing — who owns what](#project-listing--who-owns-what)
- [Social share cards](#social-share-cards)
- [Public project catalog](#public-project-catalog)
- [Project data snapshot](#project-data-snapshot)
- [Agent-facing surfaces](#agent-facing-surfaces)
- [URL canonicalization](#url-canonicalization)
- [Adding a new app — checklist](#adding-a-new-app--checklist)
- [Adding from a sibling-repo Claude session (MCP)](#adding-from-a-sibling-repo-claude-session-mcp)
- [Removing an app](#removing-an-app)
- [Telemetry contract](#telemetry-contract)
- [Internal traffic marker](#internal-traffic-marker)
- [Manifest contract](#manifest-contract)
- [Publish gate](#publish-gate)
- [Game services](#game-services)
- [Realtime relay](#realtime-relay)
- [Authoritative game rooms](#authoritative-game-rooms)
- [Play currency](#play-currency)
- [Selling a downloadable web product](#selling-a-downloadable-web-product)

## The three host kinds

Every app declares one host kind in `src/data/projectsRegistry.ts` (react-route) or `src/data/standalone-projects.json` (static-path / external-url):

| Kind | When to use | Path | Coupling |
|---|---|---|---|
| `react-route` | App must live in this bundle (today only Session Manager) | `/products/<slug>` | Tight — same Vite build, same Fastify server |
| `static-path` | App is built in its own repo (often its own Claude session) and just needs a URL on bilko.run | `/projects/<slug>/` | Loose — host serves prebuilt static assets, no shared runtime |
| `external-url` | App lives on another domain or subdomain | `https://<host>/...` | None — host only links to it |

Default to `static-path` for new apps — including ones that need a signed-in user (see "Calling authenticated host APIs from a `static-path` app" below). `react-route` is rare: today only Session Manager (`/products/session-manager`) uses it; its host side is in ~/Projects/Bilko/docs/host-internals.md#react-route-apps.

An `external-url` app loses shared Clerk auth and the injected analytics beacon, because the host never serves its pages.

The AI-tool gateway pattern, host code helpers and stack: ~/Projects/Bilko/docs/host-internals.md#host-stack-and-code-helpers.

## What the host provides

These are the OS services. Apps use them; they should not reimplement.

### To every app, regardless of host kind

- **Brand chrome.** Header, footer, blog, /pricing, /privacy, /terms, /admin, ⌘K command palette.
- **Portfolio listing.** Anything in the registry shows up on `/`, `/projects`, and ⌘K automatically. No manual wiring.
- **Domain.** `bilko.run/<your-path>`.

React-route apps also get in-process Clerk, credits, Stripe, rate limiting, Gemini and the database: ~/Projects/Bilko/docs/host-internals.md#react-route-apps.

### To `static-path` and `external-url` apps additionally

- **Shared UI and SDK: `host-kit`** (`packages/host-kit/`), the unscoped npm package, current release 0.11.0: `"host-kit": "^0.11.0"`, or `"host-kit": "file:../Bilko/packages/host-kit"` for a local sibling. It carries the auth API (`initAuth`, `useAuth`, `openSignIn`, `signOut`, `getAuthToken`, `authFetch`), Bearer-authenticated games hooks, `trackFlow`, and the `env` tag on every telemetry record. The scoped `@bilkobibitkov/host-kit` is not published; do not use it.
- **Bilko-DB is your app's database.** Keep each signed-in user's JSON, text and images in [Bilko-DB](#bilko-db). Do not add a database of your own.
- **No shared runtime.** Bring your own runtime and your own UI. The host serves the bytes. It does not inject the Clerk SDK, the component kit, or any providers into your page. If your app needs server logic, run your own server; bilko.run forwards `/projects/<slug>/api/*` to it (see "App backends (forwarding)" below). That server keeps its data in Bilko-DB and adds no database of its own; ask the Bilko project for storage Bilko-DB does not offer yet, such as data shared between users.
- **CSP stays report-only under `/projects/`.** The host enforces its policy on host pages only (switch: ~/Projects/Bilko/docs/deployment.md#env-vars). Static-path apps keep the report-only policy because engines need things the host policy does not grant (Godot's `JavaScriptBridge.eval` needs `'unsafe-eval'`). They also get `blob:` in `img-src`. Enforcing it under `/projects/` needs a per-project policy declared in the registry first (`server/security-headers.ts`). The host stamps its per-request nonce onto every `<script>`, `<style>`, `<link rel="preload" as="script">` and `<link rel="modulepreload">` in your HTML, so your build's own tags need no nonce. A `<script src>` your own code adds at runtime is allowed through `'strict-dynamic'`. An inline `<script>` or `<style>` your code adds needs the nonce from `<meta name="csp-nonce">`.
- **Large assets are precompressed at build time.** Files ≥1 KB of compressible types (js, css, json, wasm, pck, data, …, never HTML) get `.br`/`.gz` siblings, served with a Content-Length. Don't publish your own `.br`/`.gz` next to a source file; the build replaces them.
- **Same-origin framing only.** Responses under `/projects/` carry CSP `frame-ancestors 'self'`, so one static-path app may embed another in an iframe (e.g. Game Academy hosting an engine game slug) and talk to it over `postMessage`. Cross-origin framing is refused; every other host page is `frame-ancestors 'none'`.

### Calling authenticated host APIs from a `static-path` app

A `static-path` app is same-origin with `/api`, so it *can* call authenticated host endpoints (`/api/games/*`, the AI-tool gateways, `/api/academy/*`). There is **one supported way to authenticate: send a Clerk session JWT in `Authorization: Bearer <token>`.** `requireAuth` / `requireAdmin` in `server/clerk.ts` read only that header.

- **Cookies are not accepted.** Clerk's first-party `__session` cookie on bilko.run is **not** read by the host, and `credentials: 'include'` by itself always gets a 401. This is deliberate. That cookie is a 60-second token that only clerk-js refreshes. A static page that doesn't run clerk-js would get intermittent 401s about a minute after page load. Accepting it would also make every mutating `/api` route cookie-authenticated, which means CSRF exposure.
- **How to get the token:** load clerk-js from the host's Clerk Frontend API (`https://clerk.bilko.run/npm/@clerk/clerk-js@5/dist/clerk.browser.js`, with the bilko.run publishable key as `data-clerk-publishable-key`). Call `await Clerk.load()`, then `await Clerk.session?.getToken()` before **each** request. Don't cache the token, because clerk-js already caches and refreshes it. The host CSP already allows `clerk.bilko.run` in `script-src`. Copy the CSP nonce from `<meta name="csp-nonce">` onto the script tag. **Use host-kit instead of rolling your own:** `authFetch(url, init)` (`getAuthToken()`, `useAuth()`, `openSignIn()`) from `host-kit` does all of this. The `useSaveState` / `useUnlocks` / `useLeaderboard` hooks already use it.
- **Gate the load cheaply:** a `__client_uat` cookie value > 0 means the user has signed in on bilko.run. If it is absent or `0`, treat the user as signed out without downloading clerk-js.
- **Identity on the server** is always the email from the verified token. Never trust a user id or email in the request body.

## What an app must implement

### Every app

A registry entry — a `static-path`/`external-url` entry in `src/data/standalone-projects.json` (validated by `mcp-host-server/src/contract/registry.ts`; see "Registry rules" below), or a `react-route` entry in `src/data/projectsRegistry.ts`. Sibling repos add theirs via the `bilko-host` MCP (~/Projects/Bilko/mcp-host-server/README.md) — never by hand-editing this repo.

```json
{
  "slug": "my-app", "name": "MyApp", "tagline": "One sentence: what is this and who is it for.",
  "category": "AI Tool · Content", "status": "live", "year": 2026,
  "host": { "kind": "static-path", "path": "/projects/my-app/" }, "tags": ["Browser", "Free"]
}
```

A `react-route` app's page, route and server file: ~/Projects/Bilko/docs/host-internals.md#react-route-apps.

### `static-path` apps additionally

- A standalone build that emits to `dist/` in your own repo.
- Publish by calling the MCP's `publish_static_project` with `distPath` pointing at that `dist/` — it copies the bytes into `public/projects/<slug>/` of this repo directly. There is no separate manual sync step.
- The build's `index.html` must use relative or `/projects/<slug>/`-prefixed asset paths (Vite: set `base: '/projects/<slug>/'`).
- No assumption about parent-page layout — your bundle owns the entire page.
- **A `manifest.json` at the bundle root** (`dist/manifest.json`) — see "Manifest contract" below. `publish_static_project`'s `manifest` gate refuses bundles without one, and that gate cannot be bypassed.

### `external-url` apps

- Just the URL (`https://` only). Register it with the MCP's `register_external_project` (see below). There is no bundle, so `publish_static_project` refuses external-url slugs.

## Where an app keeps its state

**Keep your app's data in [Bilko-DB](#bilko-db).** Use browser storage only for device-local preferences and caches. Each line below links to the section that defines it.

- **Bilko-DB**: each signed-in user's JSON and text documents and images for your app. See [Bilko-DB](#bilko-db).
- **The browser** (`localStorage`, `sessionStorage`, IndexedDB, cookies): device-local preferences and caches only; see the shared-origin rule below.
- **Legacy single-slot save state**: `/api/games/<slug>/save` through host-kit's `useSaveState`, one versioned slot of at most 1 MiB of UTF-8 JSON per user per slug. Existing apps keep using it; new apps use Bilko-DB. See [Game services](#game-services).
- **Leaderboards and unlocks**: registered games only. See [Game services](#game-services).
- **Project data snapshot** and the **append-only event stream** (`POST /api/projects/:slug/events`, read at `/projects/:slug/data-events.ndjson`): both written only by the owner's publisher token. See [Project data snapshot](#project-data-snapshot).
- **Your own backend**: for server logic only. Its data belongs in Bilko-DB; it adds no database of its own. Ask the Bilko project for storage Bilko-DB does not offer yet, such as data shared between users. See [App backends (forwarding)](#app-backends-forwarding).
- **Authoritative game rooms**: table state is saved on every move and survives a deploy. See [Authoritative game rooms](#authoritative-game-rooms).
- **Realtime relay and lobby directory**: memory only, lost on a deploy or spin-down. See [Realtime relay](#realtime-relay).

**Browser storage is shared.** Every static-path app is served from the one `https://bilko.run` origin, so `localStorage`, `sessionStorage`, IndexedDB and cookies are shared with every other app and with the host's own pages (the host itself keeps `bilko_vid` there: ~/Projects/Bilko/docs/observability.md). Prefix every key with your slug, assume other apps can read it, and keep tokens and secrets out of it.

**The host has one database.** bilko.run has one database, the host's (Turso in production). Bilko-DB, game saves, scores, unlocks, rooms and play currency are shared tables in it, keyed by app or slug. An app reaches them only through the host endpoints above; it cannot query or extend them. Nothing an app writes to the server's disk or memory survives a deploy.

## Bilko-DB

Bilko-DB is every app's database: JSON and text documents and images, per signed-in user per app, kept in the host database. It is a lite store for app state, not for big data. An app runs no database of its own. The user is always the email in the verified Bearer token (see "Calling authenticated host APIs from a `static-path` app"); `:app` is your slug and must match `^[a-z0-9][a-z0-9-]{0,63}$`, a document key `^[a-z0-9][a-z0-9._-]{0,127}$`. Code: `server/routes/bilko-db.ts`, `server/services/bilko-db.ts`.

| Method and path | Auth | What it does |
|---|---|---|
| `GET /api/db/:app/docs?prefix=` | Bearer | Lists your documents, sorted by key: `{ docs: [{ key, type: 'json' \| 'text', bytes, version, updatedAt }] }`. `prefix` matches literally, at most 128 chars. |
| `GET /api/db/:app/docs/:key` | Bearer | Returns the document body with `ETag: "<version>"`; 404 `not_found`. |
| `PUT /api/db/:app/docs/:key` | Bearer | Body as `application/json` (must parse, else 400 `bad_json`) or `text/plain` / `text/markdown`; other types 415. `If-Match: "<version>"` writes only over that version, `If-None-Match: *` only creates; a mismatch is 412 `{ error: 'version_mismatch', version }`. Returns `{ key, type, version, bytes, updatedAt }`. |
| `DELETE /api/db/:app/docs/:key` | Bearer | Deletes; honours `If-Match` (412 on mismatch); 404 `not_found`. |
| `POST /api/db/:app/images` | Bearer | Body is the raw image with its `Content-Type`. 201 `{ id, url, type, bytes, createdAt }`; 400 `bad_image` when the bytes are not that type. |
| `GET /api/db/:app/images` | Bearer | Lists your images for the app: `{ images: [...] }`. |
| `GET /api/db/:app/images/:id` | None | The image bytes, for a plain `<img src>`. |
| `DELETE /api/db/:app/images/:id` | Bearer | Deletes your image; 404 `not_found`. |

| Limit | Value |
|---|---|
| Document size | 1 MiB (1,048,576 bytes) of UTF-8 per document; 413 `too_large` |
| Image size | 10 MiB (10,485,760 bytes) per image; 413 `too_large` |
| Storage per user | 100 MiB (104,857,600 bytes) of documents and images across all apps; 507 `quota_exceeded` |
| Writes | 300 per minute per user, documents and images together (PUT, POST, DELETE); 429 `rate_limited` with `Retry-After` |
| Image types | PNG, JPEG, WebP and GIF only; anything else 415 |
| Image privacy | An image link is public: anyone who has it can load the image. The id is random and unguessable. |
| Image metadata | Location and camera metadata is removed on upload: JPEG Exif and XMP segments, PNG `eXIf` chunks |

Use host-kit (`bilkoDb`, `useDoc`, `BilkoDbError`; the npm release 0.11.0 does not carry them yet, so link `file:../Bilko/packages/host-kit`). Reference: ~/Projects/Bilko/packages/host-kit/README.md#bilko-db.

```tsx
import { bilkoDb, useDoc } from 'host-kit';

const db = bilkoDb('my-app');
await db.put('settings', { theme: 'dark' });
const { url } = await db.images.upload(file);

function Notes() {
  const { value, loading, save } = useDoc<{ text: string }>('my-app', 'notes');
  if (loading) return null;
  return <textarea defaultValue={value?.text ?? ''} onBlur={(e) => save({ text: e.target.value })} />;
}
```

## App backends (forwarding)

An app that needs server logic runs its own server, anywhere it likes. bilko.run forwards one path prefix to it. The app owns its backend, its auth checks and its uptime; bilko.run only forwards. The backend's data belongs in [Bilko-DB](#bilko-db): an app adds no database of its own, and asks the Bilko project for storage Bilko-DB does not offer yet, such as data shared between users. The code is `server/app-backends/` (`config.ts`, `http.ts`, `socket.ts`).

### What is forwarded

- `/projects/<slug>/api/<rest>?<query>` goes to `<origin>/api/<rest>?<query>`. This covers HTTP of any method and WebSocket upgrades.
- The origin comes from the slug's `host.backend` in the registry, set with `set_app_backend` (see "Turning it on" below). `APP_BACKENDS` on Render is an optional override: a valid entry there wins for its slug (format in ~/Projects/Bilko/docs/deployment.md#env-vars). A slug with neither is not forwarded.
- Only that prefix is forwarded. Every other `/projects/<slug>/` path is still the static bundle.
- A path that leaves `/api/` on the backend after URL parsing (for example `..` or `%2e%2e`) gets 400 `{ "error": "bad_path" }` (a socket upgrade gets a bare 400).

### Turning it on

The app's own session turns forwarding on, changes it or clears it with the `bilko-host` MCP:

```
bilko-host__set_app_backend { slug, callerRepoPath, origin }   # origin: "https://api.example.com", or null to clear
```

- `static-path` slugs only. Only the repo bound to the slug (`callerRepoPath` equal to `host.localPath`) may call it, because the forwarder passes users' `Authorization` headers to that origin.
- `origin` is a bare `https://` origin: no path, query, hash or credentials, at most 200 chars. `null` removes `host.backend`, which stops forwarding for that slug unless `APP_BACKENDS` names it.
- The tool commits and pushes the registry. The change is live after bilko.run redeploys, in about a minute, because the forwarding map is built at boot.
- Confirm with `GET https://bilko.run/api/health`: `appBackends` maps each forwarded slug to its source, `"registry"` or `"env"` (origins are never shown). After a set, `appBackends.<slug>` is `"registry"`; after a clear, the slug is gone. If it shows `"env"`, an `APP_BACKENDS` entry on Render overrides the registry for that slug, and the tool's result says so.

### Headers

| Direction | Passed | Never passed |
|---|---|---|
| Browser to backend | `authorization`, `content-type`, `accept`, `origin`, `user-agent`, every `if-*` header. The host adds `x-forwarded-for` (the incoming list plus the peer address), `x-forwarded-proto` and `x-forwarded-host` (the host the browser used). | `Cookie`, `Host`, and everything else |
| Backend to browser | `content-type`, `cache-control`, `etag`, `last-modified`, `expires`, `location`, `retry-after`, `content-disposition`, `content-language`, `www-authenticate` (the list in `server/app-backends/http.ts`) | `Set-Cookie`, `content-length`, `content-encoding`, hop-by-hop headers, everything else |

If the backend sends no `cache-control`, the host adds `cache-control: no-store`. Redirects are not followed; a `3xx` and its `location` go back to the browser as they are.

### HTTP limits and errors

- Request bodies are capped at 64 KiB. A bigger body gets 413.
- The backend has 30 s to answer. A backend that is down, refuses the connection, or takes longer gets 502 `{ "error": "backend_unavailable" }`.
- `OPTIONS` requests are answered by the host's CORS layer and do not reach the backend.
- Forwarded HTTP bytes are counted in the host's egress meter under the key `app-backend:<slug>`.

### WebSocket

- The browser's upgrade completes only after the backend's socket is open.
- A backend that refuses the handshake: the browser gets the same HTTP status. A backend that is down or does not finish the handshake within 30 s: the browser gets 502 `{ "error": "backend_unavailable" }`.
- Text and binary frames, ping and pong, the subprotocol the backend picks, and close codes with their reasons pass both ways. That includes 1000, 1012 and the app range 4000-4999. A close with no code (1005) is passed on as a close with no code. An abnormal drop (1006) drops the other side too, so it also sees 1006.
- Frames from the browser are capped at 64 KiB. A bigger frame closes that socket with 1009.
- A bilko.run deploy closes forwarded sockets: 1012 to the browser and 1001 to the backend. Clients should reconnect on 1012.

### What the app must do

- **Check auth itself.** The browser sends the Clerk session token as `Authorization: Bearer <token>` (see "Calling authenticated host APIs" above). The backend verifies it against bilko.run's Clerk instance. The host passes the header on and checks nothing.
- **Accept `Origin: https://bilko.run` on socket upgrades.** The backend sees its own host name in `Host`, not bilko.run, so a same-origin check against `Host` refuses every forwarded socket.
- **Give the browser paths under `/projects/<slug>/api/`**, never root-relative `/api/` ones. `/api/` on bilko.run is the host's own API.

## Registry rules

The registry (`src/data/standalone-projects.json`) is validated by `mcp-host-server/src/contract/registry.ts` on every MCP write:

- **Slug format:** 2–40 chars of `[a-z0-9-]`, no leading or trailing hyphen.
- **Status:** one of `live`, `cooking`, `postponed`, `archived`.
- **Slugs are unique** across the registry.
- A `static-path` entry's `host.path` must equal `/projects/<slug>/` exactly.
- A `static-path` entry may carry `host.backend`, the bare `https://` origin that `/projects/<slug>/api/*` forwards to (set with `set_app_backend`; see "App backends (forwarding)"). Other host kinds have no `host.backend`.
- An `external-url` entry's `host.url` must start with `https://`.

## Project listing — who owns what

A project's `/projects` card is split between the sibling that owns the app and Bilko, the host.

| Owner | Fields |
|---|---|
| **Project** (its own repo) | `name`, `displayName`, `tagline`, `category`, `tags`, `status`, `thumbnail`, `listing` (`detail`, `metric`, `metricLabel`, `lang`, `audience`, `talkingPoints`, `offering`, `pricing`, `callToAction`, `avoidClaims`, `icon`, `shareImage`, `video`), and `url` on `external-url` entries |
| **Bilko** (host) | `slug`, `host` (kind, path), `year`, `launchedAt`, `public` |

Sibling sessions never ask Bilko to change card copy. They edit it themselves. Bilko-owned fields are rejected in any listing patch.

**Ownership rule.** `host.localPath` binds a slug to exactly one repo. `register_static_project` / `register_external_project` record the caller's `callerRepoPath` there, and refuses a repo that is already bound to another slug. `publish_static_project` (via `sourceRepoPath`), `unregister_project`, `update_project_listing`, `set_listing_media` and `set_app_backend` (via `callerRepoPath`) refuse any other caller.

**Content standards** are enforced by `mcp-host-server/src/contract/registry.ts` on every write. Field lengths, list counts and the allowed `status`, `offering` and `pricing` values are the Zod schemas there (`RegistryProjectSchema`, `ListingSchema`, `ListingOfferingSchema`, `ListingPricingSchema`); a rejected write names the field. `thumbnail` is an `https://` URL or a `/path`. `listing.icon`, `listing.shareImage` and `listing.video` are a bundle path starting with `/projects/<own-slug>/`, or a hosted path `/projects/<own-slug>/_media/<sha256>.<ext>` from `set_listing_media`; the file rules are in "Card media upload (set_listing_media)".

A path with `/_media/` in it must be a valid hosted path: the right slug, a 64-hex sha256, and an extension that fits the field (`.png` for `icon` and `shareImage`, `.mp4` or `.webm` for `video`). Anything else is rejected.

Banned-term rule: no text field (`name`, `displayName`, `tagline`, `category`, `tags`, and every `listing` text field) may mention the retired ContentGrade product (`/content-?grade/i`). The write fails with the slug and field name.

**Two edit paths.** Both take the same patch and run the same ownership and schema checks. `update_project_listing` sets any project-owned field on `static-path` and `external-url` entries alike; `bilko.listing.json` works only for `static-path` entries, since it rides on a publish. Neither one uploads files: to upload card media (video, share image, icon) from a local file, use `set_listing_media` (see "Card media upload (set_listing_media)" below).

1. `update_project_listing { slug, callerRepoPath, patch }` — edits the card now. Commits and pushes. Use `get_project { slug }` first to see the current entry. The result names any field the patch removed (`removed: listing.avoidClaims`).
2. `bilko.listing.json` at the sibling repo root (max 16 KB) — `publish_static_project` reads it from `sourceRepoPath` and syncs it into the registry in the same commit as the bytes. The result line reports `listing: synced from bilko.listing.json` (plus `(removed: …)` when the file deleted a field), `listing: unchanged` or `listing: no bilko.listing.json`. Invalid JSON or a rejected field fails the publish.

**The patch is a merge patch** ([RFC 7386](https://www.rfc-editor.org/rfc/rfc7386)). Send only what you want to change:

- A field you leave out keeps its current value.
- `listing` merges key by key. `{ "listing": { "audience": "…" } }` changes `audience` and keeps every other listing key, including `avoidClaims`.
- `null` removes. `{ "displayName": null }` removes a field (`displayName`, `tags`, `thumbnail` or `listing`). `{ "listing": { "avoidClaims": null } }` removes one listing key. `{ "listing": null }` removes the whole listing.
- Arrays (`tags`, `talkingPoints`, `avoidClaims`) are replaced whole. Send the full list you want.
- Deleting a key from `bilko.listing.json` does not remove it from the card. Set it to `null` in the file instead.

```json
{
  "tagline": "KOUT-7 weather report for planning outdoor hours",
  "tags": ["Browser", "Free"],
  "listing": {
    "detail": "Shows which hours of the day are comfortable outside, using ten years of local weather.",
    "audience": "Runners and gardeners",
    "talkingPoints": ["Runs fully in the browser", "No account needed"],
    "offering": "free-tool",
    "pricing": "free",
    "callToAction": "Check your outdoor hours"
  }
}
```

### Marketing meta-categories

Each project owns the marketing fields in its own `listing`. Fill them in; promoters such as Burrow read them to decide what to market and how.

`offering` says what kind of thing the project is; its values are `ListingOfferingSchema` in `mcp-host-server/src/contract/registry.ts`. `showcase` is a portfolio or presentation layer nobody signs up for; `service` is booked hours of work, where the time is the offering, not software; `experiment` makes no promise that the project stays.

`pricing` is one of `ListingPricingSchema`; `none` means nothing to buy, e.g. a showcase.

`callToAction` is the one action a promoter should ask people to take.

`avoidClaims` are claims promoters must never make about the project. Use them to rule out wrong guesses, for example "Git Viewer is a SaaS".

### Trust model

The ownership check compares a self-asserted `callerRepoPath` / `sourceRepoPath` with `host.localPath`. It guards against one project's session editing another project's slug by mistake. It does not authenticate the caller: a hostile local session can pass any path it likes. A leading `~` in `callerRepoPath` is expanded to the home directory before the absolute-path check.

**Media upload endpoint.** `PUT https://bilko.run/api/listing-media/<slug>/<sha256>.<ext>` has no auth, on purpose. Anyone may call it, but it stores only bytes that the registry already declares: the registry on GitHub `main` (or the deployed copy) must set that exact `/projects/<slug>/_media/<sha256>.<ext>` path on one of that slug's `icon`, `shareImage` or `video`. The file name must be the sha256 of the bytes, and the bytes must pass the card media checks for that field. Anything else gets `404 not declared` or `422`. So only someone who can push the registry decides what gets stored, and no deploy secret is needed. Uploads are rate limited to 20 per IP per 10 minutes, and the body is capped at 8 MB.

The real boundary is where the write tools run. They exist only in the local stdio `bilko-host` MCP on the owner's machine, and they push with the owner's GitHub access to `StanislavBG/bilko-run`. The public `https://bilko.run/mcp` is read-only.

**Going public.** `register_static_project` / `register_external_project` never set `public`; a new app is admin-only. Listing it on `/projects` and the home page is the Bilko owner's call, made in a Bilko session. Sibling sessions cannot change `public`.

## Social share cards

bilko.run generates each project's X/Twitter/OpenGraph share card from the registry. The registry tagline *is* the share copy.

- **Image:** served at `https://bilko.run/og/<slug>.png`.
- **Title:** `displayName ?? name` from the entry in `src/data/standalone-projects.json`.
- **Description:** the entry's `tagline`.
- **Injection:** when the host serves `/projects/<slug>/` HTML, it strips every `og:*` / `twitter:*` meta tag, the `<title>`, and the meta description, then injects its own. Hand-written tags in a sibling's `index.html` are overwritten, so don't write them.
- **Version:** the `og:image` URL carries `?v=<8-hex content hash>` of the card copy plus the icon and share image bytes. When any of them change, the URL changes, so X refetches the image.
- **Changing a card:** update the registry entry (`displayName`, `name`, or `tagline`) via the `bilko-host` MCP. Never edit the published copy.

### Custom share image

The same `https://bilko.run/og/<slug>.png` is two things: the X/LinkedIn link preview, and the hero image of your project's card on https://bilko.run/projects. The card loads it as `/og/<slug>.png?v=<hash>`, with the same hash as your project page's `og:image`. The hash is computed when the site is built, from the card copy plus the `icon` and `shareImage` bytes. A publish rebuilds the site, so a new `shareImage` gets a new URL and returning visitors see it on their next visit after the deploy. On the card it is shown uncropped at 1200x630 on a dark background. So your `listing.shareImage` is your hero, not an afterthought social card. A project without one shows the plain generated text card in both places.

Design it as a hero: show the product itself (real UI or the key visual), keep the name and the one-line promise legible at small sizes, and keep important content inside the central ~1000x500 safe area.

`https://bilko.run/og/<slug>.png` serves a valid `listing.shareImage` as-is; otherwise a generated card that draws a valid `listing.icon`; otherwise the plain generated card. If a declared file is missing, oversize or the wrong size at serve time, the host logs it and falls back to the next one.

Recipe for a sibling. Any host kind: call `set_listing_media { slug, callerRepoPath, media: { shareImage: "/abs/path/og.png" } }` (and `icon` the same way); see "Card media upload (set_listing_media)". A `static-path` entry can instead ship the file in the bundle: put it in the build output (`public/og.png` lands at `/projects/<slug>/og.png`), set `{ "listing": { "shareImage": "/projects/<slug>/og.png" } }` in `bilko.listing.json` or through `update_project_listing`, run `publish_static_project`, then open `https://bilko.run/og/<slug>.png` and check the card.

### Card media upload (set_listing_media)

`set_listing_media` uploads your card's video, share image and icon from local files. It works for `static-path` and `external-url` entries alike. It is the only way to give an `external-url` card media, since that entry has no bundle. A `static-path` entry can use it too, without a publish.

Inputs:

```
bilko-host__set_listing_media {
  slug,
  callerRepoPath,   # your repo root; must match the slug's host.localPath
  media: {
    video?:      "/abs/path/tile.mp4" | null,
    shareImage?: "/abs/path/og.png"   | null,
    icon?:       "/abs/path/icon.png" | null
  }
}
```

Give at least one of `video`, `shareImage`, `icon`. A value is an absolute path to a local file (a leading `~` is expanded); `null` removes that field; a field you leave out keeps its current value. Only the repo bound to the slug may call it (the same ownership rule as `update_project_listing`).

Limits (the same checks as the `share-assets` gate, in `shared/listing-media.ts` `CARD_MEDIA_LIMITS`):

| Field | File |
|---|---|
| `video` | `.mp4` (`ftyp` signature) or `.webm` (EBML signature), ≤8 MB |
| `shareImage` | `.png`, exactly 1200x630, ≤5 MB |
| `icon` | `.png`, square, 128–1024 px, ≤512 KB |

Flow:

1. **Local checks.** Each file is checked on your machine: extension, signature, size and dimensions. Any problem fails the call before anything is written. The error names the field and the file.
2. **Registry commit.** Each file's sha256 gives its hosted path, `/projects/<slug>/_media/<sha256>.<ext>`. The tool writes those paths (and removes any `null` field) in one registry commit, `listing: media <slug>`, through the isolated publish checkout, and pushes it to `origin`.
3. **Bytes upload.** The tool PUTs each file to `https://bilko.run/api/listing-media/<slug>/<sha256>.<ext>`. bilko.run stores the bytes in the host database, not in git and not in any repo. If the server does not see the new registry yet (`404`), or the network fails, the tool retries a few times. If an upload still fails, the result says so: run the same call again with the same files to finish.
4. **Redeploy.** bilko.run redeploys in about a minute. The card shows the new media after that.

Replacing a file is the same call with the new file. A new file has a new sha256, so it gets a new path and a new URL. Sending the same file again changes nothing in the registry and reports `already stored`.

Serving and caching:

- The bytes are served at `https://bilko.run/projects/<slug>/_media/<sha256>.<ext>`.
- The name is the hash of the bytes, so the file never changes at that URL. Every response is cached for a year (`Cache-Control: public, max-age=31536000, immutable`), with an ETag. A new file always gets a new URL, so visitors never see a stale one.
- Byte ranges are supported, so Safari plays MP4s.
- A hosted `shareImage` or `icon` feeds `/og/<slug>.png` the same way a bundle file does. Until the bytes are stored, the generated card stands in, cached for 60 seconds.
- Unmute: the server detects an audio track from the uploaded bytes when it stores them. It serves that flag at `<file>.json` (`{ "bytes", "contentType", "audio" }`), and the card shows Unmute only when `audio` is true.

`_media/` is reserved. A bundle must not have a top-level `_media/` folder: the `share-assets` gate fails the publish if it does.

### Card video

`listing.video` is optional. It adds a short clip to your card on https://bilko.run/projects. The PNG stays in charge everywhere else.

- The active `/projects` card plays `listing.video` looping and inline. The card's share image (`/og/<slug>.png?v=<hash>`) is the poster.
- Clips may carry sound. The video starts muted, because browsers block autoplay with sound. A Pause/Play button is always shown over the video. An Unmute button appears only when the file has an audio track. The host detects the track from the file's bytes: at build time for a bundle file, and at upload time for a file sent with `set_listing_media`.
- The visitor's pause and mute choices carry to the next card on the page. Only the active card loads the video.
- Under `prefers-reduced-motion: reduce` or Save-Data, the poster shows a Play button. No video bytes load until it is pressed. If the video fails to load or autoplay is blocked, the poster stays.
- X/LinkedIn link previews keep the PNG. The video never appears in `og:*` or `twitter:*` tags.
- A hosted video's URL (`/projects/<slug>/_media/<sha256>.<ext>`) already names its content. A bundle video's URL carries `?v=<content hash>` of the file's bytes. Either way the URL is cached for a year (`max-age=31536000, immutable`), and a new file gets a new URL.

Recipe for a sibling (any host kind):

1. Export H.264 MP4 (or VP9 WebM) at 1200x630, about 60 s or less. Keep the soundtrack: AAC in MP4 (for example `ffmpeg … -c:a aac -b:a 128k -movflags +faststart`) or Opus in WebM. Do not pass `-an`. The 8 MB cap covers video plus audio.
2. Call `set_listing_media { slug, callerRepoPath, media: { video: "/abs/path/tile.mp4" } }`. Add `shareImage` in the same call if the card has none yet.
3. Keep `shareImage` set. It is the poster and the link preview.
4. Wait about a minute for the redeploy, then check the card on https://bilko.run/projects. To remove the video, call `set_listing_media` with `{ "video": null }`.

A `static-path` entry can instead ship the file in its bundle (`public/tile.mp4` lands at `/projects/<slug>/tile.mp4`; never under `_media/`), set `{ "listing": { "video": "/projects/<slug>/tile.mp4" } }` in `bilko.listing.json` or through `update_project_listing`, and run `publish_static_project`.

## Public project catalog

Machine-readable list of exactly the cards an anonymous visitor sees on `/projects` (registry entries with `public: true`), plus how to talk about each one. Use it instead of scraping `/projects` (a client-rendered SPA) or mirroring the registry by hand. No auth.

- **JSON:** `GET https://bilko.run/api/projects` — `Cache-Control: public, max-age=300`.
- **MCP:** `https://bilko.run/mcp` — streamable HTTP, stateless (POST only). Two read-only tools: `list_projects()` returns the same body as the JSON route; `get_project(slug)` returns one entry, or an `isError` "not found" result for unknown **and** non-public slugs. No write tools. (Publishing stays in the local `bilko-host` stdio MCP.)

```jsonc
{
  "schema_version": 1,
  "generated_at": "2026-10-11T19:00:00.000Z", // ISO-8601 UTC
  "projects": [                                // /projects page order
    {
      "slug": "git-viewer",
      "name": "Git Viewer",                    // displayName ?? name, as on the card
      "tagline": "Turn your GitHub into a public portfolio",
      "category": "Data · Portfolio",
      "status": "live",                        // ProjectStatusSchema in registry.ts
      "url": "https://bilko.run/projects/git-viewer/", // absolute; the card's own link
      "tags": ["Browser", "Freemium"],
      "detail": "…",                           // drawer story; falls back to tagline
      "audience": "…",                         // who it is for; may be ""
      "talking_points": ["…"],                 // plain facts a promoter may state; may be []
      "offering": "showcase",                  // ListingOfferingSchema in registry.ts; "" when unset
      "pricing": "none",                       // ListingPricingSchema in registry.ts; "" when unset
      "call_to_action": "…",                   // the one action to ask for; "" when unset
      "avoid_claims": ["…"],                   // claims promoters must never make; [] when unset
      "share_image_url": "https://bilko.run/og/git-viewer.png" // absolute; the card X unfurls (see "Social share cards")
    }
  ]
}
```

- **`url`** is the card's real destination, so it follows the card's overrides: `session-manager` links to `https://bilko.run/products/session-manager` (its landing page), and `external-url` entries link to their external URL.
- **Source of truth:** built from `PUBLIC_CARDS` in `src/data/projectsView.ts` (`src/data/projectCatalog.ts`), so the page and the API can't disagree. Change who is public with the registry `public` flag (Bilko-owned). `detail`, `audience` and `talking_points` come from the registry entry's `listing` (`detail`, `audience`, `talkingPoints`), which the project edits itself; see "Project listing — who owns what". Talking points may be posted publicly word for word, so keep each one a plain fact the site already supports.
- **Marketing fields:** `offering`, `pricing`, `call_to_action` and `avoid_claims` come from the entry's `listing` (`offering`, `pricing`, `callToAction`, `avoidClaims`); see "Marketing meta-categories". They are `''` / `[]` when unset. They are additive under `schema_version` 1. **`avoid_claims` is binding:** consumers like Burrow must never make those claims.
- **Freshness:** the data is baked in at build time. It changes when a registry change reaches `main` and deploys.
- **Versioning:** adding a field does not bump the version. Renaming, removing, or retyping a field, or changing what `url` points at, bumps `schema_version`. Consumers should ignore fields they don't know.

## Project data snapshot

A project can publish live data for its page: `GET /api/projects/<slug>/snapshot` (public) returns the latest snapshot JSON, or 404 when none exists yet, with an `x-snapshot-updated-at` header. `POST /api/projects/<slug>/snapshot` (authenticated) replaces it. Snapshots are capped at 6 MB. Code: `server/routes/project-data.ts`.

## Agent-facing surfaces

bilko.run serves agents a plain-text storefront at `/llms.txt`, the public catalog at `/api/projects` and `/api/offers`, and a stateless MCP server at `POST /mcp`. A public static-path project whose bundle ships its own `llms.txt` (at the bundle root, served as `/projects/<slug>/llms.txt`) is linked from the storefront under "Project guides".

The wallet, MCP tools, offers, agent keys, visitor classes and the UTM funnel are platform-side money facts, not sibling requirements: see ~/Projects/Bilko/docs/commerce.md. The host's `robots.txt` rules: ~/Projects/Bilko/docs/host-internals.md#robotstxt.

## URL canonicalization

- `/products/<slug>` is the canonical path for every `react-route` app; its redirects are in ~/Projects/Bilko/docs/host-internals.md#react-route-apps.
- `/projects/<slug>/` (trailing slash, `static-path`) does **not** redirect — it's a different host kind serving different bytes.

Page-specific host content (sub-paths of a `react-route` product, what must not move under `/products/<slug>/`) lives in ~/Projects/Bilko/docs/site.md.

### One publisher per `/projects/<slug>/` prefix

`publish_static_project` stages the new build, then atomically swaps it in for `public/projects/<slug>/` (copy → rename-swap). Two publishers targeting one slug still overwrite each other on their next publish, including when one writes only sub-directories (`/home/`, `/feature/`, `/architecture/`) that the other's bundle doesn't contain.

**Rule: a slug's static prefix has exactly one publisher.** A project with a second static surface (project-home lenses, docs, a demo) either folds those files into the same bundle before publishing, or registers them under a distinct slug. For `session-manager`, the owning publisher is the **web-remote phone app**; project-home lenses must not target that prefix.

## Adding a new app — checklist

1. Decide the host kind. Default `static-path`; a signed-in app still uses `static-path` (see above). `react-route` only if it truly cannot live outside this bundle; its host-side steps are in ~/Projects/Bilko/docs/host-internals.md#react-route-apps.
2. Build it in its own repo (`vite build` to `dist/`).
3. Register and publish via the `bilko-host` MCP (~/Projects/Bilko/mcp-host-server/README.md) — see below. The MCP commits and pushes; Render auto-deploys.
4. Verify the project shows up on `/`, `/projects`, and in ⌘K.

## Adding from a sibling-repo Claude session (MCP)

A sibling repo (e.g. `~/Projects/Outdoor-Hours`) should NOT edit this repo by hand. Wire up the `bilko-host` MCP server (~/Projects/Bilko/mcp-host-server/README.md) in your sibling's `.mcp.json`, then per session:

```
1. bilko-host__get_host_contract                          # read this file
2. bilko-host__list_projects                              # check slug isn't taken
3. (build your app: pnpm build → dist/)
4. bilko-host__register_static_project { slug, name, tagline, category, status, year, callerRepoPath, … }  # first deploy only
   # app hosted on its own domain instead? bilko-host__register_external_project { slug, url, name, tagline, category, status, year, callerRepoPath, … } and skip steps 3 and 5
5. bilko-host__publish_static_project { slug, distPath, sourceRepoPath }  # every deploy; syncs bilko.listing.json if present
6. bilko-host__status                                     # verify
```

Card edits at any time, for any host kind:

```
bilko-host__get_project { slug }                                   # see the current entry
bilko-host__update_project_listing { slug, callerRepoPath, patch } # any listing field (merge patch)
bilko-host__set_listing_media { slug, callerRepoPath, media: { video?, shareImage?, icon? } }  # upload, replace or remove (null) card media
```

App backend, at any time, for a `static-path` entry:

```
bilko-host__set_app_backend { slug, callerRepoPath, origin }       # forward /projects/<slug>/api/* to origin; null clears
```

`register_static_project` (and `register_external_project`, which adds a required `https://` `url`) binds the slug to `callerRepoPath` (your repo root) and also takes optional `tags` and `displayName` (a hub-only display name, 1-60 chars). It has no `public` parameter: new apps are admin-only until the Bilko owner lists them. Later card edits go through `update_project_listing` or `bilko.listing.json`; see "Project listing — who owns what". Card media from local files goes through `set_listing_media`; see "Card media upload (set_listing_media)".

The MCP commits and pushes to `origin` automatically, from a dedicated clean checkout kept in sync with `origin/main` (never your own working tree); Render redeploys in about a minute. If the push fails (conflicting concurrent publish, network error), the tool call returns an error instead of silently dropping your publish: retry it.

## Removing an app

Call `bilko-host__unregister_project { slug, callerRepoPath, deleteAssets: true }` (`callerRepoPath` is required and must be the repo bound to the slug). It removes the registry entry and `public/projects/<slug>/`. Removing a `react-route` app, or adding a redirect for a slug still linked from outside, is host work: ~/Projects/Bilko/docs/host-internals.md#react-route-apps.

## Telemetry contract

The full adoption process, SDK reference, endpoints, rate limits and retention are in ~/Projects/Bilko/docs/observability.md. What a sibling must do:

- **Nothing for pageviews and clicks.** The host injects a beacon into every HTML page; tag important buttons with `data-track="<area>-<action>"`.
- **Call `initTelemetry({ app, version })` from `host-kit` once at boot.** Then use `trackFlow(flow, step, props)` (kebab-case), `log.*` and `logError`.
- **Every record carries `env`** (`prod`, `dev` or `test`), resolved once at init. Rules and override: ~/Projects/Bilko/packages/host-kit/README.md and ~/Projects/Bilko/docs/observability.md.
- **Never put emails, tokens or free text in props**, fields or context.
- Verify in `/admin/observability` (Sessions and Flows).

## Internal traffic marker

The owner's automation (Playwright, a Chrome attached over CDP, link checkers, curl) often shows a normal browser user agent and never signs in, so neither the bot nor the admin signal catches it. Mark it with the `bilko_internal=1` cookie. Code: `server/internal-traffic.ts`.

- **Cookie:** `bilko_internal=1`. Any request that sends it is marked.
- **Query param:** `?bilko_internal=1` on any HTML page load sets that cookie for a day (`Path=/; SameSite=Lax; Max-Age=86400`, `Secure` on https) and marks that request too. `?bilko_internal=0` clears it (`Max-Age=0`). No other request sets or clears it.
- **What it does:** page hits, page views, clicks and funnel events sent with the marker are stored with `is_internal = 1` and count as **MINE**: every admin report and `bilko-host` MCP report that defaults to `mine=exclude` drops them, and `/api/admin/flows` and `/api/admin/sessions` drop the whole session once it has a marked page view. `mine=include` counts them again; sessions report `internal: true` (and `mine: true`). Rows are marked, not visitors: the marker never adds a visitor id to the owner's devices.
- **Playwright:** set the cookie before the first `goto`:
  `await context.addCookies([{ name: 'bilko_internal', value: '1', url: 'https://bilko.run' }]);`
  or add `?bilko_internal=1` to the first URL; the cookie then rides on every later page load and beacon (same-origin `fetch` and `navigator.sendBeacon` both send it).
- **curl and link checkers:** send the cookie on every request, e.g. `curl -b bilko_internal=1 https://bilko.run/projects/`. A checker that does not keep cookies is marked only on the requests that carry it.

**Never publish or share a link that carries `?bilko_internal=1`** (posts, social, emails, READMEs, sitemaps, redirects). A real visitor who follows it gets the cookie and is hidden from every report for a day.

## Manifest contract

Every `static-path` sibling must emit `dist/manifest.json` as part of its build. The `publish_static_project` MCP tool's `manifest` gate validates this file and refuses to publish if it's absent or invalid — this is the one gate that cannot be bypassed. The host stores the latest manifest per app; its admin view is in ~/Projects/Bilko/docs/host-internals.md#admin-and-webhook-internals.

### Schema

Defined once, in `mcp-host-server/src/manifest-schema.ts` (Zod), which the `manifest` gate uses at publish time; `shared/manifest-schema.ts` re-exports it, so there is nothing to keep in sync. All fields required unless marked optional.

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` (literal) | Must be exactly `1` |
| `slug` | `string` | Must match the registered slug. Regex: `/^[a-z0-9-]{2,40}$/` |
| `version` | `string` | Semver, e.g. `"1.2.3"`. Read from `package.json` |
| `builtAt` | ISO 8601 UTC string | `new Date().toISOString()` at build time |
| `gitSha` | `string` | 7–40 hex chars. `git rev-parse --short HEAD` |
| `gitBranch` | `string` | `git rev-parse --abbrev-ref HEAD` |
| `hostKit.version` | `string` | Version of `host-kit` (or legacy `@bilkobibitkov/host-kit`) in use. `"0.0.0"` if not used |
| `golden.path` | `string` | URL path the synthetic monitor GETs. Must start with `/` |
| `golden.expect` | `string` | Optional CSS selector or text the monitor checks for |
| `health.path` | `string` (optional) | Stored only (`app_manifests.health_path`); nothing polls it |
| `bundle.sizeBytesGz` | `integer` | Total gzip size of all dist files in bytes |
| `bundle.fileCount` | `integer` | Total number of files in the bundle |

**Limit**: the raw JSON must be at most 16,000 characters; a longer file fails the gate with `manifest.json too large`.

### Worked example (Stack-Audit)

```json
{
  "schemaVersion": 1, "slug": "stack-audit", "version": "1.0.0",
  "builtAt": "2026-05-08T14:30:00.000Z", "gitSha": "abc1234", "gitBranch": "main",
  "hostKit": { "version": "0.11.0" },
  "golden": { "path": "/projects/stack-audit/", "expect": "StackAudit" },
  "health": {},
  "bundle": { "sizeBytesGz": 245760, "fileCount": 38 }
}
```

### How to emit it (build script)

Use the `host-kit` CLI (`packages/host-kit/bin/cli.js`, bin `bilko-host-kit`) and wire it after your build:

```json
"build": "tsc -b && vite build && bilko-host-kit emit-manifest --slug my-app"
```

It reads `package.json` and git, walks `dist/`, computes gzip sizes, and writes `dist/manifest.json` (override the path with `--out`). `golden.path` is set to `/projects/<slug>/`. It needs no extra dependencies.

### Multi-document bundles

A `static-path` app is one registry slug pointing at one `dist/` tree (`public/projects/<slug>/`), served verbatim by Fastify static. A sibling can ship any number of additional HTML documents alongside its root page, each reachable at `bilko.run/projects/<slug>/<subpath>/`, with no new host capability. Two parts of the contract apply to the **whole bundle**, not per document:

- **`budget` gate is bundle-wide.** It measures every file under `dist/`, summed (see "Bundle size").
- **`golden` gate only covers the root document.** `manifest.golden.path` is a single URL the synthetic monitor and `golden` gate check. Point it at the root (`/projects/<slug>/`) unless you deliberately want the golden check to watch a different document. There is no per-document golden check.

## Publish gate

Every static-path publish runs six gates in order, against `distPath` (and `sourceRepoPath`, where required). All must pass, or be explicitly bypassed, before the bundle is swapped into `public/projects/<slug>/`.

| Gate | What it checks | Bypassable |
|---|---|---|
| `manifest` | `manifest.json` exists at the bundle root, parses, validates against the Zod schema, and its `slug` matches the registered slug | **No — never bypassable** |
| `budget` | Measures the real gzipped size of every file under `distPath` (fresh, not the manifest's self-reported number) and reports it; see "Bundle size" for the one way it fails. A declared `listing.icon`/`listing.shareImage`/`listing.video` that passes the `share-assets` checks is left out of the sum | `budget` |
| `golden` | `tests/golden.spec.ts` exists in `sourceRepoPath` and passes under `pnpm exec playwright test` (template: see below) | `golden` |
| `a11y` | axe-core scan of `manifest.golden.path`, served from a local static server over the staged bundle, finds zero `serious`/`critical` violations | `a11y` |
| `audit` | `pnpm audit --prod --audit-level=high --json` run in `sourceRepoPath` (`npm audit --omit=dev --audit-level=high --json` instead when the repo has a `package-lock.json` and no `pnpm-lock.yaml`); the gate reads vulnerability counts from the JSON output regardless of the process's exit code, and fails if `high + critical > 0` | `audit` |
| `share-assets` | Each declared `listing.icon`/`listing.shareImage` is in the bundle, is a PNG, and has the right size and byte cap (see "Custom share image"). A declared `listing.video` is in the bundle, has an MP4 (`ftyp`) or WebM (EBML) signature matching its extension, and is ≤8 MB (see "Card video") | **No** |

The `manifest` gate short-circuits the pipeline — if it fails, the other five are skipped (their results would be meaningless without a valid manifest).

A successful publish returns the `gates: manifest=pass, budget=pass, …` summary line, then one indented `<gate>: <details>` line per gate. The `budget` line gives the gate's own measurement next to the manifest's self-reported size, e.g. `budget: measured 181.3 KB gz over 24 files, excluding 1 share asset(s) (manifest reported 183.0 KB); largest file assets/index.js 0.4 MiB; no size budget, only GitHub's 100 MiB per-file limit` (KB = bytes / 1024, MiB = bytes / 1048576). A blocked publish returns every gate's details as JSON instead.

Every file under `distPath` ships, and the publish never force-adds a file the host `.gitignore` would leave out. If any bundle file matches the host `.gitignore` (for example a `.env`), the publish fails at stage `commit` with `N file(s) under public/projects/<slug>, … match the host .gitignore and would not be committed, so they would 404 in production:` (the path list also names `src/data/standalone-projects.json` when the listing changes) followed by the files (the first 20, then a count of the rest); remove those files from the build and publish again. `node_modules/` path parts under `public/projects/<slug>/` are kept (the host `.gitignore` re-includes `public/projects/**/node_modules/`), so Expo/Metro package assets such as `assets/__node_modules/.pnpm/<pkg>/node_modules/…` ship as-is.

### Golden spec template

Copy the golden spec template named in the gate's error message to `tests/golden.spec.ts` in your repo.

### `sourceRepoPath` requirement

`sourceRepoPath` is the sibling repo root (e.g. `"/home/bilko/Projects/Stack-Audit"`) and is needed by the `golden` and `audit` gates to locate `tests/golden.spec.ts` and run `pnpm audit`. Pass it on every publish call — without it, both gates fail outright (and both are in the default, non-bypassed set), so in practice a publish cannot clear the gate without it unless you explicitly bypass `golden` and `audit`.

### Bypassing a gate

Pass `bypass` (comma-separated gate names) and `bypassReason` (at least 15 characters) to `publish_static_project`. Multiple gates can be bypassed in a single call — e.g. `bypass: "golden,audit"` with one shared `bypassReason` — each is logged as its own row:

```
bilko-host__publish_static_project { slug: "stack-audit", distPath: "/home/bilko/Projects/Stack-Audit/dist", sourceRepoPath: "/home/bilko/Projects/Stack-Audit",
  bypass: "a11y", bypassReason: "Known contrast issue tracked in issue #42, fix ships next build" }
```

`manifest` is rejected as a bypass name — that gate cannot be skipped. An unknown gate name, or a reason under 15 characters, is also rejected before any gate runs. Every accepted bypass is logged with its gate and reason.

### Bundle size

There is no per-app size budget and no file-count limit. The only size gate is a file over 100 MiB (`GITHUB_FILE_LIMIT_BYTES` in `mcp-host-server/src/gates/budget.ts`): the publish pushes the bundle to GitHub, which rejects larger files, so the `budget` gate fails with `<path> is <N> MiB; GitHub rejects files over 100 MiB, so this bundle cannot be pushed`. Otherwise it only reports the bundle's size. Card media files have their own rules, checked by the `share-assets` gate (see "Card media upload (set_listing_media)").

## Game services

For games hosted on bilko.run (the slugs in `GAME_CONFIGS` in `shared/game-config.ts`), the host provides three platform services accessed via the `host-kit` React hooks `useLeaderboard`, `useSaveState`, and `useUnlocks`.

### Endpoints

All endpoints live under `/api/games/:slug/`. Endpoints marked *Required* need a Bearer token (see "Calling authenticated host APIs from a `static-path` app").

Leaderboard and achievement endpoints require `slug` to be registered in `shared/game-config.ts`. **Save-state endpoints accept any slug** — they're a per-user, per-slug blob store with no `GAME_CONFIGS` entry needed. Limits: each slot holds at most 1 MiB (1,048,576 bytes) of UTF-8 JSON (413 `save too large` above that); the slug must match `^[a-z0-9][a-z0-9-]{0,63}$` (400 `bad slug`, checked before auth); each user may write 300 times per minute across all slugs (429 `rate_limited` with `Retry-After`); each user may hold at most 100 slots (a PUT that would create a 101st answers 403 `save_slot_limit`; updating an existing slot is never refused for this). Non-game apps rely on this, e.g. Academy stores course progress at `/api/games/academy/save`. `tests/game-services.test.ts` guards that behavior.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST /api/games/:slug/scores` | Required | Leaderboard. Submit `{ score, mode?, payload?, sig?, ts? }`. Rate-limited 60/hour/user. Validates `score ≤ maxPlausibleScore`. |
| `GET /api/games/:slug/scores` | Open | Leaderboard. Query `range=today\|week\|all`, `mode`, `limit` (max 500). Returns `{ scores: ScoreRow[] }`. `display_name` is the email prefix. |
| `GET /api/games/:slug/save` | Required | Save state (one row per user per slug). Returns `{ blob, version, updated_at }`. |
| `PUT /api/games/:slug/save` | Required | Body `{ blob, expectedVersion? }`. CAS: if `expectedVersion` ≠ current, returns 409 with `currentVersion`. Blob ≤ 1 MiB of UTF-8 JSON (413). 300 writes/min/user (429 + `Retry-After`). New slot refused at 100 slots/user (403 `save_slot_limit`). |
| `DELETE /api/games/:slug/save` | Required | Clears the save for the authenticated user. |
| `POST /api/games/:slug/unlock` | Required | Achievements. Body `{ key }`. Idempotent. Returns `{ ok, alreadyUnlocked, unlocked_at }`. |
| `GET /api/games/:slug/unlocks` | Required | Returns `{ unlocks: Array<{key, unlocked_at}> }` for the authenticated user. |
| `GET /api/games/:slug/achievements` | Open | Returns the full `{ achievements }` catalog (declared in `GAME_CONFIGS`). |

A game's leaderboard order, plausible-score cap and achievements catalog are declared by the host; adding a game or an achievement key is host work: ~/Projects/Bilko/docs/host-internals.md#game-services-config. Keys are stable — never rename a key after it has been unlocked by real users.

Access all three from `host-kit`'s `useLeaderboard(slug, opts)`, `useSaveState<T>(slug)`, and `useUnlocks(slug)` hooks.

### Anti-cheat

Score submission is rate-limited to 60/hour per (user × game) and scores above `maxPlausibleScore` are rejected with 400. Optional HMAC, when the host has a game HMAC key set (~/Projects/Bilko/docs/deployment.md#env-vars): the client signs `${slug}:${score}:${mode}:${ts}` and the server validates the `sig` field on POST.

## Realtime relay

A game-agnostic binary WebSocket relay for online team games, built for Game Academy's deterministic lockstep/rollback arenas (up to 5v5). The host never runs or parses a game. It authenticates the socket, assigns seats, and fans out small input frames. A public lobby directory lists open rooms, so players join from a list instead of trading room codes.

### Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/realtime/ticket` | Required (Clerk Bearer) | Body `{ roomId }`, where `roomId` matches `[A-Za-z0-9_-]{1,64}`. Returns `{ ticket, expiresAt, path, limits }`. The ticket is single-use, lasts 30 s, and is bound to the caller's email and that room. Returns 400 for a bad `roomId`, 409 `room_full`, 503 `server_full` (500 rooms per instance), and 429 above 30 tickets/min per user. |
| `GET wss://bilko.run/api/realtime/rooms/:roomId?ticket=<t>` | Ticket | WebSocket upgrade. A ticket is needed because browsers can't set `Authorization` on a WebSocket. The handshake is refused with 401 (missing, unknown, expired, reused or wrong-room ticket), 403 (an `Origin` other than `https://bilko.run` / `https://www.bilko.run`) or 404 (malformed room id). |
| `GET /api/realtime/lobbies?app=<app>` | Public | Open lobbies for `app` (`[a-z0-9-]{1,32}`), newest first: `{ lobbies: [{ roomId, gameId, host, humans, bots, capacity, updatedAt }] }`. Never contains an email. `cache-control: no-store`. 400 for a missing or malformed `app`. |
| `PUT /api/realtime/lobbies/:roomId` | Required (Clerk Bearer) | Announce or refresh a lobby (the heartbeat). Body `{ app, gameId, host, humans, bots, capacity }`, ≤ 1 KiB. Returns 200 `{ ok, expiresAt, listed }`; `listed` is false while the caller holds no seat in the room. 400 for a malformed `roomId` or body, 403 `not_owner` when another user owns the listing, 429 above 30 PUTs/min per user, 503 `directory_full` (500 listings per instance). |
| `DELETE /api/realtime/lobbies/:roomId` | Required (Clerk Bearer) | Owner only: unlist the room. 204, also when there is no listing (idempotent). 400 for a malformed `roomId`, 403 `not_owner`. |

The socket is same-origin, so the page CSP's `connect-src 'self'` already covers it.

### Seats

- A room has up to **10 seats**, ids `0..9`. The server assigns the lowest free one. An 11th user is closed with `4001 room_full`.
- Seats belong to users (the ticket's email): **one seat per user per room**. If the same user connects again, they take over their own seat; the older socket is closed with `4000 superseded`. To test locally with two tabs, use two accounts.
- When a client closes with code **1000**, its seat is freed immediately (`leave`). Any other disconnect **holds the seat for 10 s**: tab reload, network drop, heartbeat timeout, `1001`, or a bare `close()` (the server sees `1005`). During the hold, peers get `drop`. A new ticket for the same user and room within those 10 s gets the same seat back (`reconnect`). After 10 s the seat is freed (`leave`).

### Frame format

Binary frames carry relayed input. Text frames carry relay control messages (server → client only).

| Direction | Layout |
|---|---|
| client → relay (binary) | `[u8 target][payload…]`, **≤ 64 bytes total**. `target`: `0xFF` = every other connected seat, `0..9` = that seat only, `0xFE` = echo back to the sender (an RTT probe; browsers can't send WS pings). |
| relay → client (binary) | `[u8 senderSeat][payload…]`. The target byte is replaced by the sender's seat, so a peer can't spoof another seat. A broadcast is never echoed to its sender. A unicast to an empty, held or own seat is silently dropped. |
| relay → client (text JSON) | `{type:'welcome', roomId, seat, peers:[{seat,connected}], maxSeats, maxFrameBytes, ratePerSec, seatHoldMs}` once on open. After that, `{type:'peer', event:'join'\|'drop'\|'reconnect'\|'leave', seat}`. |

The payload is opaque to the relay. Versioning and encoding are the game's job (e.g. Academy's `arena-kit` codec).

### Limits and close codes

| Limit | Value | On violation |
|---|---|---|
| Frame size | 64 bytes, target byte included | close `1009`, seat freed |
| Message rate | 120 msgs/s per socket (token bucket, 120 burst) | close `4002 rate_limited`, seat freed |
| Frame kind | binary, ≥ 1 byte, target ∈ `0..9 ∪ {0xFE, 0xFF}` | close `4003`, seat freed |
| Heartbeat | protocol ping every 15 s | an unanswered ping → terminated, seat held |
| Deploy drain | on SIGTERM (`app.close()`) | every socket gets `1012` (Service Restart). Fetch a new ticket and reconnect. |

### Lobby directory

A host lists its room so others can find it and join with one click. There is no room code or invite link. Game Academy uses `app: 'game-academy'` and room ids `ga-<6 chars>` (the same id it passes to `POST /api/realtime/ticket`). Its client is `packages/platform-bilko/src/bilko-platform.ts` in Bilko-Game-Academy.

- **Body fields.** `gameId` matches `[a-z0-9-]{1,32}`. `humans` is an integer ≥ 1, `bots` an integer ≥ 0, `capacity` an integer ≤ 10 (the room's seats), with `humans + bots ≤ capacity`. `host` is a display label: control and bidi-override characters are stripped, it is trimmed and cut to 16 characters, and only an empty result is refused. Other fields are ignored. Clients must render `host` as plain text.
- **Ownership.** The first PUT for a room id makes the caller its owner. A PUT or DELETE from anyone else gets 403 until the listing is gone. **One listing per owner:** a PUT for a new room id removes the owner's previous listing.
- **Shown only while the owner holds a seat** in that relay room (live, or held for a reconnect). A PUT that arrives before the owner's socket joins is accepted, and the lobby shows once they sit down. If the owner leaves a room that still has guests, the lobby is hidden.
- **Expiry.** A listing is gone **30 s after its last PUT**, on the owner's DELETE, and **as soon as its relay room empties** (last seat released, or the deploy drain). Hosts heartbeat with a PUT every 10 s.
- **Not a matchmaker.** Lists are ordered newest first, with no MMR ordering or filtering. Seat counts are what the host says; the relay does not check them.

### Deployment constraints

Rooms and the lobby directory live in one process's memory, so the relay needs a single Render instance and a deploy drops every room (`1012`; reconnect with a fresh ticket). Tier and instance details: ~/Projects/Bilko/docs/deployment.md.

## Authoritative game rooms

A server-run table for turn-based games with hidden information and stakes, such as mahjong. The host deals from a secret seed, holds the full game state, checks every move through the game's module, plays AI seats, and sends each seat only what that seat may see. Three Winds (3PMahjong) is the first user.

**Relay or rooms?** Use the [Realtime relay](#realtime-relay) when every client runs the same deterministic simulation and the host only forwards inputs (lockstep or rollback arenas). Use authoritative rooms when a client must not see the whole state (concealed hands, a shuffled wall), when the server must decide what is legal, or when play-currency stakes are settled. The relay never sees game state; rooms never trust the client with it.

### Game module interface

A game plugs in as a `RoomGameModule<S>`, exported by `server/rooms/runtime.ts` (read the interface there): `id`, `seats`, `maxLossPoints` (the most one seat can lose in one hand; the wallet escrows it), `newHand`, `view`, `toAct`, `apply`, `aiAction`, `isOver`, `settle`, and the optional `nextDealer`, `timeoutAction` and `deadlineMs`.

- `newHand` gets a fresh 16-byte hex seed per hand. The seed and the raw state never leave the room.
- `toAct` returns the seats that may act now. More than one seat may act at once (for example a claim window).
- `apply` must be pure: return a new state or `{ ok: false }`. A client action it rejects gets `illegal_action`. An `aiAction` it rejects voids the hand.
- `settle` must return one integer per seat, summing to 0, none below `-maxLossPoints`. Anything else voids the hand.
- If any module method throws, the hand is voided: no balance changes and every escrow is released.
- The optional hooks follow the same rule. If `nextDealer`, `timeoutAction` or `deadlineMs` throws or returns an invalid value, the hand is voided. Invalid means: `nextDealer` not an integer seat, a `timeoutAction` that `apply` rejects, or a `deadlineMs` that is not a positive integer, `null` or `undefined`.

A module is registered by the host (~/Projects/Bilko/docs/host-internals.md#room-and-play-currency-wiring). An unregistered app gets `unknown_app`. A registered app's tables are open; it gets `rooms_closed` only while the owner's `ROOMS_CLOSED` emergency switch lists it (~/Projects/Bilko/docs/deployment.md#realtime-relay-constraints).

### Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/rooms/ticket` | Required (Clerk Bearer) | Body `{ app, tier }`, each `[a-z0-9-]{1,32}`, ≤ 1 KiB. Seats the caller at a waiting table of that tier (or opens one) and returns `{ ticket, expiresAt, path, roomId, tier, seat }`. `path` is `/api/rooms/socket/<roomId>?ticket=<t>`. The ticket is single-use, lasts 30 s, and is bound to the caller's email and that room. A caller already seated at a live table of this app gets a ticket for that table and seat, whatever tier was asked for (rejoin). `cache-control: no-store`. |
| `GET /api/rooms/tiers?app=<app>` | Public | `{ tiers: [{ id, stake, openSeats }] }`. `openSeats` counts empty seats at tables still waiting for their first hand. `cache-control: no-store`. |
| `GET wss://bilko.run/api/rooms/socket/:roomId?ticket=<t>` | Ticket | WebSocket upgrade. See "Socket" below. |

**`POST /api/rooms/ticket` errors**

| Status | Body | When |
|---|---|---|
| 401 | per `requireAuth` | No or invalid Clerk token. |
| 400 | `{ error: 'body must be { app, tier }, each 1-32 chars of [a-z0-9-]' }` | Missing or malformed `app` or `tier`. |
| 429 | `{ error: 'rate_limited' }` | More than 30 tickets per minute per user. |
| 404 | `{ error: 'unknown_app' }` | No game module or no `PLAY_APPS` entry for `app`. |
| 409 | `{ error: 'rooms_closed' }` | The app is registered, but the owner closed its tables with `ROOMS_CLOSED`. |
| 404 | `{ error: 'unknown_tier' }` | `tier` is not one of the app's tiers. |
| 402 | `{ error: 'insufficient_taels', balance, required }` | Balance is below `stake × maxLossPoints`. Not checked on a rejoin. |
| 503 | `{ error: 'server_full' }` | 200 tables already open in this process. |
| 503 | `{ error: 'table_moving' }`, `Retry-After: 5` | A deploy is in progress: the caller is seated at a saved table that another instance still holds, or the instance that answered is draining (then every caller gets it, seated or not, and nobody is seated). Retry after the header's seconds; it lasts up to about 90 s. Once a draining instance has closed its sockets it stops taking requests, and a request that still reaches it gets a plain 503 without `Retry-After`; retry that the same way. |

**`GET /api/rooms/tiers` errors:** 400 `{ error: 'app must be 1-32 chars of [a-z0-9-]' }`, 404 `{ error: 'unknown_app' }`, 409 `{ error: 'rooms_closed' }` (the app is registered, but the owner closed its tables with `ROOMS_CLOSED`).

### Socket

URL: `wss://bilko.run` + the `path` from the ticket response. The socket is same-origin, so the page CSP's `connect-src 'self'` covers it.

The handshake is refused with 404 (malformed room id, `[A-Za-z0-9_-]{1,64}`, or no live table with that id in this process), 403 (an `Origin` that is not allowed; see "Origin and native apps") or 401 (missing, unknown, expired, reused or wrong-room ticket). A ticket is deleted the first time it is presented, whatever the outcome.

**Client → server.** Text JSON frames only, ≤ 2048 bytes, at most 20 per second per socket (token bucket, 20 burst):

| Message | Meaning |
|---|---|
| `{ type: 'action', seq, action }` | Play `action` (opaque to the host; the module reads it). `seq` is an integer from this seat's current prompt (see below). |

- **The seq window.** An action may carry any `seq` from the seat's latest turn or claim prompt. Another seat's move in between does not make it `stale_seq`. Resending an action that was already applied does.

**Server → client.** Text JSON frames:

| Message | When |
|---|---|
| `{ type: 'state', hand, seq, seat, view, toAct, deadline }` | After every state change, and on connect or reconnect. `view` is `module.view(state, seat)` for this seat only. `toAct` lists the seats that may act. `deadline` is epoch ms. When this seat is a human seat to act, it is this seat's own autoplay time. Otherwise it is the latest autoplay time among the human seats to act. It is `null` when only AI seats act. |
| `{ type: 'error', code, seq }` | A rejected action. `code` is `illegal_action`, `not_your_turn`, `stale_seq` or `no_hand`. `seq` is the current one. |
| `{ type: 'error', code: 'insufficient_taels', seq: 0 }` | At a hand start the seat's escrow failed. The seat is taken over by AI and the player is unseated. |
| `{ type: 'hand_over', hand, view, points }` | The hand ended. `view` is this seat's final view. `points` are the module's per-seat points (not yet × stake). |
| `{ type: 'settled', hand, deltas }` | The ledger settled the hand. `deltas` are per-seat tael changes (points × stake). Sent only to seats that were escrowed. Not sent when the hand was voided or settlement failed (escrows released, no balance changed). |

**Close codes**

| Code | Reason | Meaning |
|---|---|---|
| `1000` | `room_closed` | The table closed (no human left). |
| `1009` | — | Frame over 16 KiB (refused before buffering). |
| `1012` | `server_restart` | Deploy drain (SIGTERM). The table was frozen and saved before this close; fetch a new ticket to resume it. |
| `1012` | `room_gone` | The table vanished between the handshake and the join. |
| `4000` | `superseded` | The same seat opened a newer socket. |
| `4001` | `no_seat` | The ticket holder has no seat at this table. |
| `4002` | `rate_limited` | More than 20 messages per second. |
| `4003` | `text_frames_only`, `frame_too_large`, `bad_message` | Binary frame, text frame over 2048 bytes, or not `{ type: 'action', seq, action }`. |

The server pings every 15 s. A socket that misses a pong is terminated; its seat is kept.

### Redaction

A seat only ever receives `module.view(state, seat)`. The raw state, the seed and other seats' views never go on the wire. AI seats get no messages. Keeping concealed data out of `view` is the module's job, and the module's tests must prove it.

### Reconnection

- A seat belongs to the user (the ticket's email). There is no hold timer: a seat whose socket drops stays seated and escrowed until the hand settles. While it is away, its turns are autoplayed when `deadline` passes.
- To reconnect, call `POST /api/rooms/ticket` again with the same `app`. It returns a ticket for the same table and seat. On connect the server sends the current `state`.
- A second socket for the same seat replaces the first (`4000 superseded`).
- A normal close (`1000`) during a hand marks the seat as leaving: it plays out (autoplayed) and is unseated after settlement. A `1000` close before the first hand keeps the seat. Any other close keeps the seat.
- A restart (deploy or spin-down, `1012`) does not void the hand. Every table is saved on each move. Reconnect with a fresh `POST /api/rooms/ticket`: the first seated player's ticket resumes the table, hand and escrows included. During a deploy the ticket can answer `503 { error: 'table_moving' }` with `Retry-After` for up to about 90 s, while the old instance still holds the table; retry after the header's seconds and the table resumes. A saved table nobody returns to within 10 minutes is voided and its escrows released.
- **Deploy drain.** On SIGTERM the old instance freezes every table (actions are dropped without a reply, so send them again after the table resumes; ticket requests get `503 table_moving`), saves its final state and closes every socket with `1012`. A resumed table is exactly what its players last saw: the same `seq` and the same view. Drain order: ~/Projects/Bilko/docs/host-internals.md#room-and-play-currency-wiring.

### AI seat fill and autoplay

- The first human to sit starts an 8 s fill timer. When it fires, or when every seat has a human, empty seats get AI and the first hand is dealt.
- AI seats act after 800 ms.
- A human to act has `module.deadlineMs` or 20 s (`deadline`). The time counts from when that seat became due to act. Another seat's move does not restart it.
- A timed-out human is played by `module.timeoutAction` when the module has it, else by `module.aiAction`.
- After a hand settles the next hand is dealt 5 s later. Its dealer is `module.nextDealer`; without that hook the deal passes one seat. A voided hand is dealt again by the same dealer. The first hand at a new table is dealt by seat 0.
- A table with no humans left closes.
- AI seats play against the house account: their point deltas × stake go to one house ledger row.

### Origin and native apps

Unlike the relay, a **missing `Origin` header is allowed in production**, because native iOS and Android apps send none. Browser pages must come from `https://bilko.run` or `https://www.bilko.run`. Outside production `localhost` and `127.0.0.1` are allowed too. The ticket is the only credential; the Origin check only stops cross-site browser pages. A native app gets its Clerk token, calls `POST /api/rooms/ticket`, and opens `wss://bilko.run<path>` without an `Origin`.

### Three Winds

- **Tables open.** The app id is `threewinds`. The module is the engine's own `threeWindsRoomModule`, with no host overrides, so a rule change is an engine release plus a host pin bump (~/Projects/Bilko/docs/host-internals.md#room-and-play-currency-wiring). Both room endpoints are open; they answer `409 rooms_closed` only while `ROOMS_CLOSED` includes `threewinds`.
- **Tiers:** 3 seats each; ids, names and stakes (taels per point) are the `threewinds` tiers in `PLAY_APPS` (`shared/play-currency-catalog.ts`).
- **Escrow.** At each hand start every human seat's maximum loss, `stake × maxLossPoints`, is escrowed (ref `room:<roomId>:hand:<n>`). A player who cannot cover it is replaced by AI. At hand end each human settles against their escrow; points × stake move through the play ledger.
- **A disconnected player stays escrowed until the hand settles.** Leaving mid-hand does not release the escrow; the seat is autoplayed and settles like any other.
- A voided hand or a failed settlement releases every escrow and changes no balance.
- Rooms live in one process's memory. Staked tables need a Render tier that does not sleep: ~/Projects/Bilko/docs/deployment.md#realtime-relay-constraints.

## Play currency

A per-app play currency, separate from Bilko Credits. There is one: Three Winds **taels** (app id `threewinds`). The catalog (tiers, packs, cosmetic items, signup grant) is `PLAY_APPS` in `shared/play-currency-catalog.ts`. Pack prices: ~/Projects/Bilko/docs/commerce.md#play-currency-three-winds-taels.

**Taels can never be transferred, gifted or cashed out.** No route moves taels between users or pays them out. They come only from the signup grant, purchases, free test packs (only while `PLAY_CURRENCY_FREE_PACKS` lists the app) and winning hands, and go only to losing hands and cosmetic items.

### Endpoints

All take `app` (a key of `PLAY_APPS`) and answer `private, no-store`.

| Endpoint | Auth | Success | Errors |
|---|---|---|---|
| `GET /api/play-currency/balance?app=<app>` | Clerk Bearer | 200 `{ balance, held, salesOpen, freePacks }`. `held` is escrowed in live hands. `freePacks` is `true` while `PLAY_CURRENCY_FREE_PACKS` lists the app: packs cost nothing, so show $0.00. The first call per user credits the signup grant (5000 taels) once. | 401 · 400 `unknown_app` |
| `POST /api/play-currency/checkout` | Clerk Bearer | Body `{ app, packId, currency }`, `currency` `usd` or `myr`. 200 `{ url }`: a Stripe Checkout session (`mode: payment`, metadata `play_app`, `play_pack`, `play_email`, `play_currency`; success → `/projects/<app>/?purchase=success`, cancel → `?purchase=cancel`). While `PLAY_CURRENCY_FREE_PACKS` lists the app it answers 200 `{ credited: true, packId, taels, balance }` instead: the pack's taels are credited at once (ledger kind `free_test_pack`), with no payment and no Stripe session, even when sales are open. Every call credits again. | 401 · 429 `rate_limited` (10/min/user) · 400 `unknown_app` / `unknown_pack` / `unknown_currency` · 409 `sales_closed` (never in free mode) · 503 Stripe unconfigured or error |
| `POST /api/play-currency/apple/transactions` | Clerk Bearer | Body `{ app, signedTransaction }` (StoreKit 2 JWS, ≤ 64 KiB). 200 `{ credited, balance }`. One transaction id credits one account once; a retry returns `credited: false`. | 401 · 429 `rate_limited` (30/min/user) · 400 `unknown_app` / `invalid_transaction` / `transaction_revoked` / `unknown_product` · 409 `already_claimed` (another account owns the transaction) · 503 `apple_iap_unavailable` |
| `POST /api/play-currency/apple/notifications` | None; the signed payload is the credential | App Store Server Notifications v2. Body `{ signedPayload }`, ≤ 64 KiB. 200 `{ ok: true }`. `REFUND` and `REVOKE` take the purchase's taels back (up to the current balance; the shortfall is recorded). Other types are acknowledged and ignored. | 400 `invalid_notification` · 503 `apple_iap_unavailable` |
| `GET /api/play-currency/entitlements?app=<app>` | Clerk Bearer | 200 `{ items }`: the caller's cosmetic items. | 401 · 400 `unknown_app` |
| `POST /api/play-currency/items/:itemId/purchase` | Clerk Bearer | `app` in the query or body. Spends taels on a cosmetic item. 201 `{ itemId, serial, balance }`. | 401 · 429 `rate_limited` (20/min/user) · 400 `unknown_app` · 402 `insufficient_taels` · 404 `unknown_item` · 409 `already_owned` / `sold_out` |

### Apple in-app purchase

- Product ids are `threewinds.taels.<packId>` (for example `threewinds.taels.pouch`). A transaction whose product is not in the catalog gets `unknown_product`.
- The App Store Server Notifications v2 URL is `https://bilko.run/api/play-currency/apple/notifications`.

Without the Apple env vars set, both Apple routes return `503 apple_iap_unavailable`. `PLAY_CURRENCY_SALES_OPEN`, `PLAY_CURRENCY_FREE_PACKS` and the Apple vars: ~/Projects/Bilko/docs/deployment.md#env-vars.

## Selling a downloadable web product

A web product is a paid zip sold from a static-path landing page at `/projects/<slug>/`. Declared once in `shared/web-products.ts` (`WEB_PRODUCTS`); routes, the Stripe webhook and `/admin` → Products read from it. Slugs not in `WEB_PRODUCTS` (or failing the slug regex) return 404 on every route below.

### Endpoints

All responses are JSON unless noted. Rate limits are per IP per minute.

| Endpoint | Auth | Success | Errors |
|---|---|---|---|
| `GET /api/web-products/:slug` | none | 200 `{ slug, name, displayPrice, version, available }` (`available` = release bytes stored + price id + Stripe configured; `Cache-Control: no-store`) | 404 unknown slug |
| `POST /api/web-products/:slug/checkout` | none | 200 `{ url }` — Stripe Checkout (`mode: payment`, `metadata.web_product=<slug>`, success → `/projects/<slug>/thanks/?session_id=…`, cancel → `/projects/<slug>/?checkout=cancel`); logs a `checkout_start` funnel event (`is_admin=1` when the IP has admin page hits). Recovery is on (`after_expiration.recovery`); promotion consent is collected only when the host switch is on (~/Projects/Bilko/docs/deployment.md#env-vars). A signed-in owner (Clerk header or `__session` cookie) gets a **test-mode** session (inline price from `displayPrice`, `metadata.test=true`) and no funnel row. `?dryRun=1` → 200 `{ ok, dryRun, url: null }`, no session — use it for deploy smokes | 404 unknown slug · 429 (10/min) · 409 owner but test mode unconfigured (never falls back to live) · 503 Stripe or price unconfigured · 502 Stripe error |
| `GET /api/web-products/:slug/order?session_id=cs_…` | possession of the Checkout session id; verified against Stripe (session metadata slug, complete + paid, line item price matches) and recorded | 200 `{ paid: true, slug, name, version, filename, bytes, downloadsUsed, downloadsLimit, email }` (email masked) | 400 bad session id · 402 `{ paid: false }` not paid · 404 unknown slug / session not for this product · 429 (30/min) · 502 Stripe unreachable |
| `GET /api/web-products/:slug/download?session_id=cs_…` | same as `/order` | 200 `application/zip` attachment, `private, no-store`; records a download (`via: session`) | same as `/order`, plus 429 when the per-purchase `downloadLimit` is used up · 404 release not stored |
| `PUT /api/web-products/:slug/releases/:version` | **none, by design** — body (`application/zip` or `application/octet-stream`, ≤ 5 MB) must match the committed `sha256` + `bytes` exactly, and is stored only once | 201 `{ stored: true, sha256, bytes }` | 404 unknown slug / invalid version / version not declared · 422 bytes don't match · 409 already stored · 429 (5/min) |
| `GET /api/web-products/:slug/account-download` | Clerk Bearer token; entitled by a recorded order for the token's email or a `wp_<slug>` purchase/comp-grant row | 200 `application/zip` (records `via: account`) | 401 not signed in · 402 `{ paid: false }` · 404 unknown slug / release not stored · 429 (30/min) |

The admin endpoint and the Stripe webhook's web-product handling: ~/Projects/Bilko/docs/host-internals.md#admin-and-webhook-internals.

### Stripe live vs test

Live mode holds real buyers only. Owner/agent testing never creates live sessions:
- **Owner in a browser:** sign in on bilko.run; checkout routes to test mode. Pay with `4242 4242 4242 4242`. Test orders (`cs_test_…`) deliver the zip but are never counted in `/admin`.
- **Agents/deploy smokes:** `POST /api/web-products/<slug>/checkout?dryRun=1`. Never `POST` without it against prod.
- **`/buy/<id>` links:** a browser GET opens a **live** session, including the owner's. `/buy` has no owner test mode; an owner-IP session is only flagged (`owner_ip`, `is_admin`). Agents and deploy smokes check these links with `HEAD` or `GET /buy/<id>?dryRun=1`, never a plain GET from a browser or browser automation. Scripts, AI fetchers and headless browsers get the info page, but a client that sends a browser user agent still opens a live session.
- **Full live-path check** (real webhook, real price): a 100%-off promo code on a live session is still the one sanctioned way; expect it in Stripe as a $0 completed session.

### Playbook (new product)

The host-side steps (Stripe product and price, the `WEB_PRODUCTS` entry, the price env var, the admin view) are in ~/Projects/Bilko/docs/host-internals.md#web-product-host-steps. The sibling's steps:

1. **Build the zip** in a **private** sibling repo — never in the host repo. Record the filename, byte size (≤ 5 MB) and sha256, and hand them to the host for the `WEB_PRODUCTS` entry.
2. **Upload the bytes once**, after that entry is deployed: `curl -X PUT --data-binary @<file>.zip -H 'Content-Type: application/zip' https://bilko.run/api/web-products/<slug>/releases/<version>`. No secret is needed — the server stores only bytes matching the committed sha256, once (409 afterwards). Confirm `GET /api/web-products/<slug>` returns `available: true`.
3. **Landing page** in the sibling repo, published to `/projects/<slug>/` (static-path, see above): the buy button `POST`s `/api/web-products/<slug>/checkout` and redirects to the returned `url`; read `GET /api/web-products/<slug>` to show price/availability.
   Every dollar amount on the published landing and thanks pages must be a catalog price, and the landing page must show its own `displayPrice` (markup or attributes; `<sup>$</sup>9` counts as `$9`). The host's tests fail when they differ, or when a sellable product's landing or thanks page is missing, so after a price change republish the page right away.
4. **Thanks page** at `/projects/<slug>/thanks/`: read `session_id` from the query, call `GET …/order?session_id=` to show status and then `GET …/download?session_id=` for the file. If the link is lost or the session id is missing, offer sign-in (Clerk) and call `GET …/account-download` with the Bearer token.

### Bundled and preview products

Two optional `WebProduct` fields on download products (declared by the host in `shared/web-products.ts`):

- `includes: string[]` — slugs of other download products delivered with this purchase. Example: the Agent Factory Setup service (`hfh-factory-setup`) has `includes: ['agent-factory-kit']`, so its buyers get the Kit. `GET /api/web-products/:slug/order` then returns an `included` array of `{ slug, name, downloadUrl }` (only entries whose release exists), each `downloadUrl` being `/api/web-products/<included-slug>/download?session_id=…`.
- `preview: { version, filename, bytes, sha256 } | null` — a free preview zip, pinned by sha256 like `release`. Signed-in visitors (Clerk Bearer, no purchase) fetch it with `GET /api/web-products/:slug/preview` (401 not signed in, 404 not stored). Upload it with `PUT /api/web-products/:slug/releases/:version?kind=preview`; it is stored under the reserved slug `<slug>--preview`. `GET /api/web-products/:slug` reports `previewAvailable`.

Bookable services (`kind: 'service'`, booking endpoints, founding coupons, free hour) are documented in ~/Projects/Bilko/docs/commerce.md.
