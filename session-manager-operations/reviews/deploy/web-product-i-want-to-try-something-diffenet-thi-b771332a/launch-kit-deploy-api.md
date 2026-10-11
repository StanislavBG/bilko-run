# Deploy record: Bilko Launch Kit API (web-products)

- Pushed SHA (`origin/main`): 9c76869596837d7663960ea3ec100703a6358598 (merge of origin/main into job branch, conflict-free; 8b743b1..9c76869)
- Pushed: 2026-10-10 22:02 PDT, `git push origin HEAD:main`, no force, origin only
- Pre-push: `pnpm test` 89 files / 1033 tests passed; `pnpm typecheck` clean on merged tree
- CI: GitHub Actions run 38113484259, workflow "CI": conclusion **success**
- Zip sha256 f74e8e96...efa4e matches the catalog entry; 33920 bytes

## Commits in origin/main..HEAD (pre-merge, non-merge) not from this Epic
Everything below that is not a web-products / launch-kit / "Launch Kit" item belongs to other Epics:
- 51e262a feat(git-viewer): hosted portfolios API + $5/mo git_viewer tier
- d383352 docs(validation): record Buy me a coffee comeback validation
- 22f0f3d, 8bccd82, 85c9d7e, 29b2958, 7fb5b1f, 4bf6279 merge scheduler jobs (coffee / space-shooter video)
- 0f7d181 docs(coffee), dd768ca docs(validation) Escape Velocity, 8b51133 feat(session-manager) coffee link, 363843f feat(coffee) footer/hero, 0e88c89 docs(coffee), f881743 feat(blog) video, 385a43c feat(coffee) defaults, d5e8bc1 feat(blog) v2, a5849c0 doc(blog) Escape Velocity
Full list (25 non-merge commits):
- 6b945f1 feat(web-products): add Bilko Launch Kit catalog entry
- 698e52e docs(web-products): playbook, endpoint table and hard rule for paid downloads
- 7d87b20 docs(launch-kit): record v1.0.0 package filename, size and sha256
- 6aa93a9 feat(admin): products tab for web product funnel, revenue and release status
- 4e2148b docs(launch-kit): record skills 5-8 commit (metadata only)
- 0427fe5 feat(web-products): record verified web-product orders from Stripe webhook and forward success page
- f05a5ff feat(web-products): admin funnel and download stats endpoint
- d9a83f0 feat(web-products): content-addressed release upload and Clerk account re-download
- 34dda18 docs(launch-kit): record skills 1-4 commit (metadata only)
- a6b039f feat(web-products): public buy-and-deliver routes (info, checkout, order, download)
- a98e237 feat(web-products): order, download and release persistence tables and helpers
- 904d54a docs(launch-kit): record sibling repo sources (metadata only)
- 431df27 docs(deploy): record live Stripe objects for Bilko Launch Kit
- d694508 feat(web-products): add pure web product catalog, lookups and validators
- 51e262a feat(git-viewer): hosted portfolios API + $5/mo git_viewer tier
- d383352 docs(validation): record Buy me a coffee comeback validation
- 0f7d181 docs(coffee): describe shared tip jar and committed Stripe defaults
- dd768ca docs(validation): record Escape Velocity blog rebuild validation
- 8b51133 feat(session-manager): add Buy me a coffee link to landing/manual header
- 363843f feat(coffee): link /coffee from footer and home hero
- 0e88c89 docs(coffee): record live Stripe coffee product + payment link update
- f881743 feat(blog): 30-second video for a-space-shooter-shrank-66-percent-to-fit-in-your-browser
- 385a43c feat(coffee): commit live Stripe coffee defaults; env still overrides
- d5e8bc1 feat(blog): ship v2 rewrite of a-space-shooter-shrank-66-percent-to-fit-in-your-browser
- a5849c0 doc(blog): rewrite Escape Velocity post as a share-worthy playable-first update

## Deploy and upload (2026-10-10, PDT)
- GET /api/web-products/launch-kit: polls 1-2 returned 404 (old deploy), poll 3 returned 200 JSON version "1.0.0", available false: PASS
- PUT /releases/1.0.0 (content-type application/zip): 201 `{"stored":true,"sha256":"f74e8e96...","bytes":33920}`: PASS
- Info endpoint afterwards: `available: true`: PASS

## Live negative checks
- POST /checkout: 200, url starts https://checkout.stripe.com/c/pay/cs_live_...: PASS (created one unpaid, auto-expiring Stripe session and one checkout_start row)
- GET /order?session_id=cs_live_aaaaaaaaaaaaaaaaaaaa: 404 "Order not found": PASS
- GET /download?session_id=bad: 400 "Invalid session id": PASS
- GET /account-download without auth: 401: PASS
- Second PUT /releases/1.0.0: 409 "Release already stored.": PASS
- GET /api/admin/web-products without auth: 403: PASS

No FAIL. No code modified; a `pnpm install` was needed in the worktree (no committed changes).
