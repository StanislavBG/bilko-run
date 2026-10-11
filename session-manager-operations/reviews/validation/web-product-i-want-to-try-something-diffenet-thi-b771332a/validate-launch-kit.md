# Validation: Bilko Launch Kit web-product plan

Validated 2026-10-10 (America/Los_Angeles, PDT). Base `d383352` (from the PRD note), HEAD `9437180`. 36 commits in range. PRD files found under `prds-archived/` (1259 itself is queued). 1244-wp-webhook was archived unrun (timestamped subfolder) and replaced by 1249; not validated. The two `*-fix-*` PRDs (1246, 1258) were read as context for their parents.

Gates re-run in the job worktree (node_modules symlinked to the main checkout, since removed):
- `pnpm vitest run` over the 10 web-product / webhook / checkout / db test files: **10 files, 76 tests passed**.
- `pnpm typecheck`: exit 0. `pnpm build`: exit 0.
- Sibling `/home/bilko/Projects/Bilko-Launch-Kit`: `scripts/build-pack.mjs --check` -> "OK reproducible"; `scripts/lint-skills.mjs` -> "OK 8 skill(s)"; `site build` and `site test` (13 Playwright tests) green; `find site/dist -name '*.zip' -o -name SKILL.md` empty.
- Live: info endpoint, landing, thanks, og, negative checks (below).

## Verdicts

| PRD | Verdict |
|---|---|
| 1239-wp-catalog | VERIFIED |
| 1240-launch-kit-stripe | VERIFIED |
| 1241-launch-kit-sources | VERIFIED |
| 1242-wp-store | VERIFIED |
| 1243-wp-buy-routes | VERIFIED |
| 1249-wp-webhook-orders | VERIFIED |
| 1245-launch-kit-skills-a | VERIFIED |
| 1246-wp-release-account-routes | VERIFIED |
| 1247-wp-admin-stats | VERIFIED |
| 1248-launch-kit-skills-b | VERIFIED |
| 1250-wp-admin-tab | VERIFIED |
| 1251-launch-kit-package | VERIFIED |
| 1252-wp-docs | VERIFIED (one Minor docs error) |
| 1253-launch-kit-landing-page | VERIFIED |
| 1254-launch-kit-buy-flow | VERIFIED |
| 1255-launch-kit-catalog-entry | VERIFIED |
| 1256-launch-kit-deploy-api | VERIFIED |
| 1257-launch-kit-publish-landing | VERIFIED |
| 1258-launch-kit-e2e-purchase | VERIFIED (with Important caveat: promo not entered in hosted UI) |

## Evidence per PRD

**1239-wp-catalog.** `shared/web-products.ts` exports the interfaces, `MAX_RELEASE_BYTES = 5*1024*1024` (line ~44), the lookups, regexes (lines 64-69) and `validateWebProducts`; `tests/web-products-catalog.test.ts` 12 tests pass; typecheck 0.

**1240-launch-kit-stripe.** Live `stripe ... retrieve --live`: product `prod_VQ4ePQ5HTW5znY` name "Bilko Launch Kit", metadata web_product=launch-kit, description matches the criterion text verbatim, default_price `price_1UPEUuR6w0VtQRLTqFklclrS`; price one_time, usd, 900, metadata web_product=launch-kit; coupon `zqomwcOl` percent_off 100, duration once, max_redemptions 5, applies_to only that product; promo `promo_1UPEV2R6w0VtQRLTqcsFAi1Z` active, max 5 (times_redeemed 1 after the E2E). Search by metadata returns exactly 1 product (no duplicates). Promo file `/home/bilko/.config/bilko/launch-kit-qa-promo.txt` is mode 600, non-empty. The code value is absent from the working tree, all commits in base..HEAD, and `git log -S`. Record has ids and redacted commands. Not checkable read-only: that no *other* live object was touched.

