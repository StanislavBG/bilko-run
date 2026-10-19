---
title: Validate: projects carry marketing meta-categories, admins can inspect them, and rows open in one click
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:54:05.002Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
tag: build
agentType: validator
dependsOn: [listing-marketing-fields, projects-row-open-button, catalog-marketing-fields, projects-admin-metadata-panel, doc-listing-marketing-fields]
planId: pl-mv653d38-529056
---
# Goal

validate: verify the plan — listing-marketing-fields (registry listing marketing fields), projects-row-open-button (Open button on collapsed rows), catalog-marketing-fields (public catalog + /mcp fields), projects-admin-metadata-panel (admin metadata panel), doc-listing-marketing-fields (host-contract docs).

# Acceptance criteria

- [ ] listing-marketing-fields: every AC in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a/prds/1312-listing-marketing-fields.md (or prds-archived/) holds in the tree and its gate passes.
- [ ] projects-row-open-button: every AC in .../prds/1314-projects-row-open-button.md (or prds-archived/) holds and its gate passes.
- [ ] catalog-marketing-fields: every AC in .../prds/1315-catalog-marketing-fields.md (or prds-archived/) holds and its gate passes.
- [ ] projects-admin-metadata-panel: every AC in .../prds/1317-projects-admin-metadata-panel.md (or prds-archived/) holds and its gate passes.
- [ ] doc-listing-marketing-fields: every AC in .../prds/1319-doc-listing-marketing-fields.md (or prds-archived/) holds and its gate passes.
- [ ] Write and commit session-manager-operations/reviews/validation/projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a/validate-projects-metadata.md with one verdict per PRD and any findings from the combined diff.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a/validate-projects-metadata.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 7dc9cf91eabaf4cc01a7dc2d831eb2daba68d844
PRD files live under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a/ (prds/ while queued, prds-archived/ once done — find each by slug). Also run the full `timeout 600 pnpm test` once to catch cross-PRD breakage (e.g. mcp-dist-sync).

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
