# Transcript — stripe-price-gitviewer-created-price-1updejr6w0v-2ef42431

## User — 2026-10-11T04:29:45.865Z

This session is INBOUND FEEDBACK from another project: git-viewer (/home/bilko/Projects/git-viewer, session how-can-we-turn-this-project-into-saas-the-git-v-2b6e3202). It was raised while working on: How can we turn this project into SAAS?  The Git-Viewer is nice, but how can we make it accessible to people without knowldge. Esentually, ppl that have git-account and are like "yo, I want ot see my projects" like that in a the Git-Viewer;   What options or appach for the project should we take?. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: STRIPE_PRICE_GITVIEWER created: price_1UPDEjR6w0VtQRLT1SKNJ3T1 ($5/mo, live)

## Why
Addendum to the proposal 'git-viewer hosted portfolios: /api/git-viewer/u/:login + $5/mo tier on bilko.run' (epic git-viewer-hosted-portfolios-api-git-viewer-u-lo-94360936). The Stripe price that proposal needs now exists in the live bilko.run Stripe account, so the paid-tier step is no longer blocked on Stripe setup.

## Acceptance criteria
- [ ] Render env var STRIPE_PRICE_GITVIEWER=price_1UPDEjR6w0VtQRLT1SKNJ3T1 is set on the bilko.run service
- [ ] The git-viewer hosted-portfolios implementation maps this price to product key git_viewer (entryForPriceId / priceToPlanTier) so webhook attribution grants the paid tier

## Details
Stripe account: acct_1SbkmmR6w0VtQRLT (the same account as PageRoast Credits / Buy me a coffee), livemode. Product prod_VQ3LWcamPHLWbg 'Git Viewer Portfolio', metadata {product_key: git_viewer, tier: paid, project_limit: 12}, tax_code txcd_10000000. Default price price_1UPDEjR6w0VtQRLT1SKNJ3T1: USD 500, recurring monthly, licensed. Verified by reading the price back via the Stripe API. Fold this into the hosted-portfolios epic rather than treating it as separate work.

## Agent — 2026-10-11T04:36:32.910Z

The report checks out, and the price is now built into the code. I committed it as `1ae7d75` on this epic branch. I have not pushed it to `origin/main`.

**Checking the report against the code:** The price mapping it asks for already exists, from the earlier hosted-portfolios work (`51e262a`, `server/services/stripe.ts:80`). That mapping makes `priceToPlanTier` return `git_viewer` for this price, and `entryForPriceId` link it to product key `git_viewer`. A Git Viewer subscription gets its own tier, so $5/month does not unlock the paid AI tools. One gap: the mapping only worked when `STRIPE_PRICE_GITVIEWER` was set. With no env var, a $5 payment would have been filed as a "pro" plan and unlocked every paid tool.

**What I changed:**
- **Price stored in code:** `price_1UPDEjR6w0VtQRLT1SKNJ3T1` is now the default price for `git_viewer` in `shared/product-catalog.ts`. This follows the same pattern as the "Buy me a coffee" price.
- **Fallback when the env var is missing:** both `priceToPlanTier` and the checkout endpoint (`server/routes/stripe.ts:85`) now use that price if `STRIPE_PRICE_GITVIEWER` isn't set. The Render env var is now optional; setting it still overrides the default.
- **New test:** with the env var unset, the live price maps to the `git_viewer` tier and product key.
- Typecheck is clean and all 999 tests pass.

**Not done:**
- **Render env var:** I couldn't set it because this machine has no Render CLI or API access. Once this is deployed, the code default covers it.
- **Not pushed:** pushing to `main` would also ship `51e262a`, which the earlier session deliberately held back. It would make a live $5/month checkout available right away. But the portfolio API still answers `503 unavailable` until `@bilkobibitkov/git-viewer` is published and installed. People could pay for a portfolio that doesn't work yet.
