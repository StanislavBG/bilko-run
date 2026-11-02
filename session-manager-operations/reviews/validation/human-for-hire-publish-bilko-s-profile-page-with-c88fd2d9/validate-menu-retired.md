# Validation: menu-retirement plan

Base: 8158c59894ac447c292dc6c5d58c17d6594ceb44. HEAD at validation: 68c3d2d1. Commits 9e94bdf2, d598c7ab, 3457e9e2, 08e74c95, b1ff6e45, d9d451f2, 68c3d2d1 (+ a395d789 hire-report-counts) each landed with the required subject.

Gates re-run (foreground): `pnpm test` → 166 files passed, 2 skipped; 1858 passed, 15 skipped. `pnpm typecheck` → no errors. `pnpm identity:scan` → "no tracked file contains a deny-listed identifier". Not run: Playwright e2e (pricing-buttons, bilko-profile).

## retire-menu-offers — VERIFIED
- shared/agent-offers.ts: no MENU_OFFERS / `kind: 'menu'`; `payWith: 'stripe'` (l.33, 138, 144); ids bilko-hour, launch-kit, agent-factory-kit, git-viewer, pageroast-credits-7, pageroast-credit-1, credits-3/5/10 (bilko-hour is added by the later PRD).
- `grep menuInstructions|'menu'` in agent-buy.ts and offer-availability.ts → no hits.
- Wallet text at agent-offers.ts:128-131 matches the spec exactly.
- tests/agent-offers.test.ts:88 and tests/agent-buy.test.ts:104 loop over the six retired ids (absent + 404).

## retire-menu-items — VERIFIED
- shared/bilko-menu.ts exports only WALLET_TOPUP_CENTS, PRODUCT_PRICE_CEILING_CENTS, MenuKind='download', MENU_ITEMS, formatCents, menuPayload, parseMenuIntake; removed constants absent.
- menu-orders.ts: none of bookLiveCall/sendLiveCallEmails/organizerEmail/setDraft/markDelivered/refundOrder present.
- menu-drafts.ts, admin-menu-orders.ts, MenuOrdersTab.tsx and the three tests are gone; grep for their names/registration across server src tests shared scripts e2e → empty. Typecheck is clean, so nothing imports a deleted file.
- Retired-id grep in server/shared/src/tests hits only absence checks (tests/agent-offers, agent-buy, menu-order-routes, menu-orders).

## pricing-free-hour — VERIFIED
- PricingPage.tsx:276-281 'Work with Bilko', exact sentence, Link to /bilko, data-track="pricing-hire", 'Book a free hour'.
- Heading 'Buy with credits' (l.114); MenuEntry kind is 'download' only; no slot/daily-cap code.
- Success text l.157 'Paid from credits. No email is sent. Sign in with this same account on the kit page…' links /projects/launch-kit/agent-factory-kit/ (consistent with hasOrderForEmail entitlement, web-products.ts:519).
- Git Viewer '$5' / '/ year' l.302; server/og-meta.ts has the /pricing entry (l.64); e2e uses 'Buy with credits'.

## bilko-hour-offer — VERIFIED
- shared/web-products.ts: maxQuantity (l.62), bilko-hour entry maxQuantity 40 (l.119), validation 2..100 one-time only (l.256-258).
- adjustable_quantity only when product.maxQuantity is set (server/routes/web-products.ts:189-190).
- webProductSubtotalOk (shared/web-products.ts:199-204) rejects non-integers, non-numbers, ≤0, non-multiples, and >maxQuantity; used by stripe.ts:268 and web-products.ts:119. A webhook therefore cannot record a subtotal that is not a whole number of hours; the record step is skipped unless priceOk (stripe.ts:274). tests/web-products-catalog.test.ts:348 covers 15000, 0, 410000, -10000, undefined, null.
- Offer bilko-hour 10000c, pageUrl /bilko, summary/whatYouGet say "$100 per hour" (agent-offers.ts:43-55). Ceiling test rewritten (tests/offer-price-ceiling.test.ts).

## bilko-hour-after-payment — VERIFIED
- recordOrder returns `(res?.changes ?? 0) > 0` (services/web-products.ts:35).
- stripe.ts:278-296: mail only when `inserted && productKind==='service'`, inside try/catch logging '[stripe_webhook] paid-hour mail failed'; webhook still answers 200. tests/stripe-webhook-web-products.test.ts:180 "mails buyer and Bilko once…, nothing on replay".
- BilkoProfilePage.tsx:10-23 shows both messages in `<p role="status">`.

## admin-bookings-tab — VERIFIED
- BookingsTab.tsx fetches /api/admin/bookings, shows both tiles, Pacific time with zone abbreviation (l.22-23), soonest-first sort (l.43), warning text (l.49), 'No bookings yet.' (l.59). AdminPage.tsx has 'bookings' in TABS (l.15) and renders it with days (l.101).

## retire-menu-docs — VERIFIED (with one gap, see Important)
- agent-storefront.ts:67 describes /api/menu as the Agent Factory Kit; test at tests/agent-storefront.test.ts:56-61 asserts no 'services menu'.
- docs/host-contract.md:305-311 rewritten; grep for services menu / live call / ask-bilko in docs, CLAUDE.md, wallet.ts, db-schema.ts, bilko-menu.ts → empty.
- CLAUDE.md:183 recounted to 168 files / 1873 tests, matching this run.

## Findings
### Critical
- none
### Important
- tests/offer-price-ceiling.test.ts:95-110 builds /llms.txt, /api/offers and JSON-LD, but not MCP list_offers. The criterion says all three agree, including MCP, in one test. MCP list_offers is only checked separately (tests/project-catalog.test.ts:159, tests/offer-availability.test.ts:73). They agree today, but the one-test guarantee is missing.
### Minor
- docs/host-contract.md:310 says the buyer books paid hours via the booking endpoints, while the page text and PRD say Bilko schedules by email. Confirm which is intended.
- Webhook hours use Math.round (stripe.ts:288); safe only because webProductSubtotalOk runs first.
- Playwright specs were not run in this validation.

## Resolution

The Important finding (MCP `list_offers` not compared in the offer parity test) is closed by commit a19dd1ee. `timeout 120 pnpm vitest run tests/offer-price-ceiling.test.ts`: 4 tests passed. Recorded 2026-11-01 7:20 PM PST.
