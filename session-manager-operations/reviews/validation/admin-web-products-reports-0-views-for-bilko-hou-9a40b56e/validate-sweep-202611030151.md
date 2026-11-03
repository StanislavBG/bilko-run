# Validation sweep: ship-bilko-hour-views, ship-nested-product-views

Base: 64009329. PRD files found in `prds-archived/` (1585-ship-bilko-hour-views.md, 1588-ship-nested-product-views.md). Both are deploy PRDs; their only file is a ship record. The code they shipped was validated by the earlier validate PRDs (both records show VERIFIED, no Critical/Important).

## ship-bilko-hour-views — VERIFIED
- Commit `64ef2a04` adds only `.../deploy/.../ship-bilko-hour-views.md` (git show --stat).
- Gate `timeout 10 grep -q 'SHIP: PASS' <record>`: exit 0 (re-run).
- Pushed commit `4c4d68c4` "fix(admin): count Bilko hour views on the /bilko page": `git merge-base --is-ancestor 4c4d68c4 origin/main` true; `git show --stat` touches only CLAUDE.md, server/page-hits.ts, server/routes/admin-web-products.ts, tests/admin-web-products.test.ts (no unrelated local-main work).
- Validation record validate-bilko-hour-views.md: "bilko-hour-views — VERIFIED", Critical none, Important none.
- Record lists SHA, times in PST, before/after for all three products at both exclude_self settings, each check PASS (bilko-hour 0 -> 4, daily sum 4, others unchanged).
- Not re-checked: live bilko.run numbers (the PRD forbids creating traffic; they are the run's own evidence, not independently re-read here).

## ship-nested-product-views — VERIFIED
- Commit `ce3b3f08` adds only `.../deploy/.../ship-nested-product-views.md`.
- Gate grep for `SHIP: PASS`: exit 0 (re-run).
- Pushed commit `d0377ebe` "fix(admin): count nested product pages under their own product": ancestor of origin/main; touches only server/routes/admin-web-products.ts and tests/admin-web-products.test.ts.
- Code read (`git show f58ea065`): `viewsFilter` now excludes nested products' LIKE prefixes from the parent (`NOT LIKE`), all values bound args; tests cover nested counting, parent subpages, and retired path.
- Validation record validate-nested-product-views.md: VERIFIED, Critical none, Important none.
- Record has pushed SHA, PST times, before/after for three products, health uptime 56 s < 184 s, per-path agreement (launch-kit 8 = 8, agent-factory-kit 0 = 0), SHIP: PASS.
- Not re-checked: live health/numbers (no traffic rule; not re-run).

## Combined diff
`git diff 64009329..HEAD --stat`: server/routes/admin-web-products.ts (+10/-4), tests/admin-web-products.test.ts (+25), plus three review/deploy records. Self-review: SQL uses bound parameters with only placeholders interpolated; no secrets, no path handling, no duplicated helper (reuses `productPageSlug`, `likePrefix`).

## Findings
- Critical: none.
- Important: none.
- Minor: the pnpm test counts differ between records (1852 vs 1858), consistent with the added tests; no action. Tests/typecheck/build were not re-run here (gate `none`; ship records report them green).
