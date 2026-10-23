# Bilko host contract

bilko.run is a **host platform**, not a single product. It hosts many independent "apps" — each with its own product, its own scoring engine, its own UX. Some apps live in this repo; some live in their own repos and are dropped in as static assets; some live on other domains.

This document defines the contract: what the host provides, what an app must implement, and how to add a new app. Host-internal implementation detail (monitoring, QA gates, cost controls, caching, observability, security headers) lives in [`docs/host-internals.md`](host-internals.md) — read that only if you're changing the host itself, not when you're publishing an app.

## The three host kinds

Every app declares one host kind in `src/data/projectsRegistry.ts` (react-route) or `src/data/standalone-projects.json` (static-path / external-url):

| Kind | When to use | Path | Coupling |
|---|---|---|---|
| `react-route` | App must live in this bundle (today only Session Manager) | `/products/<slug>` | Tight — same Vite build, same Fastify server |
| `static-path` | App is built in its own repo (often its own Claude session) and just needs a URL on bilko.run | `/projects/<slug>/` | Loose — host serves prebuilt static assets, no shared runtime |
| `external-url` | App lives on another domain or subdomain | `https://<host>/...` | None — host only links to it |

Default to `static-path` for new apps — including ones that need a signed-in user (see "Calling authenticated host APIs from a `static-path` app" below). `react-route` is rare: today only Session Manager (`/products/session-manager`) uses it. The AI tools are `static-path` siblings whose Gemini endpoints stay in the host as gateway routes under `server/routes/tools/`.

## What the host provides

These are the OS services. Apps use them; they should not reimplement.

### To every app, regardless of host kind

- **Brand chrome.** Header, footer, blog, /pricing, /privacy, /terms, /admin, ⌘K command palette.
- **Portfolio listing.** Anything in the registry shows up on `/`, `/projects`, and ⌘K automatically. No manual wiring.
- **Domain.** `bilko.run/<your-path>`.

### To `react-route` apps additionally

- **Auth: Clerk.** Available via `useUser()` and `useAuth()` from `@clerk/clerk-react`. Server-side: `requireAuth(req, reply)` from `server/clerk.ts` returns the Clerk email or 401s.
- **Credits: token wallet.** Spend via `deductToken(email)` and check via `getTokenBalance(email)` from `server/services/tokens.ts`. Free users get a starter grant via `grantFreeTokens(email)`.
- **Payments: Stripe.** Subscription state via `getActiveSubscriptionLive(email)`; one-time purchases via `hasPurchased(email, productKey)`. Both from `server/services/stripe.ts`.
- **Rate limiting.** `checkRateLimit(ipHash, endpoint, email?, productKey?)` from `server/routes/tools/_shared.ts` — handles free-tier daily caps, paid-tier caps, pro-skip.
- **Page-view and click analytics.** Automatic: the host injects a beacon into every HTML page (pageviews on load and SPA navigation, clicks, session ids via the `bilko_vid`/`bilko_sid` cookies). No hook to call. See [`docs/observability.md`](observability.md).
- **Shared UI for siblings** lives in `host-kit` (`packages/host-kit/`), not in this bundle; the old in-repo `tool-page` kit and `useToolApi` hook are gone.
- **Which host-kit to install.** Use the unscoped npm package `host-kit`, **`>=0.8.0`**: `"host-kit": "^0.8.0"`, or `"host-kit": "file:../Bilko/packages/host-kit"` for a local sibling. 0.8.0 is the first npm release that has the auth API (`initAuth`, `useAuth`, `openSignIn`, `signOut`, `getAuthToken`, `authFetch`) and Bearer-authenticated games hooks. `host-kit@0.7.2` and the legacy scoped `@bilkobibitkov/host-kit` (last release 0.7.2, no longer published) do not have it. In 0.7.2 the games hooks send cookies only, so every call gets a 401.
- **Gemini.** `askGemini(prompt, opts)` from `server/gemini.ts`. Use `parseJsonResponse` (re-exported as `parseResult` in `_shared.ts`) for JSON outputs.
- **Database.** Turso/libSQL via `dbGet/dbAll/dbRun/dbTransaction` from `server/db.ts`. Falls back to local SQLite in dev. All SQL parameterized.

### To `static-path` and `external-url` apps additionally

- **No shared runtime.** Bring your own runtime and your own UI. The host serves the bytes. It does not inject the Clerk SDK, the component kit, or any providers into your page.
- **Same-origin framing only.** Responses under `/projects/` carry CSP `frame-ancestors 'self'`, so one static-path app may embed another in an iframe (e.g. Game Academy hosting an engine game slug) and talk to it over `postMessage`. Cross-origin framing is refused; every other host page is `frame-ancestors 'none'`.

### Calling authenticated host APIs from a `static-path` app

A `static-path` app is same-origin with `/api`, so it *can* call authenticated host endpoints (`/api/games/*`, the AI-tool gateways, `/api/academy/*`). There is **one supported way to authenticate: send a Clerk session JWT in `Authorization: Bearer <token>`.** `requireAuth` / `requireAdmin` in `server/clerk.ts` read only that header.

- **Cookies are not accepted.** Clerk's first-party `__session` cookie on bilko.run is **not** read by the host, and `credentials: 'include'` by itself always gets a 401. This is deliberate. That cookie is a 60-second token that only clerk-js refreshes. A static page that doesn't run clerk-js would get intermittent 401s about a minute after page load. Accepting it would also make every mutating `/api` route cookie-authenticated, which means CSRF exposure.
- **How to get the token:** load clerk-js from the host's Clerk Frontend API (`https://clerk.bilko.run/npm/@clerk/clerk-js@5/dist/clerk.browser.js`, with the bilko.run publishable key as `data-clerk-publishable-key`). Call `await Clerk.load()`, then `await Clerk.session?.getToken()` before **each** request. Don't cache the token, because clerk-js already caches and refreshes it. The host CSP already allows `clerk.bilko.run` in `script-src`. Copy the CSP nonce from `<meta name="csp-nonce">` onto the script tag. **Use host-kit instead of rolling your own:** `authFetch(url, init)` (`getAuthToken()`, `useAuth()`, `openSignIn()`) from `host-kit` (`>=0.8.0`) does all of this. The `useSaveState` / `useUnlocks` / `useLeaderboard` hooks already use it.
- **Gate the load cheaply:** a `__client_uat` cookie value > 0 means the user has signed in on bilko.run. If it is absent or `0`, treat the user as signed out without downloading clerk-js.
- **Identity on the server** is always the email from the verified token. Never trust a user id or email in the request body.

