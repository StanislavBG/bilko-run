# Launch Kit CTA style unification

- Sibling repo: `~/Projects/Bilko-Launch-Kit` (private, not pushed), commit `ff824e7`
- All four `[data-buy]` elements now use `.btn` (header `btn btn-sm`, label `Get it — $9`; hero/pricing/final in `.btn-wrapper` with measuring frame, label `Get the Launch Kit — $9`). No `.pill` on any buy button.
- `.price-card .btn` no longer inverts: yellow fill, 2px `#111` outline, frame dots/lines `#111` on the yellow card.
- New test `all four buy buttons share one look` (computed bg, color, font-family/weight, radius equal; hero/pricing/final font-size and height within 1px). Red before the change (header still `.pill`), green after.
- Tests: `pnpm build` ok; `pnpm test` 20 passed (incl. per-CTA checkout tests). No horizontal overflow at 1512px or 390px; header button 107x36 fits the bar at 390px.
- Screenshots: `site/screenshots/cta-{1512,390}-{header,hero,pricing,final}-{idle,hover}.png` plus refreshed hero/full shots, reviewed.
- `site/dist/` rebuilt (no .zip, no SKILL.md). It is gitignored in the sibling and was never tracked, so it is not part of commit `ff824e7`.
