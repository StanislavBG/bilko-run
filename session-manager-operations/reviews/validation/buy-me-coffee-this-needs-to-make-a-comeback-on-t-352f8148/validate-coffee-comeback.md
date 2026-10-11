# Validation: Buy me a coffee comeback (PRDs 1232-1237)

Base: 37ffe61deeb285e7e79113eecfc178c2035b843e. Validated HEAD: 22f0f3d. Date: 2026-10-10 (America/Los_Angeles). PRD files found in `prds-archived/`.

Environment note: the job worktree has no `node_modules`. I symlinked the main checkout's `node_modules` for the gates and removed the symlink afterwards. That install lacks `@resvg/resvg-js`, so the failures listed below are environmental and not caused by the coffee changes.

## coffee-stripe-defaults (1232) — VERIFIED
- `shared/product-catalog.ts:39` adds `defaultPriceId?`. `:52` sets `price_1U2LEcR6w0VtQRLThguPtRCI`. `:56` exports `COFFEE_PAYMENT_LINK_DEFAULT`. `:72` matches `(env[e.envVar] || e.defaultPriceId) === priceId`.
- `server/routes/stripe.ts:399` redirects to `env || COFFEE_PAYMENT_LINK_DEFAULT` with a 302. The price branch (`:404`) and the fallback remain.
- `server/routes/stripe.ts:346` resolves the product via `entryForPriceId`. `:371-375` adds the coffee thank-you with `escHtml(email)` and a link to https://bilko.run/.
- `tests/coffee-checkout.test.ts` was changed (+45/-). Ran it together with the 3 related test files: 4 files, 89 tests, all pass.
- Gate: `pnpm vitest run` gives 951 passed and 5 skipped, with 3 files failing (`og-image`, `og-routes`, `spa-fallback-notfound-crash`). All three fail on the missing `@resvg/resvg-js` (`spa-fallback` fails because its `pnpm build` subprocess does not complete). `pnpm typecheck` fails only with `server/og-image.ts(4,23) TS2307 @resvg/resvg-js`. No coffee-related errors. The gate could not be run clean in this environment, so the evidence is the targeted tests plus the lack of coffee-related errors.

## coffee-stripe-live-config (1233) — VERIFIED
- Live `stripe products retrieve prod_V2Q4ego2oijqo4 --live`: name "Buy me a coffee", description "Buy Bilko a coffee — keeps the free tools on bilko.run (including Session Manager) running.", active.
- Live `stripe payment_links retrieve plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live`: active=true, after_completion.type=redirect, url `https://bilko.run/checkout/success?session_id={CHECKOUT_SESSION_ID}`.
- `list_line_items`: price_1U2LEcR6w0VtQRLThguPtRCI, amount_total 500, usd, quantity 1.
- Record `reviews/deploy/<epic>/stripe-live-config.md` is committed (36 lines).

## coffee-cta-main-site (1234) — VERIFIED
- `src/components/Layout.tsx:170`: `<a href="/coffee">Buy me a coffee ☕ →</a>`, a plain anchor.
- `src/pages/HomePage.tsx:43-49`: `<a href="/coffee" className="pf-btn ghost">` with inline style only. No new tab, no onClick. `grep buy.stripe.com src` finds nothing.
- Gate: `pnpm build` compiled and produced `dist/assets/index-B3zi0qGr.js`, whose hash is identical to the live bundle. Typecheck and full vitest are as above (environment-limited).

## coffee-cta-session-manager (1235) — VERIFIED
- `copy.ts:26-27` adds `coffeeLink` and `coffeeHref`.
- `Header.tsx:32` renders the plain anchor inside `.smlp-header__right`, before the manual link, with no onClick.
- CSS at `session-manager-landing.css:228,234` (base and hover) and `:1536` (reflow rule). The 375px visual fit was not browser-verified.
- `tests/session-manager-landing.test.ts` passes unchanged.

## coffee-docs (1236) — VERIFIED
- `.env.example:43-46` says the vars are optional overrides, names the prod, price and link, and has no "temporarily unavailable" text. `CLAUDE.md:138` is the one-line tip jar bullet. The diff for each file is limited to those lines.

## coffee-publish-live-check (1237) — VERIFIED
- Independent re-run: `curl https://bilko.run/coffee` returns `302 https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d`. `curl -sL` on the Stripe link returns 200.
- Live `index-B3zi0qGr.js` contains the footer string and 2× `pf-btn ghost`. Live `hooks-CodTRcb5.js` contains `smlp-header__coffee`.
- The publish record exists, and the commits of 1232/1234/1235/1236 are in HEAD (git log).

## Findings
### Critical
- none
### Important
- none
### Minor
- `tests/open-core-positioning.test.ts` and `tests/session-manager-urls.test.ts` were edited, though they are outside the `# Files` lists of 1232 and 1235. They are small, justified exemptions, since the tip link would otherwise trip the "no buy UI" and "no stale manual href" guards. The 1235 PRD said the landing test would pass unchanged. It does, but two sibling tests had to change.
- A zero-byte untracked file named `<path>` exists in the worktree root, created at 19:25 PDT by the test run or the harness. It is not committed here.
- `server/routes/stripe.ts:348` branch order: the coffee thank-you only appears when the price resolves via the catalog. That is correct for the default price.
- Security self-review: no secrets are committed (price and link ids are public), the email is escaped via `escHtml`, and the redirect target is a constant or an operator-set env value. No issues.