## What an app must implement

### Every app

A registry entry — a `static-path`/`external-url` entry in `src/data/standalone-projects.json` (validated by `mcp-host-server/src/contract/registry.ts`; see "Registry rules" below), or a `react-route` entry in `src/data/projectsRegistry.ts`. Sibling repos add theirs via the [`bilko-host` MCP](../mcp-host-server/README.md) — never by hand-editing this repo.

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
- A registry mapping in `src/data/projectsRegistry.ts` (see the react-route path map there) and a route in `src/App.tsx`.
- Backend routes in `server/routes/tools/<my-app>.ts` exporting `registerMyAppRoutes(app)`, registered in `server/routes/tools/index.ts`.
- For paid features, deduct credits via `deductToken(email)` after a successful response; for free-tier, gate via `checkRateLimit()` and increment via `incrementUsage()`.

### `static-path` apps additionally

- A standalone build that emits to `dist/` in your own repo.
- Publish by calling the MCP's `publish_static_project` with `distPath` pointing at that `dist/` — it copies the bytes into `public/projects/<slug>/` of this repo directly. There is no separate manual sync step.
- The build's `index.html` must use relative or `/projects/<slug>/`-prefixed asset paths (Vite: set `base: '/projects/<slug>/'`).
- No assumption about parent-page layout — your bundle owns the entire page.
- **A `manifest.json` at the bundle root** (`dist/manifest.json`) — see "Manifest contract" below. `publish_static_project`'s `manifest` gate refuses bundles without one, and that gate cannot be bypassed.

### `external-url` apps

- Just the URL (`https://` only). Register it with the MCP's `register_external_project` (see below). There is no bundle, so `publish_static_project` refuses external-url slugs.

## Registry rules

The registry (`src/data/standalone-projects.json`) is validated by `mcp-host-server/src/contract/registry.ts` on every MCP write:

- **Slug format:** 2–40 chars of `[a-z0-9-]`, no leading or trailing hyphen.
- **Status:** one of `live`, `cooking`, `postponed`, `archived`.
- **Slugs are unique** across the registry.
- A `static-path` entry's `host.path` must equal `/projects/<slug>/` exactly.
- An `external-url` entry's `host.url` must start with `https://`.

## Project listing — who owns what

A project's `/projects` card is split between the sibling that owns the app and Bilko, the host.

| Owner | Fields |
|---|---|
| **Project** (its own repo) | `name`, `displayName`, `tagline`, `category`, `tags`, `status`, `thumbnail`, `listing` (`detail`, `metric`, `metricLabel`, `lang`, `audience`, `talkingPoints`, `offering`, `pricing`, `callToAction`, `avoidClaims`, `icon`, `shareImage`), and `url` on `external-url` entries |
| **Bilko** (host) | `slug`, `host` (kind, path), `year`, `launchedAt`, `public` |

Sibling sessions never ask Bilko to change card copy. They edit it themselves. Bilko-owned fields are rejected in any listing patch.

**Ownership rule.** `host.localPath` binds a slug to exactly one repo. `register_static_project` / `register_external_project` record the caller's `callerRepoPath` there, and refuses a repo that is already bound to another slug. `publish_static_project` (via `sourceRepoPath`), `unregister_project` and `update_project_listing` (via `callerRepoPath`) refuse any other caller.

**Content standards** (enforced by `mcp-host-server/src/contract/registry.ts` on every write):

| Field | Limit |
|---|---|
| `name` | 1–40 chars |
| `displayName` | 1–60 chars |
| `tagline` | 1–160 chars |
| `category` | 1–40 chars |
| `tags` | up to 6, each 1–24 chars |
| `thumbnail` | `https://` URL or a `/path` |
| `listing.detail` | 1–400 chars |
| `listing.metric`, `listing.metricLabel` | 1–24 chars each |
| `listing.lang` | 1–40 chars |
| `listing.audience` | up to 200 chars |
| `listing.talkingPoints` | up to 5, each 1–200 chars |
| `listing.offering` | one of `saas`, `free-tool`, `showcase`, `open-source`, `game`, `content`, `experiment` |
| `listing.pricing` | one of `free`, `freemium`, `paid`, `none` |
| `listing.callToAction` | 1–120 chars |
| `listing.avoidClaims` | up to 5, each 1–200 chars |
| `listing.icon` | path starting with `/projects/<own-slug>/`, ending in `.png`; the `share-assets` gate also needs a square PNG, 128–1024 px, ≤512 KB |
| `listing.shareImage` | path starting with `/projects/<own-slug>/`, ending in `.png`; the `share-assets` gate also needs exactly 1200x630, ≤5 MB |

Banned-term rule: no text field (`name`, `displayName`, `tagline`, `category`, `tags`, and every `listing` text field) may mention the retired ContentGrade product (`/content-?grade/i`). The write fails with the slug and field name.

**Two edit paths.** Both take the same patch and run the same ownership and schema checks.

1. `update_project_listing { slug, callerRepoPath, patch }` — edits the card now. Commits and pushes. Use `get_project { slug }` first to see the current entry. Set `displayName`, `tags`, `thumbnail` or `listing` to `null` in the patch to remove it.
2. `bilko.listing.json` at the sibling repo root (max 16 KB) — `publish_static_project` reads it from `sourceRepoPath` and syncs it into the registry in the same commit as the bytes. The result line reports `listing: synced from bilko.listing.json`, `listing: unchanged` or `listing: no bilko.listing.json`. Invalid JSON or a rejected field fails the publish.

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

`offering` says what kind of thing the project is:

- `saas` — others can sign up and use it with their own data.
- `free-tool` — a free utility anyone can use, no account tied to their data.
- `showcase` — a personal portfolio or presentation layer, not a product others sign up for.
- `open-source` — the code is the offering; people install or fork it.
- `game` — something to play.
- `content` — articles, courses or other material to read or watch.
- `experiment` — early or exploratory; no promise it stays.

`pricing` is `free`, `freemium`, `paid` or `none` (nothing to buy, e.g. a showcase).

`callToAction` is the one action a promoter should ask people to take.

`avoidClaims` are claims promoters must never make about the project. Use them to rule out wrong guesses, for example "Git Viewer is a SaaS".

