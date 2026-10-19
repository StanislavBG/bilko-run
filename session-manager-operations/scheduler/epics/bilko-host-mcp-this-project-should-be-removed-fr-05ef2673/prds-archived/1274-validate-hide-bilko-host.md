---
title: Validate: Bilko Host MCP no longer appears on the public /projects listing
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-12T05:23:03.988Z
sourcePromptId: bilko-host-mcp-this-project-should-be-removed-fr-05ef2673
tag: build
agentType: validator
dependsOn: [hide-bilko-host-from-projects]
planId: pl-mv4t1ngy-6164e0
---
# Goal

validate: Verify the plan for hiding Bilko Host MCP from the public listing: hide-bilko-host-from-projects ("Hide Bilko Host MCP from the public /projects listing").

# Acceptance criteria

- [ ] hide-bilko-host-from-projects: every acceptance criterion in $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/bilko-host-mcp-this-project-should-be-removed-fr-05ef2673/prds/1273-hide-bilko-host-from-projects.md (or its prds-archived/ copy, found by slug) holds in the tree and its gate re-runs green.
- [ ] Write and commit session-manager-operations/reviews/validation/bilko-host-mcp-this-project-should-be-removed-fr-05ef2673/validate-hide-bilko-host.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/bilko-host-mcp-this-project-should-be-removed-fr-05ef2673/validate-hide-bilko-host.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 2d781ec5c830075f85424cd778deaa95789544d1

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
