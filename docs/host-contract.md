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
3. Register it in `src/data/projectsRegistry.ts` (and `src/config/tools.ts` if `react-route`).
4. Run `pnpm test && pnpm exec tsc --noEmit && pnpm exec vite build` — all must pass.
5. Commit and push to both remotes (`origin` and `content-grade`). Render auto-deploys.
6. Verify the project shows up on `/`, `/products`, and in ⌘K.

## Removing an app

1. Delete its entry from `projectsRegistry.ts` (and `tools.ts` if `react-route`).
2. Delete the page (`src/pages/<slug>Page.tsx`) and per-tool server file (`server/routes/tools/<slug>.ts`) and remove the call from `server/routes/tools/index.ts`.
3. For `static-path`: `rm -rf public/projects/<slug>/`.
4. Add a redirect in `src/App.tsx` if the slug is still being linked from outside.

## Why this contract exists

The 10 AI tools were originally built as one product with one codebase. They've grown into 10 independent products that happen to share a host. This contract makes that explicit, so:

- Adding the 11th tool is a checklist, not an architectural decision.
- A failing tool can't break the others (per-tool server files, code-split frontend bundles).
- Any tool can be extracted to its own repo later by following the `static-path` migration: build standalone, drop into `public/projects/<slug>/`, switch the host kind. No URL change for users.

The OutdoorHours and Boat Shooter migrations are the reference implementations of the `static-path` lane.
