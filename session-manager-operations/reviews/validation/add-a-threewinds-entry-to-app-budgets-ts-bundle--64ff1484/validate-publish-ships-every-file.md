# Validation: publish ships every bundle file

Base: f1d04bad5e76fadc655931fdf882b9dbf9adea7c (given). Commits: bfd26a21 (code, .gitignore, dist, tests), b940cc68 (doc). Both PRD files found in prds-archived/ (1799, 1800).

## publish-fails-on-ignored-bundle-files — VERIFIED
- .gitignore:5-6 comment plus `!public/projects/**/node_modules/` after `node_modules/` and `/node_modules`. `git check-ignore --no-index`: the demo `__node_modules/.pnpm/p@1/node_modules/p/a.png` path is not ignored (rc=1); `public/projects/demo/.env` is still ignored (`.gitignore:27:.env`).
- mcp-host-server/src/publish-checkout.ts:267-288: `ls-files -z --others --ignored --exclude-standard -- <paths>` runs before `git add`. A hit returns `{ok:false, stage:'commit'}` with the first 20 files and a `, and N more` suffix. Nothing is added, committed or pushed.
- tests/mcp-publish-checkout.test.ts:427-448: `.env` ignored, so ok false, stage commit, error contains `public/projects/demo/.env`, and origin main SHA unchanged.
- tests/mcp-publish-checkout.test.ts:450-478: real root .gitignore read from disk, so ok true, committed true, asset in origin main tree.
- dist rebuilt: bfd26a21 touches mcp-host-server/dist/publish-checkout.js; mcp-dist-sync passes.
- Pre-existing tests: the file shows 12 tests passing, 67 insertions and no deletions in the test file.
- Gate re-run: `vitest run tests/mcp-publish-checkout.test.ts tests/mcp-dist-sync.test.ts` gave 14/14 pass. `pnpm typecheck` exit 0.

## doc-publish-ships-every-file — VERIFIED
- docs/host-contract.md:537 sits directly after the "A successful publish returns" paragraph (line 535). It covers: every file ships, no force-add, a `.gitignore` match fails at stage `commit` with files listed (first 20 plus a count), and `node_modules/` parts under `public/projects/<slug>/` are kept.
- Wording matches the error text at publish-checkout.ts:285 and the rule at .gitignore:6. Gate is `none`.

## Review of combined diff
No `/code-review` or `/security-review` run. Self-review: git args are passed as an array (no shell), the NUL split is correct, and there is no force-add, so a stray `.env` cannot be published. No secrets or path traversal added. The ignored-file listing is scoped to the returned paths.

## Findings
- Critical: none.
- Important: none.
- Minor: the plan's diff also includes unrelated Three Winds commits (rooms, security docs). They are outside these two PRDs and were not reviewed here.
