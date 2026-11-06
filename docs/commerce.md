# Bilko commerce

The one platform-side owner of money on bilko.run: the credit model, the Bilko Credits wallet and menu, the agent storefront, bookable services and the Stripe subscription lifecycle. Sibling apps need only [`docs/host-contract.md`](host-contract.md) (which keeps the downloadable-web-product section and "Stripe live vs test"); everything else about money lives here. Page specifics for `/book` and `/pricing` belong to `docs/site.md`.

## Credit model

- **Free tools** (LocalScore, OutdoorHours) deduct nothing.
- **Paid tools** spend **legacy tokens first** (PageRoast token bundles, AudienceDecoder one-time tier), then **wallet credit at $1 a call** (1 credit = 1 cent of balance). The gate is `creditGate` in `server/routes/tools/_shared.ts`; free-tier endpoints use `freeTierGate`.
- **Wallet top-ups:** $3, $5 or $10 (`WALLET_TOPUP_CENTS` in `shared/bilko-menu.ts`), plus a PPP bonus (below).
- **Credit-bought product:** one item, the Agent Factory Kit ($3).
- Auth for token-spending endpoints is `requireAuth` (Clerk); a `bkk_` key is accepted only on the routes listed under "Agent keys".

## Offers

Every paid offer lives in one file, `shared/agent-offers.ts` (`AGENT_OFFERS`): `id`, name, summary, `whatYouGet`, `amountCents`, `billing` (`one_time` | `month` | `year`), `pageUrl`, `buyUrl`, a `source` pointing at the existing catalog (`web_product` slug in `shared/web-products.ts`, `price_catalog` type in `shared/product-catalog.ts`, or `wallet_topup`), and `agentKey` (true when the purchase yields a `bkk_` key). `amountCents` is not in `PRICE_CATALOG` for web products, so it must match the price on the app's page and in Stripe.

| Offer id | Price | Billing | Yields `bkk_` key |
|---|---|---|---|
| `bilko-hour` | $100 | one time (hours chosen at checkout) | no |
| `launch-kit` | $9 | one time | no |
| `agent-factory-kit` | $3 | one time (also buyable with $3 of credits) | no |
| `git-viewer` | $5 | per year | no |
| `pageroast-credits-7` | $5 | one time | yes |
| `pageroast-credit-1` | $1 | one time | yes |
| `credits-3`, `credits-5`, `credits-10` | $3, $5, $10 | one time (wallet top-ups) | yes |

**To add an offer:** add an entry to `AGENT_OFFERS` (and the underlying web product or price-catalog entry if new). That one edit flows to `/llms.txt`, `GET /api/offers`, the `list_offers` MCP tool, the `offers` on each project in `/api/projects` and `list_projects`/`get_project`, the JSON-LD on the offer's page, and `/buy/<id>`.

**JSON-LD:** when a page's path equals an offer's `pageUrl` path, the server injects a `<script type="application/ld+json">` block with one schema.org `Product` + `Offer` per offer (price, currency, `url` = `buyUrl`; monthly offers add a `UnitPriceSpecification` with `billingDuration: P1M`). Pages that already declare a `Product` are left alone. Code: `server/offer-jsonld.ts`, wired in `server/og-routes.ts`.

## Agent storefront

