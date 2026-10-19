---
title: behavior: Playwright proves the price-tag npx Copy button works and fits canvas + mobile layouts
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T20:37:09.275Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
agentType: dev-lead
dependsOn: [npx-price-tag-wire]
planId: pl-mv2utb6r-b533e1
---
# Goal

behavior. The price tag on /products/session-manager now shows an npx one-liner with a Copy button (landed by npx-price-tag-wire). Flip the Playwright assertion that forbids 'npx' on the page into positive coverage: exact command shown, keyboard-accessible Copy button that writes the command to the clipboard and swaps to the copied label without changing the tag's height, and the tag still fits the 1440x860 canvas and the 390x844 reflow layout. Tune CSS spacing only if the fit checks fail.

# Acceptance criteria

- [ ] e2e/session-manager-landing.spec.ts canvas test (~line 120): `expect(page.locator('body')).not.toContainText('npx')` is replaced by: the price-tag region contains the exact text 'npx claude-code-session-manager@latest' and has a button named 'Copy the install command'.
- [ ] A new Playwright test (canvas 1440x860, context granted clipboard-read and clipboard-write permissions for the baseURL origin) focuses the Copy button with the keyboard (Tab/focus + Enter), then asserts navigator.clipboard.readText() === 'npx claude-code-session-manager@latest', the button shows 'Copied — now paste it in your terminal', the role=status element in the tag contains 'Install command copied to your clipboard.', and the .smlp-tag bounding-box height is identical before and after the click.
- [ ] Layout: at 1440x860 the .smlp-tag bounding box bottom is inside the .smlp-canvas box and does not overlap the .smlp-turn--next button; at 390x844 (reflow) the command box and Copy button are visible within the tag and noHorizontalScroll(page) passes. If either fails, spacing in src/styles/session-manager-landing.css is tightened (price-tag rules only) until it passes.
- [ ] The end-card assertions (~lines 497-505: end has no 'npx' and no install-command button), the manual page assertion (~284) and hub card assertion (~326) are unchanged and pass.
- [ ] `pnpm exec playwright test e2e/session-manager-landing.spec.ts` passes in full.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- e2e/session-manager-landing.spec.ts
- src/styles/session-manager-landing.css

# Implementation notes

Read first (landed code first):
- src/pages/session-manager-landing/SessionManagerPage.tsx PriceTag() and the .smlp-npx/.smlp-cmd/.smlp-copy rules in src/styles/session-manager-landing.css
- e2e/session-manager-landing.spec.ts lines 1-140 (imports COPY, open(), noHorizontalScroll(), canvas test) and 138-180 (reflow test), 490-510 (end card)
- playwright.config.ts (baseURL http://localhost:3002, webServer `pnpm dev`, reuseExistingServer)

Steps:
1. Edit the canvas test assertion per AC 1 using COPY.priceTag.command and COPY.priceTag.copyLabel (and the tag region locator already defined there: page.getByRole('region', { name: COPY.priceTag.aria.region })).
2. Add the copy test: `await context.grantPermissions(['clipboard-read','clipboard-write'], { origin: 'http://localhost:3002' })` (use the test's `context` fixture), page.setViewportSize 1440x860, open(page). Measure tag height via boundingBox before and after. Focus the button via `button.focus()` then `page.keyboard.press('Enter')`. Read clipboard with page.evaluate(() => navigator.clipboard.readText()). Use expect.poll / toHaveText for the label swap (it resets after 2200ms, so assert promptly).
3. Add the layout checks from AC 3 into the existing canvas and reflow tests (or a small new test each). Optional: page.screenshot to test-results/ for the validator (light theme only; the page has no dark theme).
4. Run the spec once red-first is not required here (assertions are about existing behavior); run the full spec file last.

Do not touch: SessionManagerPage.tsx, copy.ts, hooks.ts, CopyButton.tsx, tests/ (vitest). CSS changes only if a fit check fails, limited to .smlp-tag*/.smlp-npx/.smlp-cmd/.smlp-copy rules.

# Out of scope

- Changing the end card, manual or hub assertions
- Deploying

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 600 pnpm exec playwright test e2e/session-manager-landing.spec.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
