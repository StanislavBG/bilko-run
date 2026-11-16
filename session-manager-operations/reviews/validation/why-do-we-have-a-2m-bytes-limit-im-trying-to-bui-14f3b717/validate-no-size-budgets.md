# Validation: no per-app size budgets

Base: eeb0a8c2fa7a4ad9ec2282037ed0d2207a263dff. Review tools (`/code-review`, `/security-review`) not run as skills; self-reviewed the combined diff.

## size-qa-no-budget — VERIFIED (f263ca60)
- `scripts/sanity-qa-runners/size.ts`: no app-budgets import, no MAX_FILE_COUNT; status only warns on drift/missing manifest, fails on parse error (lines ~60-100).
- Table `Target | Size (gz) | Files | Status`, footer "No per-app size budget (owner decision 2026-11-15)…", details `N/M targets pass`.
- `scripts/sanity-qa-prompts/size.txt` has no budget list or >30 rule; adds the no-budget line.
- Gate: tests/sanity-qa.test.ts passed; `pnpm typecheck` exit 0.

## drop-app-budgets-table — VERIFIED (e3e0e34d)
- server/db.ts has no app_budgets seeding; server/db-schema.ts:327-328 retired comment + `DROP TABLE IF EXISTS app_budgets`.
- mcp-host-server/src/db.ts:45-46 drops it; dist/db.js:39-40 matches.
- tests/db-boot.test.ts:67-80 seeds table, boots twice, asserts gone.
- Gate: db-boot, publish-gate, mcp-dist-sync passed; both tsc runs clean.

## publish-gate-no-size-budget — VERIFIED (c053847b)
- app-budgets.ts/.js deleted; `git grep app-budgets` over code, tests, dist: no hits.
- budget.ts: gate name `budget`, exact pass/fail texts, 104,857,600 threshold (`>`), comment at budget.ts:46-47.
- server.ts:428 description has both new phrases.
- Gate: publish-gate, mcp-share-assets-gate, sanity-qa, db-boot, mcp-dist-sync: 5 files / 79 tests pass; typecheck and mcp tsc exit 0.
- Manual run of dist/gates/budget.js with 3,000,000 random bytes, slug threewinds: `{"status":"pass","details":"measured 2930.6 KB gz over 1 files (manifest reported 46.9 KB); largest file index.html 2.9 MiB; no size budget, only GitHub's 100 MiB per-file limit"}`.

## doc-no-size-budget — VERIFIED (cd92ce00)
- docs/host-contract.md:525 budget row matches landed budget.ts behaviour; :259, :507-511, :533 rewritten with the landed details text; :561 `### Bundle size` with 100 MiB reason.
- docs/host-internals.md:47 Size row as specified.
- docs/publishing-contract.md:171 item 5 and :228 `## Package size` with no numeric caps.
- No hits for app-budgets, 200 KB or per-app budget in the five named doc files.

## Findings
- Critical: none.
- Important: none. Grep of server/, scripts/, mcp-host-server/src for size/file-count blocking found no remaining bundle-size or file-count limit (the share-assets caps for card media are host-side and documented).
- Minor: `docs/host-contract.md:259` says the gate leaves share assets out of the gzip sum, which is accurate but now only cosmetic. The queue's commit range also holds unrelated commits (threewinds publish, external-url redirect 78d4102f).
