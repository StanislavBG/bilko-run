# Ship: menu retired

Time: 2026-11-01 7:17 PM PST. Nothing was pushed to origin.

## Pre-push checks
- Validation record (validate-menu-retired.md): every PRD VERIFIED, but it lists one **Important** finding: `tests/offer-price-ceiling.test.ts:95-110` does not cover MCP `list_offers` in the same test as /llms.txt, /api/offers and JSON-LD. No later commit changes that test, so the finding is still open. FAIL.
- Live `GET /api/admin/menu-orders`: `{"orders":[],"asyncToday":0,"asyncCap":6}`. No queued or drafted orders. PASS.

## Not run (the first check failed)
- Cherry-pick, pnpm test / typecheck / build, push, live /api/offers, /llms.txt, MCP, /buy, /pricing and screenshots. No /tmp screenshots exist.

## Commits that were ready to ship (origin/main..HEAD, feat/fix(menu):)
9e94bdf2 take the retired service items off the offers
d598c7ab remove the retired service items and the draft queue
a395d789 keep free hours and /bilko straight in the reports
3457e9e2 /pricing leads with the free hour
08e74c95 sell one Bilko hour at $100
d9d451f2 admin Bookings tab
b1ff6e45 confirm paid hours to the buyer and to Bilko
68c3d2d1 describe the free hour and the Bilko hour in the docs

Pushed SHA: none.

To unblock: add the MCP `list_offers` comparison to the parity test (or have the owner accept the finding), then re-run this ship.

SHIP: FAIL
