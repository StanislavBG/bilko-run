---
title: Docs: state the bilko-host ownership trust model (self-asserted repo path, local-only)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-13T00:46:56.085Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [mcp-early-owner-check-and-patch-wire]
planId: pl-mv5ynlw6-df564a
---
# Goal

doc. The validator found that slug ownership compares a caller-supplied repo path with host.localPath, which stops mistakes but not a hostile local session, and the docs don't say so. State the real trust boundary plainly so nobody mistakes the path check for authentication.

# Acceptance criteria

- [ ] docs/host-contract.md section `## Project listing — who owns what` has a `### Trust model` subsection saying: the ownership check compares a self-asserted callerRepoPath/sourceRepoPath with host.localPath, which guards against one project's session editing another by mistake, not against a hostile session; the real boundary is that write tools exist only in the local stdio bilko-host MCP on the owner's machine and push with the owner's GitHub access to StanislavBG/bilko-run; the public https://bilko.run/mcp is read-only.
- [ ] The same subsection notes that a leading `~` in callerRepoPath is expanded to the home directory before the absolute-path check.
- [ ] mcp-host-server/README.md Safety notes has one bullet with the same trust-model statement, linking to that host-contract subsection.
- [ ] The docs' statements about `null` deletes and `url` for external-url entries match the landed update_project_listing input schema in mcp-host-server/src/server.ts (read it; edit the docs only if they disagree).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/host-contract.md
- mcp-host-server/README.md

# Implementation notes

Depends on mcp-early-owner-check-and-patch-wire (widens update_project_listing's patch to accept null and url) — read the landed server.ts update_project_listing registration first.
Read first: docs/host-contract.md section `## Project listing — who owns what` (around lines 100-150); mcp-host-server/README.md `## Safety notes`; mcp-host-server/src/ownership.ts.
Plain sentences, no marketing tone. Do not touch any .ts file.

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
