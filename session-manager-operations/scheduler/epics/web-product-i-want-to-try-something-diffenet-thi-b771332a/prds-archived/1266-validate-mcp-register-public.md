---
title: Validate: bilko-host register_static_project can list a new app on the public /projects hub
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T07:40:32.925Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
tag: build
agentType: validator
dependsOn: [mcp-register-entry-builder, mcp-register-public-flag]
planId: pl-mv3ifdyr-cbe8da
---
# Goal

validate: verify the plan that lets the bilko-host MCP register an app as publicly listed — mcp-register-entry-builder (pure buildStaticEntry helper with public/displayName, tests, rebuilt dist) and mcp-register-public-flag (register_static_project inputs, corrected description, host-contract doc, rebuilt dist).

# Acceptance criteria

- [ ] Each PRD file is at $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/web-product-i-want-to-try-something-diffenet-thi-b771332a/prds/<NN>-<slug>.md while queued, or under prds-archived/ (possibly a timestamped subfolder) once done; find each by slug.
- [ ] mcp-register-entry-builder: VERIFIED or REFUTED against its own criteria and gate.
- [ ] mcp-register-public-flag: VERIFIED or REFUTED against its own criteria and gate (dist/server.js matches src per tests/mcp-dist-sync.test.ts; no inline entry literal left in the handler).
- [ ] session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-mcp-register-public.md is written and committed with one verdict line per PRD and any findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/web-product-i-want-to-try-something-diffenet-thi-b771332a/validate-mcp-register-public.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: da0047df4beb7741fa705736deaaf859c803c4b8

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