**1241-launch-kit-sources.** Sibling is on main with `.gitignore` (the 5 required entries), README stating PRIVATE, CLAUDE.md listing sources/research/design/pack/site/scripts. All 10 Corey folders and both alirezarezvani folders exist, each with SKILL.md; both root LICENSE files present. `gh api .../license --jq .license.spdx_id` -> MIT, MIT. `research/sources.md` has the 8-skill mapping with repo@SHA, licenses, exclusions. Three design files present. Sibling commit `fa0bb10`. I did not re-hash vendored files against the pinned SHAs.

**1242-wp-store.** Store test file (5 tests) and `tests/db.test.ts` pass; tables and service functions are in `server/db-schema.ts` and `server/services/web-products.ts` (+142 lines).

**1243-wp-buy-routes.** `server/routes/web-products.ts` lines 107, 128, 209, 228 register info, checkout, order, download; `resolvePaidOrder` (lines ~44-95) does findOrder -> Stripe retrieve with slug, status, payment_status and price checks -> recordOrder; download sets the four required headers (lines ~244-250). 8+ route tests pass.

**1249-wp-webhook-orders.** `server/routes/stripe.ts:185` dispatches on `metadata.web_product` and `/checkout/success` (line 345, 365) redirects. `tests/stripe-webhook-web-products.test.ts` 8 tests plus attribution, checkout-success, coffee tests pass.

**1245 / 1248 skills.** Eight `pack/skills/*/SKILL.md`, 96-112 lines each, all with the 8 required headings (page-roast shows a second "## Scorecard" inside its output template only); `references/` folders exist where bodies would otherwise grow; lint exits 0. Output files `.launch/{context,page-roast,headlines,price-and-offer,emails,launch-week,scorecard,build-in-public,first-100}.md` are named in the owning skills. Bilko-URL mentions: email-forge, launch-grader once each. Records are metadata-only (no skill text).

**1246-wp-release-account-routes.** `server/routes/web-products.ts:267` PUT scoped parser (`parseAs: 'buffer'`, `bodyLimit: MAX_RELEASE_BYTES`), explanatory comment above it; account-download at :299 gives 401/402/404 as specified. `tests/web-products-release-account.test.ts` 8 tests pass; routes test unchanged and passes. Typecheck now clean, so the earlier gate failure (missing `@resvg/resvg-js` install) is resolved.

**1247-wp-admin-stats / 1250-wp-admin-tab.** `server/routes/admin-web-products.ts:19` GET with requireAdmin; `tests/admin-web-products.test.ts` passes. `src/pages/admin/analytics/WebProductsTab.tsx` (156 lines) and the `AdminPage.tsx` tab edit compile; `pnpm build` produces `AdminPage-*.js`. I did not render the tab visually.

**1251-launch-kit-package.** `--check` reports reproducible. Zip: 33,920 bytes, sha256 `f74e8e96...efa4e`, equals `releases/1.0.0.json` and the catalog. `unzip -l` lists 8 SKILL.md, README, LICENSE, NOTICE, CHANGELOG, both upstream license texts under one `bilko-launch-kit/` root. CHANGELOG has `## 1.0.0 - 2026-10-10`. `git ls-files` shows no zip / dist-pack tracked.

**1252-wp-docs.** `docs/host-contract.md:413` section with 7-row endpoint table (matches routes/status codes read above) and a 7-step playbook. CLAUDE.md has the Web products subsection (line 131) and the hard rule (line 166).

**1253-launch-kit-landing-page.** Build emits `dist/index.html`, `dist/thanks/index.html`, `dist/manifest.json`; credits block names both MIT repos, instalanding.ai and dexter-st / Uiverse (the only credit in the design JSON); no testimonial, "trusted by" or user-count text found; FAQ covers 20 downloads, 14 days + bilko.run/contact, "phone home"/telemetry; footer links /privacy and /terms; only script is the bundled module; no inline `on*=` handlers; reduced-motion rule present; screenshots at 1512 and 390 exist; no-horizontal-scroll Playwright tests pass.

**1254-launch-kit-buy-flow.** `#buy` present; golden spec (9 tests) passes: checkout POST and redirect, error re-enable, cancel note, thanks paid/402/429/404; no `.zip` or SKILL.md in dist.

