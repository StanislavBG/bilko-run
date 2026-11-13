# Validation: SST admin-only delist

Base: 3dba65ed. Commits: 9296b1b0 (registry + ledger), 7a580ffc (site chrome). Combined diff touches exactly the 5 expected files; nothing under public/, mcp-host-server/, content/, server/bilko-profile-routes.ts. Self-review (no unsafe input, secrets or paths; copy/data deletions only). No port-3002 listener preexisted.

## delist-sst-from-public-catalog — VERIFIED
- standalone-projects.json: diff removes only `"public": true,` in the SST entry; `listing` intact. Gate node check: ok.
- projectsView: PUBLIC_SLUGS lacks slug, HUB_CARDS has it (tsx check ok); file unchanged.
- blog-ledger.md: only the Due line changed, SST entry removed, order/dates of others kept.
- No tests added; 8 listed vitest files (+ bilko-profile-routes) pass: 136 tests.
- No changes under public/projects/social-signals-trader, mcp-host-server, content/blog.

## drop-sst-from-site-chrome — VERIFIED
- NOW_ITEMS = Academy, signal-builder, New build log (tsx output).
- TICKER_ITEMS: only the SST line removed (portfolio.ts diff); grep -ic of "social signals trader" in both files = 0.
- e2e/site-navigation.spec.ts: imports NOW_ITEMS, uses NOW_ITEMS.length for loop cap, both checks, and the expect; playwright 'bottom bar': 8 passed.
- bilko-profile-routes.ts unchanged; its test passes. `pnpm typecheck` clean.

## Findings
- Critical: none
- Important: none
- Minor: none
