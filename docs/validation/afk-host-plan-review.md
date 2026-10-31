# Agent Factory Kit host plan: validation record

Base: no `Base:` line in the PRD notes, so base taken as `6539aa0b` (last commit before the plan). Commits: b4345a3c, 37346612, 33bdd1e8, 1de5e3bb, 683376ea.

Gate (combined gate from 1502, re-run in foreground): 7 test files, 99 tests passed; `pnpm typecheck` exit 0.

## 1497-afk-catalog: VERIFIED
- WebProduct `includes`/`preview` with doc comments: shared/web-products.ts:55-58.
- `agent-factory-kit` entry (key, env var, $19, limit 20, release/preview null, no defaultPriceId): shared/web-products.ts:123-131; `hfh-factory-setup` gains `includes`: :107.
- validateWebProducts: unknown / self / non-download includes, preview rules, preview on services rejected: shared/web-products.ts:~246-257. `productsIncluding`: :182-187.
- Tests: tests/web-products-catalog.test.ts, `describe('includes and preview')` (pass + fail case per rule, productsIncluding).

## 1498-afk-included-download: VERIFIED
- Download resolves paid order of S or any including product: server/routes/web-products.ts:338-360 (404/402 paths preserved; non-including session test present).
- `/order` returns `included[{slug,name,downloadUrl}]` only for products with `includes`, entries only when released: :378-387.
- account-download entitles via including products: :488-495.
- Tests: tests/web-products-routes.test.ts and tests/web-products-release-account.test.ts, `included downloads` and `account download via an including product`.

## 1499-afk-signin-preview: VERIFIED
- GET /:slug/preview: 401 signed-out, 404 no preview/unstored, zip headers, recordDownload with `<slug>--preview`, null session, via 'preview', `wp-preview:` bucket: server/routes/web-products.ts:516-541.
- Upload `?kind=preview` verifies against `product.preview`, stores under `<slug>--preview`: :451-475. `via` union widened in server/services/web-products.ts:58.
- `previewAvailable`: :242-256.
- Tests: tests/web-products-preview.test.ts (6 tests incl. sha mismatch/match, previewAvailable true/false).

## 1500-afk-setup-confirmation-email: VERIFIED
- Route builds absolute `${PUBLIC_URL||'https://bilko.run'}/api/web-products/<slug>/download?session_id=<id>`, skips unreleased: server/routes/service-bookings.ts:153-158.
- Mailer renders text + escaped HTML, unchanged output when `included` empty: server/services/mailer.ts:91-115.
- Tests: tests/mailer.test.ts (byte-identical, escaping, no owner first name), tests/service-booking-routes.test.ts (omits unreleased).

## 1501-afk-offer-and-docs: VERIFIED
- Offer modelled on launch-kit, honest copy: shared/agent-offers.ts:52-65.
- tests/agent-offers.test.ts:48-54 (resolves to web product, no 'by anthropic|official', no 'guarantee').
- docs/host-contract.md:725-731 documents includes/order `included`/preview/`?kind=preview`/`--preview`. CLAUDE.md:150 sanctioned list entry.

## Secret / identity grep on the combined diff
`git diff 6539aa0b..HEAD | grep '^+' | grep -iE '<owner-first-name>|bibitkov|gmail|/home/|sk_live|sk_test|whsec_|ghp_|AKIA|bkk_...|re_...'`
Only hit: tests/mailer.test.ts:196 `expect(...).not.toContain('<owner-first-name>')` (a negative assertion). No real name, personal email, /home/ path or token in added lines.

## Findings
Critical: none.
Important: none.
Minor:
- shared/agent-offers.ts:60 `pageUrl` points to `/projects/agent-factory-kit/`, a landing page not yet published (sibling step).
- server/routes/web-products.ts:322 the shared auth helper now lets service products with `includes` through to download/order; the download of such a product itself ends in 404 because release is null. Harmless.
- server/routes/web-products.ts:338-360 if one candidate's Stripe lookup throws while another is merely unpaid, the result is 502 rather than 402. Acceptable fail-closed behavior.

## Remaining owner / sibling steps (code cannot do these)
1. Create the Stripe live product + $19 price; set `STRIPE_PRICE_WP_AGENT_FACTORY_KIT` on Render.
2. Bilko-Launch-Kit builds the Kit zip and the 2-file preview zip; commit their version/filename/bytes/sha256 into `release` and `preview` of the `agent-factory-kit` entry in shared/web-products.ts; upload via the owner release route (`?kind=preview` for the preview).
3. Publish the `/projects/agent-factory-kit/` landing page and thanks page (sibling).
4. Sandbox purchase evidence: a test-mode checkout of the Kit and of Agent Factory Setup showing the download links on the thanks page and in the confirmation email.
