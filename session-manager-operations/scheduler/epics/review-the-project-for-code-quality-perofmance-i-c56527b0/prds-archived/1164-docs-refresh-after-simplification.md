---
title: Docs catch up: CLAUDE.md, README and host-internals describe the simplified codebase
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:18:35.334Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [validate-blog-files-db, validate-tool-gateways, validate-server-fixes, validate-frontend-simplification, manifest-schema-unify, typecheck-scripts]
planId: pl-mv1kvwvg-fc3c17
---
# Goal

doc. After this wave, several documented facts change. Blog posts live in content/blog/, not server/db.ts. Schema is in server/db-schema.ts. AI-tool gateways use shared helpers. Session Manager pages sit in src/pages/session-manager-landing/. /projects visibility comes from the registry's `public` field. `pnpm typecheck` covers scripts. Update CLAUDE.md, README.md and docs/host-internals.md, which also has stale lines: test-results/ is not committed (~91), and the schedules note (~24, ~109) points at ~/.claude PRD files.

# Acceptance criteria

- [ ] CLAUDE.md is accurate on every point listed in the goal: the Blog section says posts are content/blog/<slug>.md (link content/blog/README.md); Backend Patterns lists server/db-schema.ts and the _shared.ts helpers (freeTierGate, creditGate, askGeminiJson, toolErrorReply); the sanctioned Session Manager paths reflect the moved pages; the Testing counts come from a fresh `pnpm vitest run`.
- [ ] README.md's 'Where things live' table and the 'add a blog post' guidance match the new layout, in plain language for a non-developer, with a one-line 'how to make a project public' (set `public: true` in the registry entry via the bilko-host MCP).
- [ ] docs/host-internals.md's stale lines are corrected or removed.
- [ ] Every path named in the three files exists (checked with ls; report any misses).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- CLAUDE.md
- README.md
- docs/host-internals.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read the landed tree, not memory: `ls content/blog server src/pages/session-manager-landing`, server/routes/tools/_shared.ts exports, package.json typecheck, the four validation records under session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/. Do not touch: code, other docs.

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