### Trust model

The ownership check compares a self-asserted `callerRepoPath` / `sourceRepoPath` with `host.localPath`. It guards against one project's session editing another project's slug by mistake. It does not authenticate the caller: a hostile local session can pass any path it likes. A leading `~` in `callerRepoPath` is expanded to the home directory before the absolute-path check.

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

The same `https://bilko.run/og/<slug>.png` is two things: the X/LinkedIn link preview, and the hero image of your project's card on https://bilko.run/projects. There it is shown uncropped at 1200x630 on a dark background. So your `listing.shareImage` is your hero, not an afterthought social card. A project without one shows the plain generated text card in both places.

Design it as a hero:

- Show the product itself: real UI or the key visual.
- Keep the name and the one-line promise legible at small sizes. No tiny text.
- Keep important content inside the central ~1000x500 safe area.
- The file rule is unchanged: 1200x630 PNG, ≤5 MB.

`https://bilko.run/og/<slug>.png` resolves in this order:

1. A valid `listing.shareImage` (1200x630 PNG, ≤5 MB) is served as-is.
2. Otherwise a generated card that draws `listing.icon` (square PNG, 128–1024 px, ≤512 KB).
3. Otherwise the plain generated card.

If a declared file is missing, oversize or the wrong size at serve time, the host logs it and falls back to the next step.

Recipe for a sibling:

1. Add the PNG to the build output. For example, put `public/og.png` in the repo; it lands at `/projects/<slug>/og.png`.
2. Set the path in `bilko.listing.json` (`{ "listing": { "shareImage": "/projects/<slug>/og.png" } }`), or call `update_project_listing` with the same patch. Use `icon` the same way for a square icon.
3. Run `publish_static_project`.
4. Open `https://bilko.run/og/<slug>.png` and check the card.

The `share-assets` publish gate blocks the publish when a declared `icon` or `shareImage` is missing from the bundle, is not a PNG, or has the wrong size. The path must start with `/projects/<your-slug>/`.

Share assets do not count against your gzip budget. The `budget` gate leaves a declared `icon`/`shareImage` out of its sum when it passes these checks, so a full-quality hero up to 5 MB fits even a near-budget app. The same PNG left undeclared, or declared but invalid, counts like any other file.

Implemented in `server/og-meta.ts` (resolves meta from the registry and rewrites the head), `server/og-image.ts` (renders the PNG card), and `server/og-routes.ts` (the `/og/<slug>.png` route and HTML injection wiring).

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
      "status": "live",                        // live | cooking | postponed | archived
      "url": "https://bilko.run/projects/git-viewer/", // absolute; the card's own link
      "tags": ["Browser", "Freemium"],
      "detail": "…",                           // drawer story; falls back to tagline
      "audience": "…",                         // who it is for; may be ""
      "talking_points": ["…"],                 // plain facts a promoter may state; may be []
      "offering": "showcase",                  // saas | free-tool | showcase | open-source | game | content | experiment; "" when unset
      "pricing": "none",                       // free | freemium | paid | none; "" when unset
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

Implemented in `server/routes/project-catalog.ts`; tests in `tests/project-catalog.test.ts`.

## Agent-facing surfaces

