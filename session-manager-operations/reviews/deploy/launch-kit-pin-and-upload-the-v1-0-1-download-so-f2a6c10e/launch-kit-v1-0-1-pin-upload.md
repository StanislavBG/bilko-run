# Launch Kit v1.0.1: pin and upload (2026-10-11, PDT)

## Source of the pin
- `Bilko-Launch-Kit/releases/1.0.1.json` was not committed yet. Its validator kept rejecting `site-value-first-copy` over two stale full-page screenshots, which blocked publisher PRD 7. The validator passed `pack-release-1-0-1`.
- With the owner's OK ("pin from build"), the hash came from two separate `git archive` exports of Launch Kit HEAD `9a692c5`. Each ran `lint` + `build:pack` + `check:pack`, and both gave the same result: `bilko-launch-kit-1.0.1.zip`, 32631 bytes, sha256 `40506573c3855d6412fc64d8718e9f74b24fa873da1e2991e708ea0581ffd7c5`.
- Zip contents: no upstream names in any SKILL.md, README or reference file. NOTICE.md, LICENSES/ and the LICENSE.md pointer to them are kept (MIT requirement).

## Deploy and upload
- Commit 8a58052, pushed 10:13 PM PDT. Tests: 4 web-products test files, 33 passed. Typecheck clean.
- 10:15:28 PM PDT: GET /api/web-products/launch-kit returned version 1.0.1, `available: false` (new deploy, health uptime 28s).
- 10:15:28 PM PDT: PUT /releases/1.0.1 returned 201 `{"stored":true,"sha256":"40506573…","bytes":32631}`: PASS
- Repeat PUT: 409 "Release already stored.": PASS
- Info endpoint afterwards: `available: true`: PASS
- 404/unavailable window: at most ~30 s (deploy start to upload, polled every 15 s).

## Buyer download
- QA order (owner's 100%-promo launch-kit checkout): /order returned paid, version 1.0.1, filename `bilko-launch-kit-1.0.1.zip`, 32631 bytes. That order has now used 1 of its 20 downloads.
- /download: 200, `attachment; filename="bilko-launch-kit-1.0.1.zip"`, sha256 `40506573…`, byte-identical to the local build: PASS

## Follow-up
- Launch Kit PRD 7 should still commit `releases/1.0.1.json`. A reproducible build gives the same sha256. If it gives a different one, the pin here must move to 1.0.2, because 1.0.1 bytes are already stored and can't be replaced.
