---
title: Build the real Session Manager landing page on bilko.run with live Clerk sign-in + Stripe checkout
cwd: ~/Projects/Bilko
estimateMinutes: 30
---

# Goal

**Depends on PRD 711 (`711-stripe-catalog-session-manager-product.md`) — do not start until it
has landed** (verify via `git log --oneline -- shared/product-catalog.ts` for the
`session_manager` catalog entry; if absent, halt with
`SCHEDULER_VERDICT: FAIL blocked-on-711`).

Session Manager is currently registered as a `"static-path"` project
(`src/data/standalone-projects.json`, `slug: "session-manager"`, tagged `"Free"`), served as a
plain static bundle at `/projects/session-manager/`. Replace that page's content with a real
landing page — hero, a feature showcase of the app's key surfaces, and an optional
Buy-Me-a-Coffee-style purchase flow (Clerk sign-in → Stripe checkout for the new
`session_manager` product from PRD 711 → a license key + the same `npx
claude-code-session-manager@latest` install command, unchanged) — while leaving the free `npx`
distribution completely untouched; the purchase is a separate, optional support/monetization
path, not a paywall.

**A verified, browser-tested design reference already exists** — Claude Design project "Session
Manager" (id `0ca33cd3-c2fa-4644-b728-bde42292abbd`), file `Landing Page.html`
(https://claude.ai/design/p/0ca33cd3-c2fa-4644-b728-bde42292abbd?file=Landing+Page.html). It uses
this app's real captured screenshots (Scheduler, Subagents/Hive, History, Usage, Voice, Browser,
Web Remote, left-nav) in an auto-advancing carousel, and a 4-stage purchase flow (idle → sign-in →
checkout → ready) that was click-tested end to end in a browser and renders cleanly. Match its
visual structure and copy; the design work is done — this PRD's job is wiring it to real
Clerk/Stripe instead of the mockup's placeholder buttons.

# Acceptance criteria

- [ ] **Investigate how Clerk auth actually works for a `static-path` project first, before
  writing any UI.** `src/App.tsx` wraps the *main* Bilko React app in `ClerkProvider`, but
  `public/projects/*/` static bundles are separate standalone apps outside that React tree.
  Check whether any other static-path project already does client-side sign-in (grep
  `public/projects/*/assets/*.js` for Clerk usage, and check whether it's live functionality or
  inert bundled boilerplate — a string match alone doesn't prove it's used) before deciding
  whether to (a) initialize Clerk's client-side JS SDK directly and standalone within this static
  page (publishable key only, no secret — the same trust boundary a public static page always
  has), or (b) some other pattern this repo already uses for static-path auth. Prefer (a) unless
  you find clear evidence another pattern is already established and expected — don't restructure
  this project's routing to force static-path pages into the main React tree just for this.
- [ ] Fetch the Claude Design mockup's HTML/JSX (`Landing Page.html` +
  `variants/landing-page.jsx` in that project) via the `claude_design` MCP tools
  (`read_file`/`list_files` against project id `0ca33cd3-c2fa-4644-b728-bde42292abbd`) to get its
  exact copy, layout, and the 8-item feature list — port the structure and copy, don't
  re-invent it from this PRD's prose summary alone.
- [ ] Replace the purchase flow's placeholder buttons with real calls:
  - Sign-in → Clerk's client SDK sign-in flow (email or Google, matching the mockup's two
    options) for a `bilko.run` session.
  - Checkout → `POST /api/stripe/create-checkout-session` with
    `{ email, priceType: 'session_manager', successUrl, cancelUrl }` (this route already exists
    and is fully generic over `priceType` — no server route changes needed here beyond what PRD
    711 already added to the catalog).
  - On return from Stripe, the existing `/checkout/success` handler (fixed by PRD 711 to be
    product-aware) issues the license key and renders it — link/redirect there rather than
    reimplementing success-state UI from scratch; if the static page needs its own styled
    success view instead of the existing plain `successHtml()` page, that's acceptable but must
    still read the real session/license data from the same endpoint, not fabricate it client-side.
- [ ] The "ready" state's `npx claude-code-session-manager@latest` command and copy-button stay
  exactly as in the mockup — this is real, accurate, unchanged distribution info, not a
  placeholder.
- [ ] Update `src/data/standalone-projects.json`'s `session-manager` entry only if its existing
  fields (`tagline`, `tags`) need updating to reflect the new page content — the `"Free"` tag
  stays accurate (the app itself is still free); do not add a `"Paid"`/`"Pro"` tag, since nothing
  is gated.
- [ ] **Security (mandatory):** confirm the Stripe checkout call never trusts a client-supplied
  price/amount — it must only ever pass `priceType` (a fixed string), letting the server resolve
  the actual price ID from the catalog + env var, exactly as the existing route already does for
  every other product. Do not add a client-side price display sourced from anything but a
  server response.
- [ ] `timeout 300 <this repo's typecheck command — check package.json>` passes.
- [ ] `timeout 300 <this repo's test command — check package.json>` passes, including whatever
  test you add/extend for the new static page's checkout call (mock the fetch to
  `/api/stripe/create-checkout-session`, assert it's called with `priceType: 'session_manager'`
  and never a client-supplied amount).

# Implementation notes

- Read `src/data/standalone-projects.json`'s full `session-manager` entry and
  `public/projects/session-manager/`'s current file structure first — confirm exactly what
  build step (if any) produces that static bundle before editing it directly, so you don't hand-
  edit a generated file that a build script would overwrite.
- Read `server/routes/stripe.ts:49-116` (`create-checkout-session`) — it's already fully generic;
  this PRD should not need to change it at all, only call it correctly from the new page.
- Read `server/clerk.ts` for the server-side verification shape (`verifyClerkToken`) so whatever
  client-side sign-in you wire produces a token this backend can already verify — don't invent a
  second auth verification path.

# Out of scope

- Do not touch the `npx`/npm distribution — confirmed unchanged, this PRD is the bilko.run
  landing page only.
- Do not change `/api/stripe/create-checkout-session`, the webhook handler, or license-key
  generation logic — PRD 711 already made the one necessary fix (product-aware success
  handling); this PRD only calls the existing, now-correct machinery.
- Do not add a paywall, gate the npx install, or change any other standalone project's page.
- Do not create the actual Stripe Product/Price — that remains a manual step outside any PRD's
  scope; this page will show "Stripe not configured" gracefully until that env var is set, which
  is expected and fine to ship as-is.

## Engineering standards

Before writing any code, read `~/Projects/session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging, API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is mandatory, especially Execution discipline (bounded commands, verify before done, the finish-protocol sentinel).
