# Launch Kit v1.0.2 + Agent Factory Kit v1.0.1: pin and upload (2026-10-26, PDT)

Inbound feedback from Bilko-Launch-Kit: paid zips had skills 1-4 saying "(step N of 5)" in an eight-skill pack.

## Source of the pins
- Records: `Bilko-Launch-Kit/releases/1.0.2.json` (`bilko-launch-kit-1.0.2.zip`, 32684 bytes, sha256 `a42d69f41be74b8b5cd6cb6532f595a897b937ca5c5178209e433296a30e1c52`) and `releases/agent-factory-kit/1.0.1.json` (`bilko-agent-factory-kit-1.0.1.zip`, 60144 bytes, sha256 `846f731e3c2d4ab906a48bd983ae2ba0356e6f069a759217ad4ca7db11cc31e6`).
- A clean `git archive` of Launch Kit HEAD `97c84f8` ran `lint` (8 skills OK), `build:pack --all` and `check:packs`. It reproduced both hashes and the unchanged preview (`9a21261f…`, 1.0.0).
- A `git archive` of `9672fff` (before the fix) reproduced the old AFK 1.0.0 pin `c5fe49c8…db08`, so the AFK diff is against the real shipped bytes.
- Content diffs: Launch Kit 1.0.1 → 1.0.2 and AFK 1.0.0 → 1.0.1 each change only the four SKILL.md headings (launch-context, page-roast, headline-lab, price-and-offer) to "of 8", the README version lines and the CHANGELOG. The file lists are identical.

## Host fix shipped with the pins
- Before this change, live `GET /api/web-products/agent-factory-kit` returned `available: false`, even though `checkout?dryRun=1` returned 200 and `/api/offers` listed it for sale. The info endpoint still required a Stripe price id, which one-time products stopped needing in 1ff960e3 (price_data). AFK has no price id.
- `available` now uses the same checks as checkout: Stripe configured, `isWebProductPriced`, and `isDeliverable`. The new tests fail on the old code: 3 failures.

## Deploy and upload
- Commit 5f68f1f3 pushed at 12:28:23 PM PDT. Web-products and offers tests: 10 files passed. Full suite: 1841 passed. The 1 failure was `projects-view`, which also failed on clean origin/main; ae9aaed6 fixed it upstream before the push. Typecheck clean.
- 12:31:21 PM PDT: new pins live (health uptime 34 s at 12:31:23). Before upload, both reported `available: false`.
- PUT /launch-kit/releases/1.0.2 → 201 `{"stored":true,"sha256":"a42d69f4…","bytes":32684}`: PASS
- PUT /agent-factory-kit/releases/1.0.1 → 201 `{"stored":true,"sha256":"846f731e…","bytes":60144}`: PASS
- Repeat PUTs: both 409 "Release already stored.": PASS
- Info afterwards: launch-kit 1.0.2 `available: true`; agent-factory-kit 1.0.1 `available: true`, `previewAvailable: true` (preview 1.0.0 unchanged): PASS
- `checkout?dryRun=1`: 200 for both. Admin products view: `releaseStored: true` for both.
- Unavailable window: about 2 s from first detection to upload. The poll ran every ~3.4 s, so the window was at most ~5 s.

## Buyer download
- Launch Kit, using the owner's 100%-promo QA order (`cs_live_…9IVucx`): `/order` returned paid, version 1.0.2, filename `bilko-launch-kit-1.0.2.zip`, 32684 bytes. `/download` returned 200 with `attachment; filename="bilko-launch-kit-1.0.2.zip"` and sha256 `a42d69f4…1c52`, byte-identical to the local build. All 8 headings say "of 8". That order has now used 3 of its 20 downloads: PASS
- Agent Factory Kit: Stripe has no AFK checkout session in live or test mode, so there is no order to download with. A new checkout is out of scope ("never POST checkout without ?dryRun=1"). What covers it instead: the content-addressed PUT stores bytes only if their sha256 and size equal the pin, and `/download` serves the stored bytes as they are.
