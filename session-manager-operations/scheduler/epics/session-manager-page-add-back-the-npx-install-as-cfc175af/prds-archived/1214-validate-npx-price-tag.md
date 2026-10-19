---
title: Validate: npx install is back on the Session Manager price tag with a working Copy button, live on bilko.run
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T20:37:50.641Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
tag: build
agentType: validator
dependsOn: [npx-copy-primitive, npx-price-tag-wire, npx-price-tag-e2e, npx-price-tag-deploy]
planId: pl-mv2utb6r-b533e1
---
# Goal

validate. Validates the plan: npx-copy-primitive (copy keys, useCopyInstall, CopyButton), npx-price-tag-wire (PriceTag renders npx box + Copy button, CSS, vitest flip), npx-price-tag-e2e (Playwright copy/layout coverage), npx-price-tag-deploy (pushed to origin main and verified live).

# Acceptance criteria

- [ ] npx-copy-primitive VERIFIED against $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/session-manager-page-add-back-the-npx-install-as-cfc175af/prds/1210-npx-copy-primitive.md (or its prds-archived/ copy, found by slug).
- [ ] npx-price-tag-wire VERIFIED against .../prds/1211-npx-price-tag-wire.md (or archived copy).
- [ ] npx-price-tag-e2e VERIFIED against .../prds/1212-npx-price-tag-e2e.md (or archived copy).
- [ ] npx-price-tag-deploy VERIFIED against .../prds/1213-npx-price-tag-deploy.md (or archived copy).
- [ ] Write and commit session-manager-operations/reviews/validation/session-manager-page-add-back-the-npx-install-as-cfc175af/validate-npx-price-tag.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/session-manager-page-add-back-the-npx-install-as-cfc175af/validate-npx-price-tag.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 9861fc8406293c0be5eb413a9404e62b0216221b
Owner acceptance to keep in mind: price tag shows Mac, Windows, then the npx one-liner with a working, keyboard-accessible Copy button whose status is announced and whose label swap never changes the tag height; it fits both the 1440x860 canvas and the 390x844 reflow layout; the film end card, Field Manual page and /projects hub card still have no npx.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
