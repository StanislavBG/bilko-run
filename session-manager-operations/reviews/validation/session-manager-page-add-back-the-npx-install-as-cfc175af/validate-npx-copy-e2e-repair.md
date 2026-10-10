# Validation: npx Copy e2e repair (fix wave for REFUTED npx-price-tag-e2e)

Base: 04564be4e910d5233a18203f49a50b6543826ba3. Gates run in the main checkout (HEAD f49cf81), 2026-10-10 PDT.

## repair-npx-copy-e2e — VERIFIED
- Commits: 382dcea (test fix), merged by 441efb7. Only `e2e/session-manager-landing.spec.ts` changed (+18/-2); hooks.ts and SessionManagerPage.tsx untouched.
- Root cause stated in 382dcea body: test bug. `copied` state lasts ~2.2s and Playwright's backed-off `expect` polling missed it on a busy page; product path (writeText, data-state, status) works.
- Not skipped, loosened, or deleted: the test now uses `page.waitForFunction(..., {polling:'raf'})` and `toEqual({state:'copied', status: copiedStatus, label: copiedLabel})` (`e2e/session-manager-landing.spec.ts:~191-208`).
- Prior finding `:191` (vacuous `toContainText(copiedLabel)`): closed. It is replaced by `data-state==='copied'` plus the visible `[data-on="true"]` label compared with `toEqual`.
- Prior finding `:192` (empty role=status): closed. The same atomic read includes status text; clipboard === COPY.priceTag.command and `.smlp-tag` height before/after checks remain.
- Gate: `pnpm exec playwright test e2e/session-manager-landing.spec.ts` → 30 passed. `-g keyboard-accessible --repeat-each=3` → 3 passed.
- Gate part `pnpm typecheck`: exit 2, sole error `server/og-image.ts(4,23): Cannot find module '@resvg/resvg-js'`. The dependency is declared (`package.json:61`) but not installed in the main checkout's node_modules. This is environmental, comes from the separate OG share-card plan, and is not in this PRD's files. See Minor.

## push-npx-and-vitest-repairs — VERIFIED
- `git fetch origin main` then `git merge-base --is-ancestor f49cf81 origin/main` → exit 0 (ancestor).
- Record `session-manager-operations/reviews/deploy/.../publish-repairs.md` exists: pushed SHA d407bc9 (fast-forward, no force, origin only), CI run 38092571828 conclusion success, live 200 and the npx string in `hooks-BGcWDMEg.js`, PDT timestamps. The record was committed (f49cf81) and is on origin/main.
- I did not re-run the live fetch or the CI query; evidence is the committed record plus the ancestor check.

## Findings
### Critical
- none
### Important
- none
### Minor
- Main checkout lacks `@resvg/resvg-js`, so `pnpm typecheck` is red there until `pnpm install`. CI on d407bc9 was green, so this is local only.
- The test reads `.smlp-tag__copy` and `.smlp-tag [role="status"]` by class selectors inside `waitForFunction`; fine, but it is coupled to CSS class names.
