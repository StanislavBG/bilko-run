# Validation: tooling + docs plan (1135, 1155, 1164)

Base: f6c830b41387627d97916c1af828bf4c1472dae1. PRD files found in `prds-archived/`.

## 1135-manifest-schema-unify — VERIFIED
- Commit aa27104 touches shared/manifest-schema.ts and mcp-host-server/src/manifest-schema.ts.
- shared/manifest-schema.ts:1-3 imports `ManifestSchema`/`Manifest` from '../mcp-host-server/src/manifest-schema.js' and re-exports them. `validateManifestRaw` and `computeDrift` are kept and look unchanged.
- mcp-host-server/src/manifest-schema.ts:2: "Keep in sync" comment replaced with "Single source of truth: the Bilko host imports and re-exports this". No dist change was needed, and the tests/mcp-dist-sync run in the full suite passed.
- `pnpm build` exit 0. Compiled modules: `dist-server/shared/manifest-schema.js` and `dist-server/mcp-host-server/src/manifest-schema.js`.
- The fallback path (tests/manifest-schema-sync.test.ts) was not needed and does not exist. The re-export path was taken.
- Gate tests (manifest, publish-gate, mcp-dist-sync) passed in the full run: 72 files / 872 tests.

## 1155-typecheck-scripts — VERIFIED
- Commit 5fa5daf. tsconfig.scripts.json: noEmit, strict, same NodeNext/ES2022 settings as the server config, includes `scripts/**/*.ts`, excludes scripts/project-pages.
- package.json:41 `typecheck` = client && server && `tsc -p tsconfig.scripts.json`. `pnpm typecheck` exit 0.
- No other exclusions beyond project-pages.

## 1164-docs-refresh-after-simplification — VERIFIED
- Commit 51ede4f touches CLAUDE.md, README.md, docs/host-internals.md.
- Existence check over every backticked path and relative link in the three files, plus the sanctioned Session Manager list: no repo path is missing. The only non-hits are npm packages, GitHub slugs and the `test-results/sanity-qa-YYYY-MM-DD-HH-MM.md` pattern, which are not repo paths.
- CLAUDE.md names content/blog/README.md, server/db-schema.ts, server/blog-posts.ts and the `_shared.ts` helpers (freeTierGate, creditGate, askGeminiJson, toolErrorReply; all present in server/routes/tools/_shared.ts). The Testing counts "72 files, 872 tests" match a fresh `pnpm vitest run` here.
- docs/host-internals.md:79,90 now says `test-results/` is gitignored and not committed.

## Whole tree
- `pnpm typecheck` exit 0. `pnpm build` exit 0. `pnpm vitest run`: 72 files, 872 tests passed.
- An earlier `pnpm test` run, executed in parallel with `pnpm build`, showed 12 failed files / 3 failed tests. Re-running sequentially passed everything. I treated the first run as interference from the concurrent build wiping `dist`, not a regression. The cause was not confirmed.

## Findings
- Critical: none.
- Important: none.
- Minor: an empty untracked file named `<path>` appeared in the worktree root during the test run (created 18:00). It is probably test debris and was not touched. It is worth finding which test creates it.
- Minor: the worktree has no node_modules, so I symlinked the main tree's for the run and removed the link afterwards.
