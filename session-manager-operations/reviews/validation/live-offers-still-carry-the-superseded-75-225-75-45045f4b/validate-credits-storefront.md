# Validation: credits storefront (pricing-wallet-ui, docs-wallet-contract)

Base 42edf919; commits 95937b5e (pricing), 3b033006 (docs). Final HEAD 3537e27c.

## pricing-wallet-ui — VERIFIED
- /api/menu drives topups and items: src/pages/PricingPage.tsx:12,93,~120 (`menu?.topups`, `menu?.items`). Only dollar literals left on the page: `$0` (line 332) plus subscription copy `$5` (332-372 tiers/Git Viewer); no price above $10, no `$1/credit` (grep clean). Copy "Credits never expire; some countries get bonus credits" at :90, :316.
- Balance via useWallet/getToken (:19-30); top-up POST `/wallet/topup` with `{cents}` then `window.location.href = data.url` (:55-65); signed out uses Clerk `SignInButton` (:99); `?topup=success` handled (:38-47).
- Intake form POSTs `/menu/<id>/order` (:157); 402, 409 daily_cap ("Today's slots are full"), 201 "arrives by email within 48 hours" (:172-178).
- Live call: slots from `/services/human-for-hire/slots` (:140), Pacific time formatting (:286), books through the same order route with `startMs`; Kit/download CTA "Buy with credits" (:195).
- Gate `pnpm typecheck`: clean (re-run, no errors).

## docs-wallet-contract — VERIFIED
- docs/host-contract.md:281-288,296-315 document /api/wallet, /api/wallet/topup, /buy/credits-3|5|10, /api/menu, /api/menu/:itemId/order, /api/menu/live-call/order, PPP bonus rule (:299), all 7 MCP tools; ladder replaced by $9 live call (:296, :301).
- CLAUDE.md diff adds the six wallet/menu files to Backend Patterns and rewrites the Human For Hire bullet (no ladder entries).
- server/routes/agent-storefront.ts exports MCP_TOOLS (7 tools), llms.txt MCP line states which need bkk_, new /api/menu line.
- tests/agent-storefront.test.ts compares llms.txt tool names with `listTools()` from buildCatalogMcpServer (not a hard-coded copy). Passed.

## Plan-level
- `CI=1 pnpm test`: 160 files passed, 2 skipped; 1747 tests passed, 20 skipped (includes tests/offer-price-ceiling.test.ts and agent-storefront). 
- `pnpm typecheck`: all three tsc projects clean.
- AGENT_OFFERS ceiling: guarded by tests/offer-price-ceiling.test.ts (passes); wallet offers are $3/$5/$10 from WALLET_TOPUP_CENTS (shared/agent-offers.ts:112).
- Combined diff reviewed by hand (5 files, +371/-114); /code-review and /security-review not run, self-review: auth tokens sent only as Bearer to same-origin API, item id URL-encoded, no secrets, no new helper duplication. Not done: visual Playwright check of /pricing (not reproducible here).

## Findings
- Critical: none. Important: none.
- Minor: the PRD-required screenshot description is not in the archived record, so the visual state of /pricing is unverified by this review.
