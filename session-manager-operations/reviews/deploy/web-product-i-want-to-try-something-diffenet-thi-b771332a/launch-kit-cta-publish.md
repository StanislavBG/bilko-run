# Launch Kit CTA publish

Time: 2026-10-11 1:28 PM PDT

- Sibling commit: d6e714a (feat(site): all four purchase CTAs start checkout via data-buy)
- No-paid-files check on site/dist (*.zip, SKILL.md): clean
- Publish gates: manifest=pass, budget=pass, golden=pass, a11y=pass, audit=pass (none bypassed)
- Publish SHA (bilko-host status, publish checkout == origin/main): 6ceddc8b6273bac729dc36f1dd54f217110a3ba7
- Live manifest.json gitSha: d6e714a (matched on poll 5 of 20; builtAt 2026-10-11T20:25:34Z)

## Live CTA check (headless Chromium, checkout POST and /api/analytics/** stubbed; no real Stripe session)

| CTA | POSTs to checkout | Navigated to stub URL | Result |
|---|---|---|---|
| [data-buy] #1 | 1 | yes | PASS |
| [data-buy] #2 | 1 | yes | PASS |
| [data-buy] #3 | 1 | yes | PASS |
| [data-buy] #4 | 1 | yes | PASS |

- [data-buy] element count: 4
- Elements with text starting "Get" linking to #top: none (PASS)

CTA: PASS
