# bilko.run site

The one owner for bilko.run's own pages: host routes, brand voice, the Hire page, the Session Manager landing and manual, sign-in capture and the tip jar. App contract: [`host-contract.md`](host-contract.md). Money (prices, booking flow, credits): [`commerce.md`](commerce.md).

## Host routes

The SPA router is `src/App.tsx`; read it for which page serves which path. Server routes are under `server/`. The project list is the registry, not this doc. Rules the router does not show:

- `/projects` renders only registry entries with `public: true` (`src/data/projectsView.ts`).
- `/book` (the Hire page) is a React page, `BookingPage` in `src/App.tsx`. Its server HTML shell comes from `server/bilko-profile-routes.ts`.
- Human For Hire's registry entry is `external-url` to `https://bilko.run/book`; there is no static-path bundle.
- Old Hire paths 301 to `/book`, keeping the query. Fastify (`server/bilko-profile-routes.ts`) redirects only an exact list: `/bilko`, `/hire`, `/human-for-hire`, `/projects/human-for-hire` and `/projects/human-for-hire/thanks`, each with or without a trailing slash. In the SPA, `RedirectHireToBook` handles `/bilko`, `/hire` and `/human-for-hire`; every `/projects/*` path, `/projects/human-for-hire/*` included, goes to `RedirectProjectsToProducts`.
- `/coffee` (`server/routes/stripe.ts`) 302s to the Stripe tip Payment Link and must never 404 or 5xx.
- `/products/session-manager`, its manual and `/admin/observability` render outside `<Layout />`.

## Brand voice

Witty, direct, no corporate fluff. The tools are comedic (PageRoast has roast lines, grades have personality). The homepage is a studio-of-one page (hero: "studio of one", `src/pages/HomePage.tsx`), not a SaaS landing page. The blog is informative and reflective: "building in public, learning out loud."

Rule: site copy describes the site and its projects. Bilko is an AI agent, so never write first-person "I'm Bilko, a builder" copy and never claim a location.

## Hire page (`/book`)

Implements the Booking Page 1a design. Design source: claude.ai/design "Conversion booking page mockups", option 1a. Local copy: `~/.local/state/bilko-design-refs`. Prices, slots, free hour, mail and booking endpoints: `commerce.md`.

- `/book` renders inside `<Layout />`: site header, Primary nav with Hire active, bottom bar. Do not move it back out of the Layout. The page has no brand row of its own; the header carries the brand.
- Brief: 1280x720 with the site chrome. In Pacific time, steps 1-3 fit with no scroll. In other time zones, and with the paid checkout notice, the booking card stays inside the first screen; only the bottom bar may fall below it.
- Above 900px the booking area fills the space between the header and the bottom bar, up to 820px tall (`src/styles/booking-page.css`, `.portfolio-shell:has(> main > .booking-page)`).
- The server HTML for `/book` (`server/bilko-profile-routes.ts`) wraps the booking copy in chrome built from `shared/site-chrome.ts`. Keep it in step with `src/components/Layout.tsx`. `e2e/book-prerender-parity.spec.ts` checks the two line up on a production build; run `pnpm build` first.

## Session Manager and react-route sub-paths

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
| `/products/session-manager/manual` | SPA, outside `<Layout />` with the landing's own header — the Field Manual reader (free) |
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


## Sign-in capture ("sign in for updates")

A capture page may show an inline, dismissable (never modal) prompt offering bilko.run sign-in for updates. Nothing on the page may require it. Capture pages and their `source` values live in `shared/signin-capture.ts`: `session-manager` (`/products/session-manager`), `manual` (`/products/session-manager/manual`), `human-for-hire` (the Hire page, `/book`, and the old Hire paths that 301 to it). Adding a page means adding it there.

| Endpoint | Auth | What it does |
|---|---|---|
| `POST /api/signin-capture` `{ source, consent }` | Clerk Bearer (`requireAuth`) | Records the account's first `source` (never overwritten). `consent: true` (the literal) sets the "send me occasional updates" flag with a timestamp. Anything else leaves it unchanged, so consent defaults off and is never revoked here. The first capture writes a `signin_completed` funnel event. |
| `GET /api/admin/signups?days=N` | `requireAdmin` | Signups and consent by source, latest 500 rows, and the prompt funnel for the window. |
| `GET /api/admin/signups.csv` | `requireAdmin` | Every row as a CSV attachment. |

Funnel events: the page sends `prompt_shown` and `prompt_dismissed` through `POST /api/analytics/event` with `tool: <source>`. The server writes `signin_completed`.

**From a page outside this repo's React app**: signed out, show the prompt with the consent checkbox unticked. Remember a dismissal in `localStorage`. On "Sign in", store `{ source, consent }`, then call host-kit `openSignIn()`. Once signed in, `authFetch('/api/signin-capture', { method: 'POST', body })` with the stored values. The in-repo reference is `src/pages/session-manager-landing/SignInPrompt.tsx`. Copy stays in the Bilko persona. The consent flag is only recorded; nothing mails the consent list.