bilko.run treats AI agents as a customer segment: they can discover what is for sale, read the project catalog, and buy, without a browser session. All of it is derived from data, not hand-written per surface.

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/llms.txt` | none | Plain-text storefront for LLMs: offers with prices and `/buy` links, public projects, and the agent endpoints below. A public static-path project whose bundle ships its own `llms.txt` (at the bundle root, served as `/projects/<slug>/llms.txt`) is linked under "Project guides". `server/routes/agent-storefront.ts` |
| GET | `/api/offers` | none | JSON `{ offers: [...] }`: `id`, `name`, `summary`, `whatYouGet`, `price`, `amount`, `currency`, `billing`, `pageUrl`, `buyUrl`, `howToBuy`. `Cache-Control: public, max-age=300`. |
| GET | `/api/projects` | none | The public project catalog (see "Public project catalog" in `docs/host-contract.md`), each project with its `offers` (`id`, `price`, `buyUrl`). |
| POST | `/mcp` | none for catalog tools; `Authorization: Bearer bkk_...` for `wallet_balance`, `order_menu_item` and `roast_page` | Stateless streamable-HTTP MCP server. See "MCP tools" below. |
| GET | `/api/wallet` | Clerk session or `bkk_` key | `{ balanceCents, balance }`: the caller's Bilko Credits balance. `private, no-store`. |
| POST | `/api/wallet/topup` | Clerk session only | Body `{ cents }` with `cents` one of 300, 500, 1000. Creates a Stripe Checkout session and returns its URL. 400 for any other amount, 429 rate limited, 503 when Checkout is unavailable. Agents without a session buy credits through `/buy/credits-N`. |
| GET | `/buy/credits-3`, `/buy/credits-5`, `/buy/credits-10` | none | Same as `/buy/:offerId` for the $3, $5 and $10 wallet top-ups (offers `credits-3|5|10`, `source.kind: 'wallet_topup'`). Each also yields a `bkk_` key on the success page. |
| GET | `/api/menu` | none | The Bilko credits menu: `topups` and the one item credits buy, the Agent Factory Kit (`id`, `name`, `price`, `priceCents`, `kind`, intake fields). `public, max-age=300`. |
| POST | `/api/menu/:itemId/order` | Clerk session or `bkk_` key | Body `{ intake }` (strings, validated against the item's intake fields). Spends the item's price from the wallet. 201 `{ order: { id, itemId, status, priceCents }, balanceCents }`. Errors: 400 `invalid_intake`, 402 `insufficient_credits` (with `balanceCents`, `topUpUrl`), 404 `unknown_item`, 409 `{ error: 'unavailable' }` (item not on sale yet), 429. Rate limited per IP. |
| GET | `/api/menu/orders` | Clerk session or `bkk_` key | The caller's own orders (`id`, `itemId`, `status`, `priceCents`, `createdAt`). |
| GET | `/buy/:offerId` | none | A browser GET (a `Mozilla/` user agent that `classifyVisitor` calls `human`) creates a **live** Stripe Checkout session and 302-redirects to it. Every other client gets a static page with the price and the link, and no session: HEAD, crawlers, AI fetchers (`ChatGPT-User`), HTTP clients (curl, Wget, python-requests, Node `fetch`) and headless browsers. `?dryRun=1` runs the checks a browser GET would (Stripe, price, availability, sold out) and returns that page or the error status. It never opens a session and is not rate limited. A session from an IP with admin page hits is flagged like `POST …/checkout` (`owner_ip` metadata, `is_admin=1` funnel row). Unknown id: 404 listing valid ids. Rate limited (10 sessions/min/IP); 503 when Checkout is unavailable. |
| POST | `/api/agent-keys` | Clerk session | Mints a `bkk_` key, returned once (`key`, `prefix`, `id`). 409 at 10 active keys. |
| GET | `/api/agent-keys` | Clerk session | Lists the caller's keys (prefix, label, timestamps; never the secret). |
| DELETE | `/api/agent-keys/:id` | Clerk session | Revokes one of the caller's keys. |


## Bilko Credits wallet and credit-bought product

Bilko Credits are a prepaid wallet (1 credit = 1 cent of balance, shown as dollars). Credits pay for bilko.run tools (for example `roast_page`, 1 credit) and for one product, the Bilko Agent Factory Kit. Human time is not bought with credits; the Bilko hour and the free hour are below.

- **Top-ups:** $3, $5 or $10 (`WALLET_TOPUP_CENTS` in `shared/bilko-menu.ts`). Humans use `POST /api/wallet/topup`; agents open `/buy/credits-3|5|10`. The Stripe webhook credits the wallet only when the session is paid and the subtotal equals an allowed amount. Code: `server/routes/wallet.ts`, `server/services/wallet.ts`.
- **PPP bonus:** a country-based bonus paid as extra credits on a top-up, never a lower charge. The country comes from the payment card (falling back to the billing address). High-income countries get 0%, upper-middle-income 50%, lower-middle and low income 100%, per the World Bank classification; unlisted or unknown countries get 0%. The bonus is a second, separate wallet credit (`ppp_bonus:<CC>`) keyed to the Checkout session, so a replayed webhook cannot pay it twice. Edit the table in `shared/ppp-bonus.ts`.
- **Credit-bought product:** `shared/bilko-menu.ts` (`MENU_ITEMS`) holds one item, `agent-factory-kit` ($3, kind `download`, no intake). `GET /api/menu` lists it, `POST /api/menu/agent-factory-kit/order` (or the MCP `order_menu_item` tool) spends the credits. Code: `server/routes/menu-orders.ts`, `server/services/menu-orders.ts`.
- **Bilko hour (paid, $100):** the `bilko-hour` web product (`shared/web-products.ts`, `kind: 'service'`, page `human-for-hire`, up to 40 hours per purchase). It is paid with Stripe Checkout, not credits. The buyer books slots with the booking endpoints in "Bookable services" (below) (`GET /api/services/human-for-hire/slots`, then `POST /api/web-products/bilko-hour/booking?session_id=cs_…`). Admin view: `GET /api/admin/bookings` (`requireAdmin`; free hours booked, paid hours, paid orders, mailer status and upcoming bookings).
- **Free hour:** a signed-out, no-payment hour booked on the same `human-for-hire` slots (Tue/Wed/Thu 18:30 Pacific, `shared/service-slots.ts`). `POST /api/services/human-for-hire/free-hour` books it and `POST /api/services/human-for-hire/free-hour/cancel` cancels it with the `free_…` token; one free hour per email. It books with mail unset. The free hour is booked on https://bilko.run/book (the `/bilko`, home and pricing "Book a free hour" buttons link there), where the visitor picks a time in their own time zone, can add optional topic chips, gets the `.ics` plus Google and Outlook links, and can Reschedule or Cancel. Code: `server/routes/free-hour.ts`.
- **Booking mail:** with mail unset this server sends nothing. A local job in the owner's Self repo polls `GET /api/admin/bookings` with the read-only admin key and sends the confirmation and the owner's alert from Bilko's Gmail. It reads `upcoming[].slug`, `startMs`, `endMs`, `email`, `topic`, `createdAt` and `paid_orders[].email`, `hours`, `createdAt`, so keep those names. `topic` already folds the free-hour chips in (`tags` joined by `, `, then ` — ` and the note); `upcoming[].tags` carries the chips alone (empty for old rows). `upcoming[].id` and `upcoming[].icsSequence` are the booking id and the SEQUENCE of its current `.ics`, so a mailed invite can reuse the page's `UID:booking-<id>@bilko.run` and SEQUENCE (see "Booking endpoints") and update the booker's one event instead of adding a second. `hours` is `amount_total` over $100, the same basis as `paid_hours`, so an order with a promotion code reads low. The server must never depend on that job.
- **Page:** the Hire page is `/book` (the Booking Page 1a design). `/bilko`, `/hire`, `/human-for-hire` and the old `/projects/human-for-hire/` paths 301 to it, keeping the query. The paid-hour Checkout return notice shows there. The `bilko-hour` offer's page is `/pricing`. The contact email is in `shared/bilko-profile.ts`; routes in `server/bilko-profile-routes.ts`.


## MCP tools

`POST /mcp` serves these tools. The list is asserted against `/llms.txt` in `tests/agent-storefront.test.ts`.

| Tool | Key | Does |
|---|---|---|
| `list_projects` | none | Public project catalog (same data as `GET /api/projects`). |
| `get_project(slug)` | none | One public project; not-found error otherwise. |
| `list_offers` | none | Everything for sale with `buyUrl` (same data as `GET /api/offers`). |
| `list_menu` | none | The credits menu (same data as `GET /api/menu`). |
| `wallet_balance` | `bkk_` | The key owner's balance. |
| `order_menu_item(itemId, intake)` | `bkk_` | Orders the Agent Factory Kit from the key owner's wallet. 20 orders a minute per account. Errors name the cause (`insufficient_credits`, `unavailable`, `invalid_intake`, `unknown_item`). |
| `roast_page(url)` | `bkk_` | Paid page roast, 1 credit. |

A tool that needs a key returns an `isError` result with the top-up link when the key is missing or invalid.

## Agent keys (`bkk_`)

- A `bkk_` key identifies a bilko.run account (by email) to the agent surfaces. It is minted either by the account owner via `POST /api/agent-keys` (Clerk session) or revealed once on the checkout success page after buying an offer with `agentKey: true`. Only a hash is stored; the secret is shown once.
- Keys are accepted on `/mcp` and on the wallet and menu routes (`GET /api/wallet`, `POST /api/menu/:itemId/order`, `GET /api/menu/orders`). They can read the owner's balance, order the Agent Factory Kit from it and call `roast_page` (1 credit, through the same `creditGate` path as the web app). A key never grants admin, never passes `requireAuth`, and cannot mint or revoke keys, so a leaked key can spend only that account's credits.
- Max 10 active keys per account. Implemented in `server/services/agent-api-keys.ts`, `server/routes/agent-keys.ts`.

## Visitor classes

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

## UTM revenue funnel

`GET /api/admin/funnel?utm_source=<src>&since=YYYY-MM-DD` (`requireAdmin`, so read-only `bka_` keys work; `since` defaults to 7 days ago) returns `{since, utm_source, visits, sign_ins, checkout_start, paid, booked, free_hours_booked}` as integers. A visitor counts when one of their sessions since `since` landed with that `utm_source` (case-insensitive) or later viewed a page tagged with it. Sessions keep their landing source, so an in-site link such as the Session Manager pages' free-hour links (`/book?utm_source=session-manager&utm_medium=header|product-page|manual`) is attributed through its page view. `visits` counts sessions; `sign_ins`, `checkout_start` and `paid` count visitors; `booked` counts paid service bookings; `free_hours_booked` counts free-hour bookings, never part of `booked`. The free-hour route writes a `free_hour_booked` funnel event with the cookie ids and the booking id (never the cancel token). Web-product `checkout_start` rows carry the `bilko_vid`/`bilko_sid` cookies and the Stripe checkout session id, which is how orders and bookings join back to the visit (or by the visitor's signed-in email). Admin and bot traffic are excluded unless `exclude_self=0` / `include_bots=1`. Burrow consumes it; the `bilko-host` MCP exposes it as `funnel_report`.

## Bookable services

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
| `GET /api/services/:pageSlug/slots` | none | 200 `{ timeZone, durationMinutes, slots: [{ startMs, endMs }], taken: [{ startMs, endMs }] }` — `slots` are open (unclaimed); `taken` are generated slots inside the horizon already claimed, ascending, times only (no email, id, slug or intake); `no-store` | 404 unknown page |
| `POST /api/web-products/:slug/booking?session_id=cs_…` body `{ startMs, intake }` | possession of the paid Checkout session id (verified against Stripe) | 200 `{ booking: { startMs, endMs }, icsUrl, emailed }` — claims the slot atomically, emails the buyer (and intake contact) a confirmation with `.ics` and notifies `BILKO_INBOX` | 400 bad session id / body · 402 not paid · 404 unknown service / order · 409 `slot_unavailable` or `limit` (sessions used up) · 429 · 502 Stripe unreachable |
| `GET /api/web-products/:slug/booking.ics?session_id=cs_…` | same | 200 `text/calendar` for the session's latest booking | 400 · 402 · 404 no booking · 429 · 502 |
| `POST /api/services/human-for-hire/free-hour` body `{ email, startMs, topic?, tags?, website? }` (`?dryRun=1` checks only) | none (signed out, no payment; 6/hour/IP) | 201 `{ booking: { startMs, endMs }, emailed, ics, cancelToken }` — claims the slot; with mail set, also mails the booker the `.ics` and notifies `BILKO_INBOX`; dry run 200 `{ dryRun: true }` | 400 `invalid` · 409 `slot_unavailable` or `already_booked` · 429 `rate_limited` |
| `POST /api/services/human-for-hire/free-hour/cancel` body `{ token }` | possession of the `free_…` cancel token (10/min/IP) | 200 `{ cancelled: true }` — frees the slot, notifies `BILKO_INBOX` | 400 `invalid` · 404 `not_found` · 429 |
| `POST /api/services/human-for-hire/free-hour/reschedule` body `{ token, startMs }` | possession of the `free_…` cancel token (10/min/IP) | 200 `{ booking: { startMs, endMs }, ics, cancelToken }` — atomically moves the booking to another open slot (same id, email, intake; the one-free-hour rule is not re-checked) and raises its SEQUENCE by one, so `ics` keeps the booking's UID and outranks every earlier one; notifies `BILKO_INBOX` | 400 `invalid` · 404 `not_found` · 409 `slot_unavailable` · 429 |

Mail never fails a booking, paid or free: unset or failing mail still books, with `emailed: false`.

Every booking `.ics` (the booking and reschedule responses, `booking.ics`, the mailed confirmation) carries `UID:booking-<id>@bilko.run` and `SEQUENCE:<n>`. `n` is stored per booking: 0 when booked, one higher per reschedule (`upcoming[].icsSequence` in `GET /api/admin/bookings`). Under RFC 5546 a calendar that already holds the UID moves that event, and ignores an invite with a lower SEQUENCE.

**Env vars:**

| Var | Purpose |
|---|---|
| `STRIPE_COUPON_WP_*` (+ `_TEST`) | founding-price coupon ids, live and test mode |
| `RESEND_API_KEY`, `MAIL_FROM` | transactional mail via Resend; unset → bookings still succeed, nothing is sent |
| `BILKO_INBOX` | address that receives booking notices; also the `.ics` organizer address (falls back to `BILKO_CONTACT_EMAIL` in `shared/bilko-profile.ts` when unset) |
| `HFH_MEETING_LINK` | meeting URL put in the confirmation email and `.ics`; unset → "Bilko will email the meeting link" |
## Stripe subscription lifecycle

- **ContentGrade is retired** (2026-10-09): no license keys, no Pro sales, `/upgrade` redirects home. The legacy subscription lifecycle (webhook `saveSubscription`, billing portal, `priceToPlanTier`) stays only until Stripe shows zero active ContentGrade subscriptions; then delete it.
- **Git Viewer** is $5 a year (`STRIPE_PRICE_GITVIEWER`). `priceToPlanTier` maps the current price and the retired $5/month price (kept in `legacyPriceIds`) to `git_viewer`, which sets `gitViewer` but never `isPro`.
- **Service subscriptions:** a `kind: 'service'` web product with `billing: 'month'` uses Stripe `mode: subscription` (see "Bookable services").
- **Webhook:** `server/routes/stripe.ts`. `checkout.session.completed` dispatches on `metadata.web_product` first, then the wallet top-up and generic branches; `checkout.session.expired` must be subscribed on the live endpoint.

## Stripe live vs test

The decision and the rules are kept in [`docs/host-contract.md`](host-contract.md) → "Stripe live vs test" (a sibling cites that heading). In short: live mode holds real buyers only; the owner's signed-in browser checks out in test mode; agents and deploy smokes use `?dryRun=1` or `HEAD`; `/buy/<id>` from a browser opens a live session, so never click it in captures.

Facts worth keeping from the 2026-10-20 expired-session review:
- Every Launch Kit checkout that expired before 2026-10-20 was the owner or an owner agent; no real buyer abandonment was seen. The coffee Payment Link (`/coffee`) sessions carry no `checkout_start` row, email or IP, so they cannot be attributed to a visitor by the funnel.
- Prevention shipped 2026-10-20: owner checkouts go to test mode, `?dryRun=1` for smokes, `getStripe()` refuses an `sk_live_` key outside production, recovery is on.
- Catalog cleanup (owner-confirmed 2026-10-20/21): Stepproof Suite and Pro, Preflight Enterprise and Team, ContentGrade Pro, [Subscription] Query Flow and [ARCHIVE] Background Labs were archived in live Stripe. Kept: Git Viewer, Launch Kit, coffee, Session Manager, AudienceDecoder, PageRoast, BG Labs tiers. The Stripe catalog itself is owned by the Self repo.

## Agent payment rails: decision

Researched 2026-10-20 (third-party claims were not re-verified since). Lifetime Stripe revenue was about $21 then, so no new rail is worth multi-day work until real agent traffic is stuck at the existing one.

- **Shipped and kept:** prepaid credits plus a `bkk_` key (above). One human purchase, then hands-free calls. Prepaid bundles pay Stripe's fixed 30¢ fee once instead of per call.
- **`/buy` 302 over Payment Links:** `/buy` can mint a `bkk_` key and attach the purchase to the buyer's email; a plain Payment Link cannot. Both still need a human on Stripe's page.
- **Not now, with triggers:** Stripe Agentic Commerce / Shared Payment Tokens and ChatGPT Instant Checkout (4-8 days; trigger: OpenAI opens merchant onboarding beyond approved partners and allows digital goods); HTTP 402 pay-per-call, card-only (MPP; 3-5 days; trigger: at least 10 agent hits a month that stop at checkout, or card machine payments reach general availability; crypto settlement is out of scope); Stripe Directory listing (0.25 day; trigger: a machine-payments endpoint exists).
- **Next step if revisited:** make option 4 observable: count `/buy` hits, purchases and `bkk_` calls by visitor class (see "Visitor classes").

Web-product downloads, their endpoints and the new-product playbook stay in `docs/host-contract.md` → "Selling a downloadable web product".
