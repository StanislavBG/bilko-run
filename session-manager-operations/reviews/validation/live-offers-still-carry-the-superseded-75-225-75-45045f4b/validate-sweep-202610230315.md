# Validation sweep 202610230315

Base: fb35fc7bf6cc5f99c6f2a99f4ce16c9db552d53f (HEAD 5edca80f). 31 files, +2131/-71.
Gates re-run in the foreground: one `vitest run` over the union of all PRD gate test files, 18 files / 149 tests passed; `pnpm typecheck` exit 0 (client, server, scripts).
Not re-run: the full `pnpm test` suite from the sync-origin-offer-availability gate. Only its affected test files ran.
Code-review and security-review were self-reviewed on the diff (no injection, secrets or path traversal found; see Findings).

## sync-origin-offer-availability — VERIFIED
- `git merge-base --is-ancestor origin/main HEAD` -> ancestor; merge commit 2df9da16/780e5acc present.
- server/services/offer-availability.ts, tests/offer-availability.test.ts (174 lines) and agent-buy.test.ts pass in the gate run.

## menu-refund-order-safety — VERIFIED
- server/services/menu-orders.ts:150-156 refundOrder: refundWallet (ref `refund:<ref>`, idempotent) then `transition(['queued','drafted'] -> refunded)`; returns null for other states.
- placeMenuOrder: insertOrder (menu-orders.ts ~L95) precedes recordOrder (~L108); on failure refundDebit + transition to refunded, then rethrow.
- tests/menu-orders.test.ts passed.

## menu-order-routes — VERIFIED
- server/routes/menu-orders.ts: public max-age=300 (L28), 429 limit (L34), bodyLimit (L32), private no-store (L45, 62, 102), top-up URL (L9).
- server/index.ts:192-193 registerWalletRoutes then registerMenuOrderRoutes. tests/menu-order-routes.test.ts passed.

## menu-drafts — VERIFIED
- server/services/menu-drafts.ts: NAME_RE (L7), 10 s timeout (L8, L79), 20 KB cap (L9), api.github.com only (L79). tests/menu-drafts.test.ts passed.

## offers-credits-menu — VERIFIED
- shared/agent-offers.ts, agent-buy.ts and project-catalog.ts L58 (howToBuy for credits). agent-offers/agent-buy/offer-availability/project-catalog/agent-storefront/offer-jsonld tests passed.

## live-call-booking — VERIFIED
- shared/service-slots.ts:43 durationMinutes 30. menu-orders.ts bookLiveCall (L166+) checks open slots before charging. tests/menu-live-call.test.ts (5 tests) and service-slot/booking tests passed.

## admin-menu-orders-api — VERIFIED
- server/routes/admin-menu-orders.ts: 401/403 guard (L44), draft 502 (L96), approve escapes HTML (L117), 502 when not sent (L120), 409 on second refund (L134). server/index.ts:195 registers. tests passed (6).

## menu-mcp-tools — VERIFIED
- server/routes/project-catalog.ts L142 list_menu, L154 wallet_balance, L169 order_menu_item, ORDER_LIMIT 20 (L65, L179). tests/mcp-menu-tools.test.ts passed (6).

## offer-price-ceiling-test — VERIFIED
- tests/offer-price-ceiling.test.ts cites D-2026-10-20-14 (L26); 4 tests passed.

## admin-orders-tab — VERIFIED
- src/pages/AdminPage.tsx:15 TABS has 'orders', L103 renders MenuOrdersTab. MenuOrdersTab.tsx: Approve disabled when empty (L156), confirm() before refund (L168), no dangerouslySetInnerHTML. Typecheck only gate; no UI run (per PRD).

## Findings
### Critical
None.
### Important
None.
### Minor
1. tests/admin-menu-orders.test.ts and the UI have no browser check (documented in the PRD).
2. The MCP 20/min per-key limit (project-catalog.ts L179) has no dedicated test; I did not confirm one exists.
3. The full `pnpm test` suite was not re-run, only the PRD gate test files.
