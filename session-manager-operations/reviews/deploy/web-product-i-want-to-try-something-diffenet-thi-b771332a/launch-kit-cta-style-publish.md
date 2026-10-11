# Launch Kit CTA style — publish and live verification

Time: 2026-10-11 3:18 PM PDT

- Sibling commit published: `ff824e7` (feat(site): one consistent buy button across all four CTAs)
- Publish SHA (bilko-run origin/main): `8773d87149b4aa180858e56f6eb521652d578372`
- Live manifest gitSha: `ff824e7` (matched on poll 5 of 20; the earlier 4 polls still showed `d6e714a`)
- Publish gates: manifest=pass, budget=pass, golden=pass, a11y=pass, audit=pass (no bypass)

## Checks

| Check | Result |
| --- | --- |
| No *.zip or SKILL.md under site/dist | PASS |
| publish_static_project, all gates, no bypass | PASS |
| Live manifest gitSha == ff824e7 | PASS |
| 1512px: 4 `[data-buy]`, class `btn`, no `pill`, identical bg/color/font-family/font-weight/border-radius | PASS |
| 390px: same | PASS |
| Click x4 (fresh page each, stubbed checkout + analytics): one POST to /api/web-products/launch-kit/checkout, lands on stub Stripe URL | PASS |

Shared computed style: bg `rgb(253, 227, 81)`, color `rgba(0, 0, 0, 0.82)`, font `"Funnel Display", system-ui, sans-serif`, weight 700, radius `30% / 200%`.
Note: the first button (nav) also carries `btn-sm` (a size modifier); the five compared properties are identical.

No real Stripe session was created; checkout POST and /api/analytics/** were stubbed in-browser.

Screenshots: `/tmp/lk-style/buy-1512-{0..3}.png`, `/tmp/lk-style/buy-390-{0..3}.png` (script: `/tmp/lk-style/check.mjs`)

BUTTONS: PASS
