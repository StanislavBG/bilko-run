---
title: bug: price-tag keyboard Copy e2e test fails at the role=status check (validator REFUTED npx-price-tag-e2e)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T21:59:22.341Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
tag: bug
agentType: dev-lead
disposition: new-head
planId: pl-mv2xsq1x-5e7a1a
---
# Goal

behavior. The test 'price tag Copy button is keyboard-accessible and copies the npx command' in e2e/session-manager-landing.spec.ts (~line 178) fails 4/4: after focus + Enter, `tag.getByRole('status')` stays "" instead of 'Install command copied to your clipboard.'. On live bilko.run with real Chromium the same flow works (clipboard holds the command, status announces, tag height unchanged), so find whether this is a test bug or a product bug, fix the real cause, and make the assertion on the label swap non-vacuous.

# Acceptance criteria

- [ ] The root cause of the empty role=status in the test is identified and stated in the commit body (e.g. clipboard permission origin mismatch so writeText rejects and the fallback path sets 'failed', a different status element matched, or Enter not activating the button).
- [ ] If the cause is a product bug in src/pages/session-manager-landing/hooks.ts (useCopyInstall) or SessionManagerPage.tsx PriceTag, it is fixed there; otherwise only the test changes. The test is not skipped, loosened to accept 'failed', or deleted.
- [ ] `expect(button).toContainText(copiedLabel)` is replaced with a non-vacuous check: `expect(button).toHaveAttribute('data-state', 'copied')` (CopyButton sets data-state) and/or the visible label span `[data-on="true"]` has the copied text.
- [ ] The test still asserts the status text, the clipboard contents === COPY.priceTag.command and equal .smlp-tag height before/after, and passes with `--repeat-each=3`.
- [ ] `pnpm exec playwright test e2e/session-manager-landing.spec.ts` passes in full (if the two known load-sensitive tests 'reduced motion the turn completes within 400ms' and 'seek drag … time readout' flake, re-run once and report; do not edit them).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- e2e/session-manager-landing.spec.ts
- src/pages/session-manager-landing/hooks.ts
- src/pages/session-manager-landing/SessionManagerPage.tsx

# Implementation notes

Read first:
- e2e/session-manager-landing.spec.ts lines 1-90 (open(), helpers) and 176-197 (the failing test)
- src/pages/session-manager-landing/hooks.ts lines 120-190 (useCopyInstall: writeText then fallback selectContents + execCommand, settles 'copied'/'failed')
- src/pages/session-manager-landing/CopyButton.tsx (data-state, stacked labels with data-on)
- src/pages/session-manager-landing/SessionManagerPage.tsx lines 117-160 (PriceTag; the only role=status on the page is at ~155)
- playwright.config.ts (baseURL http://localhost:3002, webServer `pnpm dev`, reuseExistingServer)

Debug steps: run only this test with `--repeat-each=1` and add temporary console logging via page.on('console') / page.evaluate to see copier state (data-state on the button after Enter), whether navigator.clipboard.writeText resolves, and the origin (page.evaluate(() => location.origin)) vs the grantPermissions origin. Check whether the dev server redirects or serves on 127.0.0.1 vs localhost. A likely fix is granting permissions without an origin or with `new URL(page.url()).origin` after open(). Remove temporary logging before committing.

Do not touch: tests/ (vitest), vitest.config.ts, server/ — another PRD (repair-vitest-sqlite-busy) owns those. Do not push; commit only.

# Out of scope

- The two load-sensitive tests unrelated to npx
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
