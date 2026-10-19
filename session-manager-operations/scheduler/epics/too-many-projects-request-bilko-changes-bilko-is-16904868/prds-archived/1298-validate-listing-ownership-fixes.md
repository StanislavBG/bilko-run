---
title: Validate: publish checks ownership before running gates, listing tool accepts deletes/url, trust model documented
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:48:17.067Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
tag: build
agentType: validator
dependsOn: [mcp-early-owner-check-and-patch-wire, docs-ownership-trust-model]
planId: pl-mv5ynlw6-df564a
---
# Goal

validate. Verify the fix wave for the project-owned listings plan: 1296 mcp-early-owner-check-and-patch-wire; 1297 docs-ownership-trust-model.

# Acceptance criteria

- [ ] 1296-mcp-early-owner-check-and-patch-wire.md (session-manager-operations/scheduler/epics/too-many-projects-request-bilko-changes-bilko-is-16904868/prds/ or prds-archived/) VERIFIED or REFUTED; a non-owner publish is refused before any gate command runs.
- [ ] 1297-docs-ownership-trust-model.md VERIFIED or REFUTED; docs match the landed update_project_listing schema.
- [ ] Record written and committed at session-manager-operations/reviews/validation/too-many-projects-request-bilko-changes-bilko-is-16904868/validate-listing-ownership-fixes.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/too-many-projects-request-bilko-changes-bilko-is-16904868/validate-listing-ownership-fixes.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: ba3471f
Prior plan record (for context on the findings being fixed): session-manager-operations/reviews/validation/too-many-projects-request-bilko-changes-bilko-is-16904868/validate-project-owned-listings.md (Important 1-2, Minor 1-3).

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