bilko.run treats AI agents as a customer segment: they can discover what is for sale, read the project catalog, and buy, without a browser session. All of it is derived from data, not hand-written per surface.

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/llms.txt` | none | Plain-text storefront for LLMs: offers with prices and `/buy` links, public projects, and the agent endpoints below. `server/routes/agent-storefront.ts` |
| GET | `/api/offers` | none | JSON `{ offers: [...] }`: `id`, `name`, `summary`, `whatYouGet`, `price`, `amount`, `currency`, `billing`, `pageUrl`, `buyUrl`, `howToBuy`. `Cache-Control: public, max-age=300`. |
| GET | `/api/projects` | none | The public project catalog (see "Public project catalog"), each project with its `offers` (`id`, `price`, `buyUrl`). |
| POST | `/mcp` | none for catalog tools; `Authorization: Bearer bkk_...` for `wallet_balance`, `order_menu_item` and `roast_page` | Stateless streamable-HTTP MCP server. See "MCP tools" below. |
| GET | `/api/wallet` | Clerk session or `bkk_` key | `{ balanceCents, balance }`: the caller's Bilko Credits balance. `private, no-store`. |
| POST | `/api/wallet/topup` | Clerk session only | Body `{ cents }` with `cents` one of 300, 500, 1000. Creates a Stripe Checkout session and returns its URL. 400 for any other amount, 429 rate limited, 503 when Checkout is unavailable. Agents without a session buy credits through `/buy/credits-N`. |
| GET | `/buy/credits-3`, `/buy/credits-5`, `/buy/credits-10` | none | Same as `/buy/:offerId` for the $3, $5 and $10 wallet top-ups (offers `credits-3|5|10`, `source.kind: 'wallet_topup'`). Each also yields a `bkk_` key on the success page. |
| GET | `/api/menu` | none | The Bilko services menu: `topups` and every orderable item (`id`, `name`, `price`, `priceCents`, `kind`, intake fields). `public, max-age=300`. |
| POST | `/api/menu/:itemId/order` | Clerk session or `bkk_` key | Body `{ intake }` (strings, validated against the item's intake fields). Spends the item's price from the wallet. 201 `{ order: { id, itemId, status, priceCents }, balanceCents }`. Errors: 400 `invalid_intake` / `live_needs_slot`, 402 `insufficient_credits` (with `balanceCents`, `topUpUrl`), 404 `unknown_item`, 409 `daily_cap`, 409 `{ error: 'unavailable' }` (item not on sale yet), 429. Rate limited per IP. |
| POST | `/api/menu/live-call/order` | Clerk session or `bkk_` key | Body `{ startMs, intake }`. Books the $9 live call on the slot machinery (see "Selling a bookable service") and spends 900 cents. 201 `{ booking, balanceCents, emailed }`. Errors: 402 `insufficient_credits`, 409 `slot_unavailable`, 400 otherwise. |
| GET | `/api/menu/orders` | Clerk session or `bkk_` key | The caller's own orders (`id`, `itemId`, `status`, `priceCents`, `createdAt`). |
| GET | `/buy/:offerId` | none | Creates a Stripe Checkout session for the offer and 302-redirects to it. Unknown id: 404 listing valid ids. Search/AI crawlers and HEAD get a static page with the price and the link instead of a session. Rate limited (10/min/IP); 503 when Checkout is unavailable. |
| POST | `/api/agent-keys` | Clerk session | Mints a `bkk_` key, returned once (`key`, `prefix`, `id`). 409 at 10 active keys. |
| GET | `/api/agent-keys` | Clerk session | Lists the caller's keys (prefix, label, timestamps; never the secret). |
| DELETE | `/api/agent-keys/:id` | Clerk session | Revokes one of the caller's keys. |

### Bilko Credits wallet and services menu

Bilko Credits are a prepaid wallet (1 credit = 1 cent of balance, shown as dollars). Decision D-2026-10-20-14 replaced the old Human For Hire price ladder ($75, $225 and $750) with a credit-priced menu plus one $9 live call.

- **Top-ups:** $3, $5 or $10 (`WALLET_TOPUP_CENTS` in `shared/bilko-menu.ts`). Humans use `POST /api/wallet/topup`; agents open `/buy/credits-3|5|10`. The Stripe webhook credits the wallet only when the session is paid and the subtotal equals an allowed amount. Code: `server/routes/wallet.ts`, `server/services/wallet.ts`.
- **PPP bonus:** a country-based bonus paid as extra credits on a top-up, never a lower charge. The country comes from the payment card (falling back to the billing address). High-income countries get 0%, upper-middle-income 50%, lower-middle and low income 100%, per the World Bank classification; unlisted or unknown countries get 0%. The bonus is a second, separate wallet credit (`ppp_bonus:<CC>`) keyed to the Checkout session, so a replayed webhook cannot pay it twice. Edit the table in `shared/ppp-bonus.ts`.
- **Menu:** items and prices live in `shared/bilko-menu.ts` (`MENU_ITEMS`), all at or below the $10 ceiling: `ask-bilko` ($0.50), `claude-md-review` and `prd-review` ($1), `agent-postmortem` ($2), `repo-audit` and `agent-factory-kit` ($3) and `live-call` ($9). Kinds: `async` (written delivery by email), `download` and `live`. Async items share a daily cap (`MENU_DAILY_ASYNC_CAP`). Code: `server/routes/menu-orders.ts`, `server/services/menu-orders.ts`.
- **Live call:** a 30-minute call booked into the `human-for-hire` slots in `shared/service-slots.ts` (Tue/Wed/Thu 18:30 Pacific, so 3 a week). Read open slots from `GET /api/services/human-for-hire/slots`, then `POST /api/menu/live-call/order`. It needs a slot, so it is not an ordinary menu order: the generic order path returns `live_needs_slot`, and the MCP `order_menu_item` tool refuses it.
- **Approval queue:** async orders are queued, then drafted by `server/services/menu-drafts.ts`, and nothing is emailed until an admin approves. Admin routes (`requireAdmin`, `server/routes/admin-menu-orders.ts`): `GET /api/admin/menu-orders[?status=]` (also reports `asyncToday` and `asyncCap`), `POST /api/admin/menu-orders/:id/draft`, `POST /api/admin/menu-orders/:id/approve` (body `{ body }`; emails the buyer, then marks delivered) and `POST /api/admin/menu-orders/:id/refund` (returns the credits).

### MCP tools

`POST /mcp` serves these tools. The list is asserted against `/llms.txt` in `tests/agent-storefront.test.ts`.

| Tool | Key | Does |
|---|---|---|
| `list_projects` | none | Public project catalog (same data as `GET /api/projects`). |
| `get_project(slug)` | none | One public project; not-found error otherwise. |
| `list_offers` | none | Everything for sale with `buyUrl` (same data as `GET /api/offers`). |
| `list_menu` | none | The services menu (same data as `GET /api/menu`). |
| `wallet_balance` | `bkk_` | The key owner's balance. |
| `order_menu_item(itemId, intake)` | `bkk_` | Orders one menu item from the key owner's wallet. 20 orders a minute per account. Errors name the cause (`insufficient_credits`, `daily_cap`, `unavailable`, `invalid_intake`, `unknown_item`, `live_needs_slot`). The live call cannot be booked over MCP. |
| `roast_page(url)` | `bkk_` | Paid page roast, 1 credit. |

A tool that needs a key returns an `isError` result with the top-up link when the key is missing or invalid.

### Offers

Every paid offer lives in one file, `shared/agent-offers.ts` (`AGENT_OFFERS`): `id`, name, summary, `whatYouGet`, `amountCents`, `billing` (`one_time` | `month`), `pageUrl`, `buyUrl`, a `source` pointing at the existing catalog (`web_product` slug in `shared/web-products.ts`, or `price_catalog` type in `shared/product-catalog.ts`), and `agentKey` (true when the purchase yields a `bkk_` key). `amountCents` is not in `PRICE_CATALOG`, so it must match the price shown on the app's page and Stripe. Current offers: `launch-kit` ($9), `git-viewer` ($5/month), `pageroast-credits-7` ($5), `pageroast-credit-1` ($1).

**To add an offer:** add an entry to `AGENT_OFFERS` (and the underlying web product or price-catalog entry if it is new). That one edit flows to `/llms.txt`, `GET /api/offers`, the `list_offers` MCP tool, the `offers` on each project in `/api/projects` and `list_projects`/`get_project`, the JSON-LD on the offer's page, and `/buy/<id>`.

**JSON-LD:** when a page's path equals an offer's `pageUrl` path, the server injects a `<script type="application/ld+json">` block with one schema.org `Product` + `Offer` per offer (price, currency, `url` = `buyUrl`; monthly offers add a `UnitPriceSpecification` with `billingDuration: P1M`). Pages that already declare a `Product` are left alone. Implemented in `server/offer-jsonld.ts`, wired in `server/og-routes.ts`.

### Agent keys (`bkk_`)

- A `bkk_` key identifies a bilko.run account (by email) to the agent surfaces. It is minted either by the account owner via `POST /api/agent-keys` (Clerk session) or revealed once on the checkout success page after buying an offer with `agentKey: true`. Only a hash is stored; the secret is shown once.
- Keys are accepted on `/mcp` and on the wallet and menu routes (`GET /api/wallet`, `POST /api/menu/:itemId/order`, `POST /api/menu/live-call/order`, `GET /api/menu/orders`). They can read the owner's balance, order menu items from it and call `roast_page` (1 credit, through the same `creditGate` path as the web app). A key never grants admin, never passes `requireAuth`, and cannot mint or revoke keys, so a leaked key can spend only that account's credits.
- Max 10 active keys per account. Implemented in `server/services/agent-api-keys.ts`, `server/routes/agent-keys.ts`.

### Visitor classes

`classifyVisitor` (`server/services/analytics.ts`) tags every page hit with one of six classes, checked in this order:

| Class | Who |
|---|---|
| `api_client` | MCP calls and requests carrying a known bot id |
| `ai_user_agent` | An AI assistant fetching on behalf of a user (ChatGPT-User, Claude-User, Perplexity-User, ...) |
| `ai_crawler` | AI training/indexing crawlers (GPTBot, ClaudeBot, CCBot, ...) |
| `search_crawler` | Search engines and link unfurlers (Googlebot, Bingbot, Slackbot, ...) |
| `script` | Empty user agent, curl/wget/HTTP libraries, headless browsers, generic bot/spider/crawler |
| `human` | Everything else (undeclared bots with browser UAs land here) |

They show up in the admin traffic panel (`/admin`, backed by `GET /api/admin/traffic`) and in the `bilko-host` MCP `traffic_report` tool (`byClass`, `topPagesByClass`). Hits to `/mcp`, `/llms.txt`, `/api/offers` and `/buy/*` are recorded as page hits so agent interest is measurable.

### UTM revenue funnel

`GET /api/admin/funnel?utm_source=<src>&since=YYYY-MM-DD` (`requireAdmin`, so read-only `bka_` keys work; `since` defaults to 7 days ago) returns `{since, utm_source, visits, sign_ins, checkout_start, paid, booked}` as integers. Attribution is first-touch: a visitor counts when one of their sessions since `since` landed with that `utm_source` (case-insensitive). `visits` counts sessions; `sign_ins`, `checkout_start` and `paid` count visitors; `booked` counts service bookings. Web-product `checkout_start` rows carry the `bilko_vid`/`bilko_sid` cookies and the Stripe checkout session id, which is how orders and bookings join back to the visit (or by the visitor's signed-in email). Admin and bot traffic are excluded unless `exclude_self=0` / `include_bots=1`. Burrow consumes it; the `bilko-host` MCP exposes it as `funnel_report`.

### robots.txt

`public/robots.txt` keeps `/api/` private but explicitly allows `/mcp`, `/llms.txt`, `/api/offers` and `/api/projects` (longest match wins). It disallows `/buy/` because each GET creates a Checkout session; agents acting for a user follow buy links directly.

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

1. Decide the host kind. Default `static-path`; a signed-in app still uses `static-path` (see above). `react-route` only if it truly cannot live outside this bundle.
2. Build it.
   - `react-route`: page + route entry + per-tool server file.
   - `static-path`: standalone repo, `vite build`.
3. Register and publish via the [`bilko-host` MCP](../mcp-host-server/README.md) — see below. `react-route` apps still register by hand in `src/data/projectsRegistry.ts`.
4. Run `pnpm test && pnpm exec tsc --noEmit && pnpm exec vite build` — all must pass.
5. Commit and push to `origin`. Render auto-deploys. (Never push to `content-grade` — it's a separate, unrelated project with diverged history.)
6. Verify the project shows up on `/`, `/projects`, and in ⌘K.

## Adding from a sibling-repo Claude session (MCP)

A sibling repo (e.g. `~/Projects/Outdoor-Hours`) should NOT edit this repo by hand. Wire up the [`bilko-host` MCP server](../mcp-host-server/README.md) in your sibling's `.mcp.json`, then per session:

```
1. bilko-host__get_host_contract                          # read this file
2. bilko-host__list_projects                              # check slug isn't taken
3. (build your app: pnpm build → dist/)
4. bilko-host__register_static_project { slug, name, tagline, category, status, year, callerRepoPath, … }  # first deploy only
   # app hosted on its own domain instead? bilko-host__register_external_project { slug, url, name, tagline, category, status, year, callerRepoPath, … } and skip steps 3 and 5
5. bilko-host__publish_static_project { slug, distPath, sourceRepoPath }  # every deploy; syncs bilko.listing.json if present
6. bilko-host__status                                     # verify
```

`register_static_project` (and `register_external_project`, which adds a required `https://` `url`) binds the slug to `callerRepoPath` (your repo root) and also takes optional `tags` and `displayName` (a hub-only display name, 1-60 chars). It has no `public` parameter: new apps are admin-only until the Bilko owner lists them. Later card edits go through `update_project_listing` or `bilko.listing.json`; see "Project listing — who owns what".

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

Full adoption process: [`docs/observability.md`](observability.md). Summary:

**Free, no code.** The host injects a beacon into every HTML document (SPA and every static-path app): pageviews on load and SPA navigation, clicks on `a`/`button`/`[role=button]`/`summary`/`[data-track]`, all stitched into one session by the first-party `bilko_vid` (1 year) and `bilko_sid` (30-minute sliding idle) cookies. Tag important buttons with `data-track="<area>-<action>"`.

**SDK.** Every sibling app SHOULD call `initTelemetry({ app, version })` from `host-kit` at boot:

- `track(name, props)` → `POST /api/telemetry/event` → `funnel_events` (not `analytics_events`)
- `trackFlow(flow, step, props)` → `track('<flow>.<step>', { flow, step, ... })`, kebab-case names
- `log.info|warn|error(msg, fields)` → `app_logs` (info sampled at 10% by default)
- `logError(err, context)` and uncaught `window.error` + `unhandledrejection` → `app_errors` (100% sampled, de-duped at 3/min per fingerprint)

The SDK is non-blocking and batched (5s buffer, flush on page-hide) and uses `sendBeacon`. The default endpoint is relative (`/api/telemetry`) on bilko.run. `track()` called without `initTelemetry` auto-inits (app from `/projects/<slug>/`) and posts to `/api/telemetry/event`; it no longer posts to `/api/analytics/event`. Only logs and error capture need `initTelemetry`. Prop/field keys matching `/(email|password|token|key|ssn|card|cvv|apikey)/i` are redacted client-side; never put emails, tokens or free text in props.

```ts
import { initTelemetry, trackFlow } from 'host-kit';
initTelemetry({ app: 'my-app', version: '1.0.0' });
trackFlow('checkout', 'click-buy', { product: 'pro' });
```

Server endpoints (all rate-limited per IP, append-only tables; the cookie session ids are stamped onto every record):

| Endpoint | Table | Rate limit |
|---|---|---|
| `POST /api/telemetry/event` | `funnel_events` | 1200/min |
| `POST /api/telemetry/log` | `app_logs` | 600/min |
| `POST /api/telemetry/error` | `app_errors` | 300/min |

See also [`docs/telemetry-beacons.md`](telemetry-beacons.md) for the full endpoint table. Verify in `/admin/observability` (Sessions and Flows).

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
| `hostKit.version` | `string` | Version of `host-kit` (or legacy `@bilkobibitkov/host-kit`) in use. `"0.0.0"` if not used |
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
  limit it's checked against — covers *every* file under `dist/`, summed
  (except a valid declared `listing.icon`/`listing.shareImage`, see below).
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

Every static-path publish runs six gates in order, against `distPath` (and `sourceRepoPath`, where required). All must pass, or be explicitly bypassed, before the bundle is swapped into `public/projects/<slug>/`.

| Gate | What it checks | Bypassable |
|---|---|---|
| `manifest` | `manifest.json` exists at the bundle root, parses, validates against the Zod schema, and its `slug` matches the registered slug | **No — never bypassable** |
| `budget` | Real gzipped size of every file under `distPath`, measured fresh by the gate (`mcp-host-server/src/contract/app-budgets.ts`), not the manifest's self-reported number — must be ≤ the app's budget (default 200 KB gz). A declared `listing.icon`/`listing.shareImage` that passes the `share-assets` checks is left out of the sum; it has its own cap there. An invalid one still counts | `budget` |
| `golden` | `tests/golden.spec.ts` exists in `sourceRepoPath` and passes under `pnpm exec playwright test` | `golden` |
| `a11y` | axe-core scan of `manifest.golden.path`, served from a local static server over the staged bundle, finds zero `serious`/`critical` violations | `a11y` |
| `audit` | `pnpm audit --prod --audit-level=high --json` run in `sourceRepoPath` (`npm audit --omit=dev --audit-level=high --json` instead when the repo has a `package-lock.json` and no `pnpm-lock.yaml`); the gate reads vulnerability counts from the JSON output regardless of the process's exit code, and fails if `high + critical > 0` | `audit` |
| `share-assets` | Each declared `listing.icon`/`listing.shareImage` is in the bundle, is a PNG, and has the right size and byte cap (see "Custom share image") | **No** |

The `manifest` gate short-circuits the pipeline — if it fails, the other five are skipped (their results would be meaningless without a valid manifest).

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

For games hosted on bilko.run (current: Boat Shooter; upcoming: Sudoku), the host provides three platform services accessed via the `host-kit` React hooks `useLeaderboard`, `useSaveState`, and `useUnlocks`.

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

Access all three from `host-kit`'s `useLeaderboard(slug, opts)`, `useSaveState<T>(slug)`, and `useUnlocks(slug)` hooks.

### Anti-cheat

Score submission is rate-limited to 60/hour per (user × game) and scores above `maxPlausibleScore` are rejected with 400. Optional HMAC: set `BILKO_GAME_HMAC_KEY`; the client signs `${slug}:${score}:${mode}:${ts}` and the server validates the `sig` field on POST.

## Realtime relay

A game-agnostic binary WebSocket relay for online team games, built for Game Academy's deterministic lockstep/rollback arenas (up to 5v5). The host never runs or parses a game. It authenticates the socket, assigns seats, and fans out small input frames. Code: `server/realtime/relay.ts` (socket) and `server/routes/realtime.ts` (ticket). Tests: `tests/realtime-relay.test.ts`.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST /api/realtime/ticket` | Required (Clerk Bearer) | Body `{ roomId }`, where `roomId` matches `[A-Za-z0-9_-]{1,64}`. Returns `{ ticket, expiresAt, path, limits }`. The ticket is single-use, lasts 30 s, and is bound to the caller's email and that room. Returns 400 for a bad `roomId`, 409 `room_full`, 503 `server_full` (500 rooms per instance), and 429 above 30 tickets/min per user. |
| `GET wss://bilko.run/api/realtime/rooms/:roomId?ticket=<t>` | Ticket | WebSocket upgrade. A ticket is needed because browsers can't set `Authorization` on a WebSocket. The handshake is refused with 401 (missing, unknown, expired, reused or wrong-room ticket), 403 (an `Origin` other than `https://bilko.run` / `https://www.bilko.run`) or 404 (malformed room id). |

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

### Deployment constraints

- **Rooms live in one process's memory.** That is correct only while the service runs **one instance**. Scaling Render horizontally would split a room across instances. That would need room → instance routing (or a shared pub/sub) first.
- A deploy drops every room (`1012`). Clients should reconnect with a fresh ticket and resync from their own state. The server keeps no input log.
- **Render tier, as of 2026-10-18:** the owner believes bilko.run is on Render's **Free** tier, with a fixed instance count of one. This hasn't been checked in the dashboard, and the region is unknown. One instance is what the in-memory rooms need. Free has a cost, though: the service spins down after 15 minutes without inbound traffic. The first ticket after an idle spell then waits for a cold start (tens of seconds), and a spin-down drops every live room. Before online play goes beyond casual testing, move the service to a paid tier that doesn't sleep (Starter or above) and record the plan and region here.

## Sign-in capture ("sign in for updates")

Owner decision 2026-10-20. A capture page may show an inline, dismissable (never modal) prompt offering bilko.run sign-in for updates. Nothing on the page may require it. Capture pages and their `source` values live in `shared/signin-capture.ts`: `session-manager` (`/products/session-manager`), `manual` (`/products/session-manager/manual`), `human-for-hire` (`/projects/human-for-hire/`). Adding a page means adding it there.

| Endpoint | Auth | What it does |
|---|---|---|
| `POST /api/signin-capture` `{ source, consent }` | Clerk Bearer (`requireAuth`) | Records the account's first `source` (never overwritten). `consent: true` (the literal) sets the "send me occasional updates" flag with a timestamp. Anything else leaves it unchanged, so consent defaults off and is never revoked here. The first capture writes a `signin_completed` funnel event. |
| `GET /api/admin/signups?days=N` | `requireAdmin` | Signups and consent by source, latest 500 rows, and the prompt funnel for the window. |
| `GET /api/admin/signups.csv` | `requireAdmin` | Every row as a CSV attachment. |

Funnel events: the page sends `prompt_shown` and `prompt_dismissed` through `POST /api/analytics/event` with `tool: <source>`. The server writes `signin_completed`.

**From a `static-path` page** (Human For Hire): signed out, show the prompt with the consent checkbox unticked. Remember a dismissal in `localStorage`. On "Sign in", store `{ source, consent }`, then call host-kit `openSignIn()`. Once signed in, `authFetch('/api/signin-capture', { method: 'POST', body })` with the stored values. The in-repo reference is `src/pages/session-manager-landing/SignInPrompt.tsx`. Copy stays in the Bilko persona. Collect only: nothing sends email yet.

## Selling a downloadable web product

A web product is a paid zip sold from a static-path landing page at `/projects/<slug>/`. Declared once in `shared/web-products.ts` (`WEB_PRODUCTS`); routes, the Stripe webhook and `/admin` → Products read from it. Slugs not in `WEB_PRODUCTS` (or failing the slug regex) return 404 on every route below.

### Endpoints

All responses are JSON unless noted. Rate limits are per IP per minute.

| Endpoint | Auth | Success | Errors |
|---|---|---|---|
| `GET /api/web-products/:slug` | none | 200 `{ slug, name, displayPrice, version, available }` (`available` = release bytes stored + price id + Stripe configured; `Cache-Control: no-store`) | 404 unknown slug |
| `POST /api/web-products/:slug/checkout` | none | 200 `{ url }` — Stripe Checkout (`mode: payment`, `metadata.web_product=<slug>`, success → `/projects/<slug>/thanks/?session_id=…`, cancel → `/projects/<slug>/?checkout=cancel`); logs a `checkout_start` funnel event (`is_admin=1` when the IP has admin page hits). Recovery is on (`after_expiration.recovery`); `consent_collection.promotions='auto'` only when `STRIPE_CHECKOUT_PROMO_CONSENT=1`. A signed-in owner (Clerk header or `__session` cookie) gets a **test-mode** session (`STRIPE_TEST_SECRET_KEY`, inline price from `displayPrice`, `metadata.test=true`) and no funnel row. `?dryRun=1` → 200 `{ ok, dryRun, url: null }`, no session — use it for deploy smokes | 404 unknown slug · 429 (10/min) · 409 owner but test mode unconfigured (never falls back to live) · 503 Stripe or price unconfigured · 502 Stripe error |
| `GET /api/web-products/:slug/order?session_id=cs_…` | possession of the Checkout session id; verified against Stripe (session metadata slug, complete + paid, line item price matches) and recorded | 200 `{ paid: true, slug, name, version, filename, bytes, downloadsUsed, downloadsLimit, email }` (email masked) | 400 bad session id · 402 `{ paid: false }` not paid · 404 unknown slug / session not for this product · 429 (30/min) · 502 Stripe unreachable |
| `GET /api/web-products/:slug/download?session_id=cs_…` | same as `/order` | 200 `application/zip` attachment, `private, no-store`; records a download (`via: session`) | same as `/order`, plus 429 when the per-purchase `downloadLimit` is used up · 404 release not stored |
| `PUT /api/web-products/:slug/releases/:version` | **none, by design** — body (`application/zip` or `application/octet-stream`, ≤ 5 MB) must match the committed `sha256` + `bytes` exactly, and is stored only once | 201 `{ stored: true, sha256, bytes }` | 404 unknown slug / invalid version / version not declared · 422 bytes don't match · 409 already stored · 429 (5/min) |
| `GET /api/web-products/:slug/account-download` | Clerk Bearer token; entitled by a recorded order for the token's email or a `wp_<slug>` purchase/comp-grant row | 200 `application/zip` (records `via: account`) | 401 not signed in · 402 `{ paid: false }` · 404 unknown slug / release not stored · 429 (30/min) |
| `GET /api/admin/web-products?days=30&exclude_self=1` | `requireAdmin` (`days` clamped 1–365; `exclude_self` defaults to 1) | 200 `{ days, excludeSelf, products[], daily[] }` — per product: views, unique visitors, checkout starts, expired + recovered checkouts, orders, revenue (cents), downloads, unique download sessions, last order/download, `releaseStored`; `daily` is per-slug per-day counts | 401/403 per `requireAdmin` |

The Stripe webhook (`checkout.session.completed`) dispatches on `metadata.web_product` before any generic branch: it records the order only if paid, the line-item price equals the product's resolved price id, and an email is present; it also writes a one-time purchase row (`productKey` = `wp_<slug>`). `/stripe/success` redirects web-product sessions to the product's thanks page. `checkout.session.expired` (non-test, non-owner-IP) writes a `checkout_expired` funnel row; a completed session with `recovered_from` writes `checkout_recovered`. The live endpoint must subscribe to `checkout.session.expired`.

### Stripe live vs test

Live mode holds real buyers only. Owner/agent testing never creates live sessions:
- **Owner in a browser:** sign in on bilko.run; checkout routes to test mode. Pay with `4242 4242 4242 4242`. Test orders (`cs_test_…`) deliver the zip but are never counted in `/admin`.
- **Agents/deploy smokes:** `POST /api/web-products/<slug>/checkout?dryRun=1`. Never `POST` without it against prod.
- **Local dev:** `getStripe()` refuses an `sk_live_` key unless `NODE_ENV=production` (override: `STRIPE_ALLOW_LIVE_IN_DEV=1`). Use an `sk_test_` key.
- **Full live-path check** (real webhook, real price): a 100%-off promo code on a live session is still the one sanctioned way; expect it in Stripe as a $0 completed session.

### Playbook (new product)

1. **Stripe:** create a live Product + one-time Price. Set product/session metadata `web_product=<slug>` (the checkout route sets it on the session; the webhook relies on it).
2. **Build the zip** in a **private** sibling repo — never in this repo. Record the filename, byte size (≤ 5 MB) and sha256.
3. **Declare it:** add a `WEB_PRODUCTS` entry in `shared/web-products.ts` — `slug`, `name`, `productKey` (`wp_` + slug with `-` → `_`), `priceEnvVar` (`STRIPE_PRICE_WP_*`), `defaultPriceId`, `displayPrice`, `downloadLimit`, and `release: { version, filename, bytes, sha256 }`. `validateWebProducts` checks the shape. Commit and push to `origin/main`; Render deploys. The env var, when set, overrides `defaultPriceId`.
4. **Upload the bytes once:** `curl -X PUT --data-binary @<file>.zip -H 'Content-Type: application/zip' https://bilko.run/api/web-products/<slug>/releases/<version>`. No secret is needed — the server stores only bytes matching the committed sha256, once (409 afterwards). Confirm `GET /api/web-products/<slug>` returns `available: true`.
5. **Landing page** in the sibling repo, published to `/projects/<slug>/` (static-path, see above): the buy button `POST`s `/api/web-products/<slug>/checkout` and redirects to the returned `url`; read `GET /api/web-products/<slug>` to show price/availability.
6. **Thanks page** at `/projects/<slug>/thanks/`: read `session_id` from the query, call `GET …/order?session_id=` to show status and then `GET …/download?session_id=` for the file. If the link is lost or the session id is missing, offer sign-in (Clerk) and call `GET …/account-download` with the Bearer token.
7. **Monitor** in `/admin` → Products (views, checkout starts, orders, revenue, downloads, release stored).

### Bundled and preview products

Two optional `WebProduct` fields on download products (validated by `validateWebProducts`):

- `includes: string[]` — slugs of other download products delivered with this purchase. Example: the Agent Factory Setup service (`hfh-factory-setup`) has `includes: ['agent-factory-kit']`, so its buyers get the Kit. `GET /api/web-products/:slug/order` then returns an `included` array of `{ slug, name, downloadUrl }` (only entries whose release exists), each `downloadUrl` being `/api/web-products/<included-slug>/download?session_id=…`.
- `preview: { version, filename, bytes, sha256 } | null` — a free preview zip, pinned by sha256 like `release`. Signed-in visitors (Clerk Bearer, no purchase) fetch it with `GET /api/web-products/:slug/preview` (401 not signed in, 404 not stored). Upload it with `PUT /api/web-products/:slug/releases/:version?kind=preview`; it is stored under the reserved slug `<slug>--preview`. `GET /api/web-products/:slug` reports `previewAvailable`.

### Selling a bookable service

A web product with `kind: 'service'` sells a booking instead of a zip: no `release` (must be `null`), no download routes. Several offers can share one landing page.

**`WebProduct` service fields** (all optional; validated by `validateWebProducts`):

| Field | Meaning |
|---|---|
| `kind` | `'download'` (default) or `'service'` |
| `billing` | `'one_time'` (default) or `'month'` (recurring; services only) |
| `pageSlug` | landing page path when it differs from `slug`: one slug, or `<project>/<page>` for a page nested in another bundle (e.g. `launch-kit/agent-factory-kit`); defaults to `slug` |
| `foundingCouponEnvVar` / `foundingDisplayPrice` | `STRIPE_COUPON_WP_*` env var holding the founding-price coupon id, and the price shown for it |
| `maxOrders` | cap on live orders, integer 1–100 |
| `sessionsPerMonth` | bookable sessions included per purchase (per month when billed monthly) |

**Checkout** (`POST /api/web-products/:slug/checkout`) differs from downloads as follows:
- `billing: 'month'` → Stripe `mode: subscription`; one-time services stay `payment`.
- Founding coupon: when `foundingCouponEnvVar` is set, the env var (or `<VAR>_TEST` for owner test-mode sessions) holds a Stripe coupon id. If Stripe says it is still valid, the session gets `discounts: [{ coupon }]` (and no `allow_promotion_codes`); an exhausted or unset coupon silently falls back to full price. `GET /api/web-products/:slug` reports `foundingRemaining` (coupon redemptions left, `null` if unlimited/unknown).
- `maxOrders`: once live orders reach the cap, checkout returns 409 `{ error: 'sold_out' }` and `GET` reports `soldOut: true`. The same cap applies to `/buy/:offerId`.
- Success URL: `/projects/<pageSlug>/thanks/?session_id=…&offer=<slug>`; cancel: `/projects/<pageSlug>/?checkout=cancel`. `/stripe/success` redirects to the same shape.
- `GET /api/web-products/:slug` for a service returns `{ slug, name, displayPrice, kind, billing, pageSlug, foundingDisplayPrice, foundingRemaining, soldOut, available }`.

**Booking endpoints** (slot rules per page live in `shared/service-slots.ts`, keyed by `pageSlug`):

| Endpoint | Auth | Success | Errors |
|---|---|---|---|
| `GET /api/services/:pageSlug/slots` | none | 200 `{ timeZone, durationMinutes, slots: [{ startMs, endMs }] }` — open (unclaimed) slots; `no-store` | 404 unknown page |
| `POST /api/web-products/:slug/booking?session_id=cs_…` body `{ startMs, intake }` | possession of the paid Checkout session id (verified against Stripe) | 200 `{ booking: { startMs, endMs }, icsUrl, emailed }` — claims the slot atomically, emails the buyer (and intake contact) a confirmation with `.ics` and notifies `BILKO_INBOX` | 400 bad session id / body · 402 not paid · 404 unknown service / order · 409 `slot_unavailable` or `limit` (sessions used up) · 429 · 502 Stripe unreachable |
| `GET /api/web-products/:slug/booking.ics?session_id=cs_…` | same | 200 `text/calendar` for the session's latest booking | 400 · 402 · 404 no booking · 429 · 502 |

Mail failures never fail a booking (`emailed: false`).

**Env vars:**

| Var | Purpose |
|---|---|
| `STRIPE_COUPON_WP_*` (+ `_TEST`) | founding-price coupon ids, live and test mode |
| `RESEND_API_KEY`, `MAIL_FROM` | transactional mail via Resend; unset → bookings still succeed, nothing is sent |
| `BILKO_INBOX` | address that receives booking notices; also the `.ics` organizer address (falls back to `noreply@bilko.run` when unset) |
| `HFH_MEETING_LINK` | meeting URL put in the confirmation email and `.ics`; unset → "Bilko will email the meeting link" |

## Why this contract exists

The AI tools were originally built as one product with one codebase. They've grown into independent products that happen to share a host. This contract makes that explicit, so:

- Adding a new tool is a checklist, not an architectural decision.
- A failing tool can't break the others (per-tool server files, code-split frontend bundles).
- Any tool can be extracted to its own repo later by following the `static-path` migration: build standalone, publish into `public/projects/<slug>/` via the MCP, switch the host kind. No URL change for users.

See [`docs/host-internals.md`](host-internals.md) for monitoring, QA, cost, caching, observability, and security-header detail.
