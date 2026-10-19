---
title: primitive: npx install copy keys, useCopyInstall hook and CopyButton for the Session Manager price tag
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-10T20:35:50.883Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
agentType: dev-lead
planId: pl-mv2utb6r-b533e1
---
# Goal

primitive. The owner wants the `npx claude-code-session-manager@latest` one-liner back on the bilko.run/products/session-manager price tag as a third install option with a Copy button. This PRD restores the building blocks only (copy strings, a single-source copy hook, and the stacked-label CopyButton) that commit 6d0e26f removed; the next PRD wires them into PriceTag().

# Acceptance criteria

- [ ] src/pages/session-manager-landing/copy.ts COPY.priceTag gains keys: commandPrompt "$", command "npx claude-code-session-manager@latest", copyLabel "Copy the install command", copiedLabel "Copied — now paste it in your terminal", copyFailedLabel "Couldn't copy — select it above", commandNote "Node 22.12+, Claude Code signed in? Paste & go."; and COPY.priceTag.aria gains commandBox "Install command", copiedStatus "Install command copied to your clipboard.", copyFailedStatus "Couldn't copy automatically. Select the command and copy it yourself." All existing keys (note, unsignedNote, downloads, aria.region/platforms/platformsWindowsSoon/downloads) are unchanged.
- [ ] src/pages/session-manager-landing/hooks.ts exports `type CopyStatus = 'idle' | 'copied' | 'failed'`, `interface CopyInstall { status: CopyStatus; copy: () => void; codeRef: RefObject<HTMLElement> }` and `useCopyInstall(): CopyInstall`, which writes COPY.priceTag.command via navigator.clipboard.writeText, sets 'copied' only after it resolves (reset to 'idle' after 2200ms), and on a missing/rejected clipboard API selects codeRef's contents and tries document.execCommand('copy'), settling 'copied' or 'failed' (failed resets after 4000ms). The timer is cleared on unmount. There is NO 'end'/'tag' source parameter.
- [ ] New file src/pages/session-manager-landing/CopyButton.tsx exports `CopyButton({ copier, labels: { copy, copied, failed }, className })`: a type="button" <button className={`smlp-copy ${className}`} data-state=...> whose click calls e.stopPropagation() then copier.copy(), rendering all three labels as <span className="smlp-copy__label" data-on={bool}> siblings (stacked in one grid cell by CSS so its size never changes).
- [ ] Nothing imports the new hook or component yet except where needed for typecheck; FilmDialog.tsx, Downloads.tsx and SessionManagerPage.tsx are untouched.
- [ ] pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/session-manager-landing/copy.ts
- src/pages/session-manager-landing/hooks.ts
- src/pages/session-manager-landing/CopyButton.tsx

# Implementation notes

Read first:
- `git show 6d0e26f^:src/pages/session-manager-landing/CopyButton.tsx` (prior art; drop its `from`/CopySource prop and the end-card comment)
- `git show 6d0e26f^:src/pages/session-manager-landing/hooks.ts` (useCopyInstall + selectContents, near the bottom; drop the 'end' source, endCodeRef and the flushSync branch; read the command from COPY.priceTag.command instead of COPY.meta.installCommand)
- `git show 6d0e26f^:src/pages/session-manager-landing/copy.ts` lines 56-74 (old priceTag strings)
- src/pages/session-manager-landing/copy.ts lines 55-90 (current priceTag block; it is a JSON-style object literal with quoted keys — keep that style and the `// flip to true...` comment)

Steps:
1. copy.ts: insert commandPrompt, command, copyLabel, copiedLabel, copyFailedLabel, commandNote just before the existing "note" key; append commandBox, copiedStatus, copyFailedStatus to priceTag.aria after "downloads".
2. hooks.ts: add CopyStatus, CopyInstall, a private selectContents(el) helper and useCopyInstall() just above `prefersReducedMotion`. hooks.ts already imports useCallback/useEffect/useRef/useState/RefObject and COPY.
3. Create CopyButton.tsx as described; doc comment says the three labels share one grid cell so the price tag never changes height, and hidden labels use visibility:hidden (dropping them from the accessible name).

Do not touch: SessionManagerPage.tsx, src/styles/session-manager-landing.css, tests/, e2e/ (later PRDs own them). Note: tests/open-core-positioning.test.ts currently asserts `JSON.stringify(COPY)` has no 'npx' — that test WILL fail after this PRD; it is flipped by the next PRD (npx-price-tag-wire). Do not run or edit it here; the gate is typecheck only.

# Out of scope

- Rendering anything on the page
- CSS
- Test changes
- FilmDialog end card, /projects hub card, Field Manual page

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