**1255-launch-kit-catalog-entry.** `shared/web-products.ts:48-61` is exactly one entry; price id equals the Stripe price above; bytes/sha256 equal `releases/1.0.0.json`; `validateWebProducts(WEB_PRODUCTS)` is tested as `[]`; CLAUDE.md:143 bullet present.

**1256-launch-kit-deploy-api.** Record: pushed `9c76869`, CI run success, 1033 tests. Live now: `GET /api/web-products/launch-kit` -> `{"version":"1.0.0","available":true,...}`; order with fake `cs_live_aaaaaaaaaaaaaaaaaaaa` -> 404; download `session_id=bad` -> 400; account-download no auth -> 401; admin no auth -> 403. Checkout POST and the 409 re-PUT were not re-run (they create a Stripe session / write); the record claims them.

**1257-launch-kit-publish-landing.** Live landing 200 with "Launch Kit" (10x) and "$9" (8x); thanks page serves "Your download - Bilko Launch Kit" (not the SPA shell); og png 200; a guessed `.zip` URL returns 200 `text/html` (SPA fallback, not a zip). `origin/main` (fetched) has only `index.html`, `manifest.json`, `thanks/index.html` and four assets under `public/projects/launch-kit/`; no `.zip` or `SKILL.md` anywhere in its tree matching launch.

**1258-launch-kit-e2e-purchase.** Record says `E2E: PASS`; session id shortened (`9IVucx`); sha256 match and `downloadsUsed` 1 recorded. Corroborated live: promo `times_redeemed` went 0 -> 1. The script exists at the stated path. Caveat below.

## Plan-wide: no paid content in the repo

- No SKILL.md or `.zip` in `git diff d383352..HEAD --name-only`, nor in `origin/main` under launch-kit.
- Promo code value: absent from HEAD, every commit in range, and `git log -S`.
- Full `cs_live_` ids: only the deliberate placeholder `cs_live_aaaaaaaaaaaaaaaaaaaa` (in a deploy record's check list); the E2E record shows only the last 6 characters.
- Only the sha256 and byte count of the zip are committed.

## Findings

### Critical
None.

### Important
1. **E2E did not enter the promo in the hosted Checkout UI** (`session-manager-operations/reviews/deploy/.../launch-kit-e2e-purchase.md`). The UI attempt got `payment_pages_promotion_code_invalid`; PASS came from a session with the promo pre-applied via API. The webhook, thanks page, download, sha and counter did run on the production path, but a real buyer typing a promo into the live Checkout is unproven. The checkout route sets `allow_promotion_codes: true` (`server/routes/web-products.ts:~151`). A one-time manual promo entry by the human would close this.

### Minor
1. `docs/host-contract.md` (Stripe webhook paragraph under the endpoint table) says `/stripe/success` redirects web-product sessions; the route is `/checkout/success` (`server/routes/stripe.ts:345`).
2. `server/routes/web-products.ts:228-250` download cap is check-then-record (`countSessionDownloads` then `recordDownload`), so parallel requests can exceed `downloadLimit` slightly. Low impact for a $9 zip.
3. `/account-download` (`server/routes/web-products.ts:299`) records downloads but has no per-account cap; only the 30/min per-IP limit applies. Not required by the PRD.
4. `site/scripts/live-purchase.mjs` and three refreshed screenshots are uncommitted in the sibling repo (the script is intentionally uncommitted per the fix PRD). My `site test` run also rewrites those screenshots.
5. Diff range includes non-Epic work merged in by 1256 (git-viewer: `server/routes/tools/git-viewer.ts`, `server/clerk.ts`, `server/services/stripe.ts`, related tests, host-kit/academy publish artifacts). Not reviewed here beyond confirming the test suite passes.
6. 1240 cannot be proven read-only to have created "no other live Stripe object"; the metadata search shows no duplicate Launch Kit product.
7. `/code-review` and `/security-review` were not run as separate skills; I self-reviewed the web-products route code (input validation via slug/session-id/version regexes, parameterized SQL via db helpers, sha-pinned unauthenticated PUT with explanatory comment, per-IP rate limits, no stack traces to clients, email masked). No injection, path traversal or secret exposure found in what I read.
