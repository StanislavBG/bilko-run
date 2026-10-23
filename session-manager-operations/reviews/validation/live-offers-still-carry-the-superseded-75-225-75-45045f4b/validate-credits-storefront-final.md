# Validation: credits storefront final wave

Base 42edf91 (the plan's base SHA); HEAD 5fd14616. Commits: 95937b5e (1532), 3b033006 (1533), c3e7b965 (1535).
Full `CI=1 pnpm test`: 160 files passed, 1752 tests passed, 20 skipped. `pnpm typecheck`: exit 0.
Price ceiling: `shared/bilko-menu.ts` menu prices 50/100/100/200/300/300/900 cents, top-ups 300/500/1000. `tests/offer-price-ceiling.test.ts` (in the suite) asserts AGENT_OFFERS and one-time web products are at or below the ceiling. Nothing above $10.

## pricing-wallet-ui — VERIFIED
- Menu/top-ups come from `GET /api/menu` (`MenuPayload`, src/pages/PricingPage.tsx:12). The only `$` literals in the page are copy, with no price figures. "Credits never expire; some countries get bonus credits" at :90 and :316.
- Balance via `useWallet` (:19-30), `POST ${API_BASE}/wallet/topup` (:55), `?topup=success` handling and balance refresh (:38-47).
- Intake form POSTs `/menu/<id>/order` (:157). 402 prompts a top-up (:174), 409 daily_cap says "Today's slots are full" (:176), 201 says "arrives by email within 48 hours" (:172).
- Live call: slots from `/services/human-for-hire/slots` (:140), shown in `America/Los_Angeles` (:286). Booking goes through the same order path with item id `live-call`. Download items show "Buy with credits" (:195).
- `$1/credit`, `$75`, `$225` and `$750` no longer appear on the page; FAQ updated (:373). Typecheck passes.
- Not re-run: the Playwright screenshot, which the PRD asked for in the run report only.

## docs-wallet-contract — VERIFIED
- docs/host-contract.md:281-288 documents every route listed, including `/buy/credits-3|5|10`; :296-302 covers the wallet, PPP bonus, menu and live call; :313-316 lists the MCP tools. The ladder text is only mentioned as superseded history.
- CLAUDE.md:126 lists wallet, menu-orders, menu-drafts and admin-menu-orders. The Human For Hire bullet (:152) names only `live-call` and the slot entry.
- `MCP_TOOLS` in server/routes/agent-storefront.ts lists all 7 tools; the llms.txt line says which need a `bkk_` key, and a new Menu line exists. tests/agent-storefront.test.ts:43 compares it to `client.listTools()` from the real server.
- Gate: agent-storefront and offer-price-ceiling tests pass (in the full run); typecheck passes.

## menu-kit-deliverable-guard — VERIFIED
- server/services/menu-orders.ts: `isMenuItemOnSale` uses `isDeliverable(webProductBySlug(...))`. `placeMenuOrder` returns `{status:'unavailable'}` after intake validation and before any debit or row insert.
- Route maps it to 409 `{error:'unavailable'}` (server/routes/menu-orders.ts:94). MCP `order_menu_item` returns an isError "not on sale yet" (project-catalog.ts:200).
- `GET /api/menu` and `list_menu` both use `availableMenuPayload()`, which filters non-deliverable downloads.
- Tests cover unavailable / not listed / stored → ok in menu-orders.test.ts:77, menu-order-routes.test.ts:47 and mcp-menu-tools.test.ts:56. All pass.

## Findings
Critical: none.
Important: none.
Minor:
- src/pages/PricingPage.tsx:178: any non-daily_cap 409 shows "That slot was just taken", so the new `unavailable` 409 on the Kit row would show a wrong message. It is unreachable while the menu endpoint hides the item, apart from a stale 5-minute cache.
- docs/host-contract.md:286 omits `409 unavailable` from the order route's error list, and :315 omits `unavailable` from the MCP error list.
- CLAUDE.md:44 still says "$1/credit or $5/7 credits". It is outside these PRDs' file lists.
- The code-review and security-review skills were not run as separate agents; I self-reviewed the diff. No secrets, no string-built SQL. Auth is unchanged. The new guard only reduces what can be sold.
