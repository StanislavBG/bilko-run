# Launch Kit: all purchase CTAs start checkout

Sibling repo: `~/Projects/Bilko-Launch-Kit` (private), commit `d6e714a`.

## Change
- `site/index.html`: header pill, hero `#buy`, pricing-card button and final CTA all carry `data-buy`. The two `#top` hrefs became `#pricing` (no-JS fallback). Logo and nav links are unchanged.
- `site/src/buy.ts`: one handler on every `[data-buy]`. It calls preventDefault, POSTs `/api/web-products/launch-kit/checkout` with `{}`, then `location.assign(url)`. A module-level `busy` flag allows one request at a time. While pending the clicked CTA reads "Opening checkout…" and all CTAs are disabled (`disabled` on buttons, `aria-disabled` on links). On failure everything is restored and the error shows in a `role=alert` next to the clicked CTA (hero keeps `#buy-error`).
- `site/src/style.css`: one rule so `aria-disabled` links ignore clicks.
- `site/tests/golden.spec.ts`: four per-CTA checkout tests, a data-buy/no-`#top` structure test, and a 503 test on the pricing-card CTA.
- Screenshots in `site/screenshots/` refreshed (1512px and 390px) by `landing.spec.ts`.

## Verification
- Red first: 5 of the new tests failed before the change.
- `pnpm build` and `pnpm test` in `site/`: 19 passed.
- `find site/dist -name '*.zip' -o -name SKILL.md` printed nothing. `site/dist` is gitignored in the sibling, so it is rebuilt and not committed.
