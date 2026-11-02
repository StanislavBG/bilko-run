# Ship record: menu retirement

Shipped 2026-11-01, push at about 7:23 PM PST, live by 7:25 PM PST (America/Los_Angeles).

Pushed SHA: 39278bb67135e41dd5f48441dd861144e219023e (origin main, StanislavBG/bilko-run, no force; origin was 08ceed8b).

## Commits pushed (subjects)
feat(menu): take the retired service items off the offers
feat(menu): remove the retired service items and the draft queue
feat(menu): keep free hours and /bilko straight in the reports
feat(menu): /pricing leads with the free hour
feat(menu): sell one Bilko hour at $100
feat(menu): admin Bookings tab
feat(menu): confirm paid hours to the buyer and to Bilko
feat(menu): describe the free hour and the Bilko hour in the docs
fix(menu): compare MCP list_offers in the offer parity test
fix(menu): recount tests in CLAUDE.md

## CLAUDE.md conflict resolution
Cherry-picking "describe the free hour and the Bilko hour in the docs" conflicted only in CLAUDE.md, on the single count line under "## Testing" (origin: 169 files, 1912 tests; plan: 168 files, 1873 tests). Kept the commit's side. After the full run the line was recounted to 168 files, 1860 tests (1845 pass, 15 skipped) in the extra commit above.

## Checks
- Menu orders before push (/api/admin/menu-orders): PASS, 0 orders
- pnpm test on pushed tree: PASS (166 files passed, 2 skipped; 1845 passed, 15 skipped), run twice
- pnpm typecheck: PASS
- pnpm build: PASS
- Live /api/offers ids and prices: PASS (same nine ids and prices; bilko-hour is listed first, not last)
- /llms.txt "## Buy" lines: PASS
- MCP list_offers: PASS (same ids, amounts, prices)
- /api/menu lists only agent-factory-kit: PASS
- /buy/bilko-hour?dryRun=1 says checkout is ready: PASS
- /buy/ask-bilko: PASS (404)
- /api/projects lists bilko-hour under human-for-hire: PASS
- Browser /pricing 1280x720 and 390x844: PASS ("Work with Bilko" shown, "/ year" on Git Viewer, none of the six retired names, no sideways scroll)
  - /tmp/ship-menu-retired-live/pricing-1280x720.png
  - /tmp/ship-menu-retired-live/pricing-390x844.png

SHIP: PASS
