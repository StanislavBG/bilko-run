# Validation sweep: credits-minor-followups

Base: 9c9548b9 (Base line in PRD). Commit for the PRD: 2e2ae039 (3 files, +5/-3: CLAUDE.md, docs/host-contract.md, src/pages/PricingPage.tsx).

## credits-minor-followups — VERIFIED

- AC1 PricingPage: `src/pages/PricingPage.tsx:178-179` adds `409 && error === 'unavailable'` -> 'Not on sale yet.'; `daily_cap` (176) and generic slot-taken 409 (180-181) unchanged. Server emits it: `server/routes/menu-orders.ts:94-95`.
- AC2 contract: `docs/host-contract.md:286` lists `409 { error: 'unavailable' }` (item not on sale yet); `:315` lists `unavailable` among order_menu_item errors.
- AC3 CLAUDE.md: line 44 names the prepaid Bilko Credits wallet, $3/$5/$10 top-ups, PPP bonus credits, micro-services menu, PageRoast token bundles, legacy tokens first then wallet credit at $1 a call. `server/services/tokens.ts:38` confirms wallet fallback at 100 cents per token.
- AC4 gate: `timeout 500 pnpm typecheck` (tsc client, server, scripts) produced no errors; exit 0.

Review of the diff (5 lines, text and one branch): no input handling, secrets or path issues; no duplicated helper.

## Findings

- Critical: none.
- Important: none.
- Minor: `src/pages/PricingPage.tsx:179` message ends with a period while the PRD wording is 'Not on sale yet'. Cosmetic.
