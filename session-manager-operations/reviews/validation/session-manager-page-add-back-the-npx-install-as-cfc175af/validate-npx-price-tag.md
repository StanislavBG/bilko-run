# Validation: npx price tag plan

Base: 9861fc8406293c0be5eb413a9404e62b0216221b. Head reviewed: 5208c53 (all on origin/main).
Gates were run in the main checkout `/home/bilko/Projects/Bilko` (HEAD e9302b2), because this job worktree has no `node_modules`. Its `src/`, `e2e/` and `tests/` for the npx files match 5208c53; the only difference is one unrelated deleted test file (`tests/sm-relay-conn-addressing.test.ts`).
Commit order from `git log` over the PRD paths: 7ccb274 (primitive), bbe2107 (wire), 3f0111b (e2e), 5208c53 (deploy record).

## npx-copy-primitive — VERIFIED
- copy.ts keys: `src/pages/session-manager-landing/copy.ts:82-97` has commandPrompt, command, copyLabel, copiedLabel, copyFailedLabel, commandNote, plus aria.commandBox, copiedStatus and copyFailedStatus with the exact strings. The existing keys are unchanged in the diff.
- `hooks.ts:123-190` exports CopyStatus, CopyInstall and useCopyInstall. It reads `COPY.priceTag.command` and sets 'copied' only after `writeText` resolves (2200ms). On a missing or rejected clipboard it selects `codeRef` and tries `execCommand('copy')`, then settles 'copied' (2200ms) or 'failed' (4000ms). The timer is cleared on unmount (`hooks.ts:149`). There is no source parameter.
- `CopyButton.tsx:19-33`: `type="button"`, `className="smlp-copy ${className}"`, `data-state`, `e.stopPropagation()` then `copier.copy()`, and three `smlp-copy__label` spans with `data-on`.
- FilmDialog.tsx and Downloads.tsx are absent from the diff.
- Gate `pnpm typecheck`: exit 0.

## npx-price-tag-wire — VERIFIED
- `SessionManagerPage.tsx:119-157`: `PriceTag()` calls `useCopyInstall()`. Inside `.smlp-tag__install` the order is MacDownload, Intel link, WindowsDownload, then `.smlp-npx`. That holds `.smlp-cmd[role=group][aria-label]` (aria-hidden prompt, `<code ref>`), CopyButton `.smlp-tag__copy`, `.smlp-npx__note` and `<p role="status" className="smlp-sr">`. `.smlp-tag__note` and the fineprint follow unchanged.
- CSS `session-manager-landing.css:636-718` has every required rule. The copy button is paper-coloured, with an ink border and shadow, 34px min-height, 14px bold and `cursor:pointer`. Hidden labels use `visibility:hidden`.
- `tests/open-core-positioning.test.ts:128-138`: renamed test asserting the five tokens, `COPY.priceTag.command`, and the FilmDialog installer-only checks. The old whole-page npx ban is replaced, not just deleted. The manual-page npx test is untouched.
- Gate: typecheck exit 0; `pnpm vitest run tests/open-core-positioning.test.ts` passed 21/21.

## npx-price-tag-e2e — REFUTED — the gate `playwright test e2e/session-manager-landing.spec.ts` fails, including the new Copy test, which failed 4 of 4 repeat runs
- The canvas test now asserts the command text and the Copy button, plus tag-inside-canvas and no overlap with `.smlp-turn--next` (`e2e/session-manager-landing.spec.ts:120-136`). The reflow test checks both are visible (`:170-173`). The end-card, manual and hub assertions are unchanged. All of these passed.
- The new test `price tag Copy button is keyboard-accessible…` (`:178`) FAILS at `:192`. After `button.focus()` and Enter, `getByRole('status')` stayed `""` for 5s instead of containing "Install command copied to your clipboard." (`--repeat-each=4`: 4 failed.)
- The preceding assertion `expect(button).toContainText(copiedLabel)` at `:191` passes vacuously. The three labels are always in the DOM, and `visibility:hidden` does not stop `toContainText` from matching them. So that line does not prove the label swapped.
- I did not find the root cause. Candidates: the Enter keypress not reaching the click handler, or the clipboard write not resolving under the test context.
- Full-spec run: 27 passed, 3 failed. The other two failures are "reduced motion the turn completes within 400ms" and "seek drag … time readout". Both passed when re-run alone in the same checkout, so they look load-sensitive, but they were not investigated. They are in tests this plan did not touch.
- The clipboard `readText` check and the before/after tag-height check at `:193-195` were never reached, so they are unverified.
- Not checked: the 390x844 and 1440x860 fit screenshots, and the owner criterion of an unchanged tag height. Layout assertions in the canvas and reflow tests passed, but the height-equality check lives in the failing test.

## npx-price-tag-deploy — VERIFIED (with caveat)
- `git fetch origin main` and `git merge-base --is-ancestor HEAD origin/main`: exit 0. 5208c53 is also an ancestor of origin/main.
- `publish.md` exists with the pushed SHA, the old asset (index-DpzKiFP7.js) and the new asset (index-CeKs_HdR.js), try 8, and PASS/FAIL lines with PDT timestamps.
- Live re-check: bilko.run still serves `/assets/index-CeKs_HdR.js`. `/assets/hooks-BGcWDMEg.js` contains both `npx claude-code-session-manager@latest` and `Copy the install command` (grep count 1 each).
- Caveat: the PRD's literal check was "the new main asset contains the strings". The executor recorded that FAIL honestly, because the page is code-split, and verified the strings in the chunk graph instead. The intent (the command is live) is met. The "HALT on exhaustion" wording was not followed, which is a PRD-design flaw rather than a landing defect.

## Findings
### Critical
- None.
### Important
- `e2e/session-manager-landing.spec.ts:192`: the new keyboard Copy test fails deterministically, so the e2e gate is red, and the live copy and status announcement via keyboard is not proven. Needs investigation of whether it is a product bug (status never set after Enter) or a test bug.
- `e2e/session-manager-landing.spec.ts:191`: `toContainText(copiedLabel)` always passes, because the hidden labels stay in the DOM. Assert on `data-state="copied"` or on the visible label instead.
### Minor
- The plan's range `base..HEAD` also contains the unrelated commit 10b0dea (sm-relay tokens, tests and CLAUDE.md test-count bump). I did not review it as part of this plan.
- The deploy PRD's literal live check was unsatisfiable (see above); future deploy PRDs for code-split pages should check the chunk graph.
- This job worktree lacks `node_modules`, so the gates had to run in the main checkout.
- The PRD files were found: 1210 under `prds-archived/<timestamp>/`, and 1211-1213 under `prds-archived/`.
