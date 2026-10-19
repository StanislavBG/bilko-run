---
title: wire: show the npx one-liner + Copy button as the 3rd option on the Session Manager price tag
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T20:36:19.507Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
agentType: dev-lead
dependsOn: [npx-copy-primitive]
planId: pl-mv2utb6r-b533e1
---
# Goal

wire. Render the npx install command box and CopyButton (landed by PRD npx-copy-primitive) inside PriceTag() on /products/session-manager, after the Mac and Windows download buttons, with a short Node requirement note and a role="status" announcement; restore the .smlp-cmd/.smlp-copy styles; and deliberately flip the vitest positioning test that currently forbids npx on the page.

# Acceptance criteria

- [ ] src/pages/session-manager-landing/SessionManagerPage.tsx PriceTag() calls useCopyInstall() and, inside .smlp-tag__install, renders in order: <MacDownload />, the Intel alt link, <WindowsDownload />, then a <div className="smlp-npx"> holding a <div className="smlp-cmd" role="group" aria-label={tag.aria.commandBox}> (aria-hidden prompt span + <code ref={copier.codeRef}>{tag.command}</code>), <CopyButton className="smlp-tag__copy" labels from copyLabel/copiedLabel/copyFailedLabel>, <p className="smlp-npx__note">{tag.commandNote}</p> and <p role="status" className="smlp-sr"> showing aria.copiedStatus / aria.copyFailedStatus / '' by copier.status; then the existing .smlp-tag__note and .smlp-tag__fineprint unchanged.
- [ ] src/styles/session-manager-landing.css (Price tag section, before .smlp-tag__note) adds .smlp-npx, .smlp-cmd (+ code, code::selection, __prompt), .smlp-copy, .smlp-copy__label (grid-area 1/1; [data-on='false'] visibility:hidden), .smlp-root .smlp-tag__copy (+ :active) and .smlp-npx__note. The copy button is visually secondary to the rust download buttons (paper background, ink border/shadow, ~34px min-height, ~14px bold) and has cursor:pointer.
- [ ] tests/open-core-positioning.test.ts: the test at ~line 128 is renamed to say the price tag offers Mac + Windows downloads AND the npx one-liner while the film end card offers downloads only. It asserts SessionManagerPage.tsx contains '<MacDownload', '<WindowsDownload', '<CopyButton', 'useCopyInstall' and 'tag.command'; COPY.priceTag.command === 'npx claude-code-session-manager@latest'; FilmDialog.tsx contains '<MacDownload' and '<WindowsDownload' and does NOT match /npx|CopyButton|useCopyInstall|commandPrompt/. The old `not.toContain('npx')` on JSON.stringify(COPY) and the whole-page `not.toMatch(/npx|CopyButton.../)` are removed (replaced, not deleted silently).
- [ ] The test at ~line 284 (manual page has no 'npx claude-code-session-manager') is left unchanged and still passes; the rest of tests/open-core-positioning.test.ts passes (e.g. the only money figure is still $0 — '$' alone in commandPrompt is not a price).
- [ ] pnpm typecheck and `pnpm vitest run tests/open-core-positioning.test.ts` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/session-manager-landing/SessionManagerPage.tsx
- src/styles/session-manager-landing.css
- tests/open-core-positioning.test.ts

# Implementation notes

Read first (the landed code from npx-copy-primitive first):
- src/pages/session-manager-landing/CopyButton.tsx and the useCopyInstall block in src/pages/session-manager-landing/hooks.ts; COPY.priceTag in src/pages/session-manager-landing/copy.ts
- src/pages/session-manager-landing/SessionManagerPage.tsx lines 1-25 (imports) and 117-150 (PriceTag)
- src/styles/session-manager-landing.css lines 473-660 (price tag section, .smlp-dl buttons, .smlp-tag__note)
- tests/open-core-positioning.test.ts lines 40-70 (helpers prose/pageProse/PAGE_FILES) and 128-136
- Prior art: `git show 6d0e26f^:src/styles/session-manager-landing.css` around lines 571-650 for the removed .smlp-cmd/.smlp-copy/.smlp-tag__copy rules; `git show 6d0e26f^:src/pages/SessionManagerPage.tsx` lines 133-164 for the old PriceTag markup.

Steps:
1. SessionManagerPage.tsx: import { CopyButton } from './CopyButton.js' and add useCopyInstall to the './hooks.js' import list (keep it alphabetical). In PriceTag compute the status string and render the block described in AC 1. Keep the outer .smlp-tag__install group and its aria-label as is.
2. CSS: add the rules from AC 2 (adapt the 6d0e26f^ versions; .smlp-cmd ~8px 10px padding, mono 11.5px, ink background, paper text, nowrap + ellipsis on code; .smlp-npx flex column gap ~5px). The canvas is a fixed 1440x860 stage, so keep additions compact; the next PRD verifies fit with Playwright and may tune spacing.
3. Flip the vitest test per AC 3-4. Use the existing read()/prose() helpers; prose() may strip comments, so assert against source tokens that survive it (check what prose does before choosing).

Do not touch: FilmDialog.tsx, Downloads.tsx, e2e/ (next PRD owns e2e/session-manager-landing.spec.ts), copy.ts/hooks.ts/CopyButton.tsx (landed by previous PRD — only fix them if typecheck forces you, and say so).

# Out of scope

- Film end card, /projects hub card, Field Manual page stay installer-only
- Playwright e2e changes
- Deploying

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm vitest run tests/open-core-positioning.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
