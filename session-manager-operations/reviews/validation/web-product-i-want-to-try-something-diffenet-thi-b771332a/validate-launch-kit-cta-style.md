# Validation: Launch Kit CTA style plan

Base: 1f71c8c7 (Bilko). Real work is in the sibling repo /home/bilko/Projects/Bilko-Launch-Kit, commit ff824e7 ("one consistent buy button across all four CTAs").
PRD files found in prds-archived/ (1270, 1271).

## launch-kit-cta-style — VERIFIED
- index.html:20,34,157,192: all four [data-buy] are `btn` (header `btn btn-sm`); no `pill` in index.html. Hero, pricing and final sit in .btn-wrapper with 4 dots + 4 lines.
- Labels: header "Get it — $9"; other three "Get the Launch Kit — $9".
- style.css:80 `.btn-sm` is padding/font-size only (14px); :142 `.price-card .btn { outline: 2px solid #111 }` — fill no longer inverted.
- landing.spec.ts "all four buy buttons share one look": asserts bg, color, family, weight, radius equal; size/height within 1px for the 3 full buttons; labels.
- Screenshots: 16 cta-{1512,390}-{header,hero,pricing,final}-{idle,hover}.png committed in ff824e7. I viewed cta-390-header-idle (fits bar), cta-1512-pricing-hover, cta-1512-final-idle: consistent yellow lens buttons.
- Gate re-run: `pnpm --dir …/site build` exit 0; `pnpm --dir …/site test` 20/20 passed. dist has 0 .zip/SKILL.md.
- Record launch-kit-cta-style.md exists in Bilko and cites ff824e7.

## launch-kit-cta-style-publish — VERIFIED
- Live manifest.json gitSha = ff824e7 (matches sibling commit).
- Headless Chromium against https://bilko.run/projects/launch-kit/ (analytics + checkout POST stubbed in-browser, Stripe URL fulfilled locally; no real session): at 1512px and 390px, 4 [data-buy], identical computed bg rgb(253,227,81), color rgba(0,0,0,.82), font "Funnel Display", weight 700, radius 30% / 200%; none `pill`.
- Click check, fresh page per button (0-3): each sent exactly 1 checkout POST and landed on https://checkout.stripe.com/c/pay/cs_test_stub.
- Publish record has "BUTTONS: PASS".

## Findings
### Critical
- none
### Important
- none
### Minor
- cta-1512-pricing-hover.png: hovered pricing button shows a white fill (the .btn hover state) rather than yellow; consistent with the hero hover design, noted only.
- Sibling working tree has uncommitted re-taken desktop-1512-full.png / mobile-390-full.png (test run rewrites them) and untracked site/scripts/live-purchase.mjs (left alone per PRD). site/dist is gitignored, so "dist committed" in the PRD is satisfied only by the build + published bundle.
- Review used self-review of the diff (index.html, style.css, landing.spec.ts); no secrets, inputs or paths touched.
