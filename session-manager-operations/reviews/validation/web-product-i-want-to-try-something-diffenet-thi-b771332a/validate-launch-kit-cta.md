# Validation: Launch Kit CTA checkout (PRDs 1267, 1268)

Base: 6b4d8373d17f40a9d4c044c74781b4ca07a74f07. Validated 2026-10-11 (PDT). PRD files found in `prds-archived/`.

## launch-kit-cta-checkout — VERIFIED
- 4 CTAs carry `data-buy`: `site/index.html:20,34,157,191`. No purchase CTA links to `#top`; logo (`:16`) and nav links (`:18`) stay plain scroll links.
- `site/src/buy.ts`: one handler bound to every `[data-buy]`; preventDefault, POST `{}` to `/api/web-products/launch-kit/checkout`, `location.assign(url)`; module-level `busy` flag.
- Pending state: "Opening checkout…" on the clicked CTA, all CTAs disabled / `aria-disabled` (`buy.ts` `setDisabled`); failure restores all; per-CTA `role=alert` via `errorFor`, hero keeps `#buy-error`.
- Tests: `tests/golden.spec.ts:131-160` (structure, 4 per-CTA checkout tests, pricing-card 503 test).
- Gate re-run: `pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site build` exit 0 (emit-manifest d6e714a); `pnpm ... test` 19 passed.
- `find site/dist -name '*.zip' -o -name SKILL.md`: empty. Sibling commit `d6e714a` includes refreshed screenshots; Bilko record `reviews/deploy/.../launch-kit-cta-checkout.md` exists with SHA and test summary.
- Visual parity: screenshots were committed; I did not pixel-compare them.

## launch-kit-cta-publish — VERIFIED
- Live `manifest.json` gitSha = `d6e714a` (curl just now), builtAt 2026-10-11T20:25:34Z.
- Own headless Chromium run (`/tmp/lk-val/check.mjs`, checkout POST and `/api/analytics/**` stubbed, Stripe URL stubbed): 4 `[data-buy]` found; each CTA clicked in a fresh page sent exactly 1 POST and reached the stub URL (CTA 0-3 all PASS).
- Anchors with text starting "Get" and href `#top`: 0.
- Record `reviews/deploy/.../launch-kit-cta-publish.md` has publish SHA 6ceddc8, gates (none bypassed), per-CTA PASS, `CTA: PASS`.

## Plan-wide: no paid files — PASS
- `git ls-files | grep -E '\.zip$'`: none. `SKILL.md` tracked only at `.claude/skills/blog-from-git/` and `.claude/skills/blog-video/` (Bilko's own tooling, not the product). `public/projects/launch-kit/` contains only index.html, thanks/index.html, manifest.json, 4 assets; no zip or SKILL.md. No promo/coupon string in `shared/web-products.ts` or the published folder.

## Findings
- Critical: none.
- Important: none.
- Minor: sibling `Bilko-Launch-Kit` working tree has uncommitted regenerated screenshots (`site/screenshots/desktop-1512-full.png`, `desktop-1512-hero.png`, `mobile-390-full.png`); `landing.spec.ts` rewrites them on every test run. Also the untracked `site/scripts/live-purchase.mjs` (pre-existing, left alone per PRD).
- Minor: `buy.ts` keeps `busy` true after a successful `location.assign` (intentional; a bfcache back-navigation could leave CTAs disabled). Not reproduced.
- Code/security self-review of the diff (`buy.ts`, `index.html`, `style.css`, `golden.spec.ts`): no unsafe input handling (error text set via `textContent`), no secrets, no duplicated helpers.
