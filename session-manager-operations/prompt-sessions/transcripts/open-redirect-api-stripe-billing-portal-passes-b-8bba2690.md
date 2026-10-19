# Transcript — open-redirect-api-stripe-billing-portal-passes-b-8bba2690

## User — 2026-10-12T16:06:28.742Z

This session is INBOUND FEEDBACK from another project: git-viewer (/home/bilko/Projects/git-viewer, session how-is-our-progress-towards-saas-this-project-is-1437947c). It was raised while working on: How is our progress towards SAAS?  This project is in your hands to monetize, how do we go about it finishing the product? We then since it already listed on Bilko, should have a "Your Git your Resume" pitch part of it and ensure that others can use it from the web alone. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Open redirect: /api/stripe/billing-portal passes body.returnUrl unvalidated to Stripe

## Why
git-viewer is adding a "Manage billing" button on hosted portfolios that calls POST /api/stripe/billing-portal with a returnUrl. While reading the contract, we saw that the route passes `return_url: body?.returnUrl ?? publicUrl` to Stripe with no origin check. The checkout route next to it already restricts successUrl/cancelUrl through safeUrl (same-origin only). Because of this gap, anyone can mint a real Stripe-hosted billing-portal link that sends a bilko.run customer to an attacker URL afterwards (phishing with a trusted stripe.com hop).

## Proposed plan
1. In server/routes/stripe.ts, the billing-portal handler (~line 309-340): validate body.returnUrl with the same same-origin rule as the checkout route's safeUrl (stripe.ts ~line 105), falling back to publicUrl.
2. Hoist safeUrl into a shared module-level helper so checkout and portal use one implementation.
3. Add a unit test: a foreign-origin returnUrl falls back to publicUrl, and a same-origin https://bilko.run/projects/git-viewer/?u=x is kept.

## Acceptance criteria
- [ ] POST /api/stripe/billing-portal with returnUrl 'https://evil.example/' creates a session whose return_url is PUBLIC_URL.
- [ ] A same-origin returnUrl (e.g. https://bilko.run/projects/git-viewer/?u=octocat) is preserved.
- [ ] Checkout and portal share one safeUrl helper, with a test.

## Details
Observed in ~/Projects/Bilko/server/routes/stripe.ts: the checkout handler defines `const safeUrl = (raw, fallback) => new URL(raw).origin === allowedOrigin ? raw : fallback` (around line 105), but the billing-portal handler (around line 331) does `stripe.billingPortal.sessions.create({ customer: customerId, return_url: body?.returnUrl ?? publicUrl })`. The portal does require an email with an existing Stripe customer, so an attacker needs a victim's email. The link is still a valid Stripe-hosted session that redirects off-site. git-viewer will send same-origin returnUrls only (PRD 32-checkout-return-billing in the git-viewer repo), so the fix does not break it.

Reference: /home/bilko/Projects/Bilko/server/routes/stripe.ts

## Agent — 2026-10-12T16:08:03.674Z

I confirmed git-viewer's report and fixed it: the billing-portal route now refuses to send customers to another site after they manage billing. The fix is pushed to `origin/main` as commit `6cc81b9`.

**The problem was real.** In `server/routes/stripe.ts`, the billing-portal route passed `return_url: body?.returnUrl ?? publicUrl` to Stripe without checking where it pointed. The checkout route next to it already restricted its URLs to bilko.run. So anyone who knew a customer's email could create a genuine stripe.com billing link that dropped that customer on any website afterwards.

**The fix:**
- I moved checkout's `safeUrl` check out to one shared, exported `safeUrl(raw, fallback)` helper. It only accepts URLs on the same site as `PUBLIC_URL`.
- Checkout and the billing portal now both use it: `return_url: safeUrl(body?.returnUrl, publicUrl)`.
- New `tests/stripe-billing-portal.test.ts` (3 tests) checks two things:
  - **The helper:** it rejects foreign sites, look-alike domains (`bilko.run.evil.example`), plain `http`, `//`-style links, `javascript:` and missing values.
  - **The route itself:** `https://evil.example/` becomes `https://bilko.run`, and `https://bilko.run/projects/git-viewer/?u=octocat` is kept. git-viewer only sends same-site return links, so its planned "Manage billing" button still works.
- **Checks:** the new tests and the existing checkout tests pass (16/16). `pnpm typecheck` fails with 5 errors, all in `server/routes/project-catalog.ts`, which this change doesn't touch; that file was last changed in commit `bc68345`.

**Working-tree side effect:** my first push was rejected because `main` had moved on, so I re-synced. Git set aside the other sessions' uncommitted changes and couldn't put them all back on its own. I restored them by hand, but only into files that nobody had changed since, so no live edit was overwritten. One file wasn't restored: `session-manager-operations/scheduler/state/queue.json`. The scheduler had already written a newer version, so I kept that one. A full backup of the set-aside changes is still in the stash list as `stash@{0}` (labelled `autostash`); you can drop it once you've confirmed nothing is missing.
