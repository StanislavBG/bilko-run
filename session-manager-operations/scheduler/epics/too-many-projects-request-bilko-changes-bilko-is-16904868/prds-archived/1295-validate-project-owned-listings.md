---
title: Validate: sibling projects own their /projects card content via the bilko-host MCP; Bilko enforces ownership, visibility and standards
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:20:14.293Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
tag: build
agentType: validator
dependsOn: [listing-schema-standards, listing-migrate-enrich, listing-patch-primitive, listing-migrate-promo, slug-ownership-primitive, mcp-update-project-listing-tool, mcp-enforce-ownership-and-visibility, mcp-publish-syncs-listing-file, docs-project-owned-listings]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

validate. Verify the plan: 1286 listing-schema-standards; 1287 listing-migrate-enrich; 1288 listing-patch-primitive; 1289 listing-migrate-promo; 1290 slug-ownership-primitive; 1291 mcp-update-project-listing-tool; 1292 mcp-enforce-ownership-and-visibility; 1293 mcp-publish-syncs-listing-file; 1294 docs-project-owned-listings.

# Acceptance criteria

- [ ] 1286-listing-schema-standards.md (session-manager-operations/scheduler/epics/too-many-projects-request-bilko-changes-bilko-is-16904868/prds/ or prds-archived/) VERIFIED or REFUTED.
- [ ] 1287-listing-migrate-enrich.md VERIFIED or REFUTED; /projects card output for the 8 formerly-ENRICHed slugs unchanged.
- [ ] 1288-listing-patch-primitive.md VERIFIED or REFUTED.
- [ ] 1289-listing-migrate-promo.md VERIFIED or REFUTED; GET /api/projects body unchanged except generated_at.
- [ ] 1290-slug-ownership-primitive.md VERIFIED or REFUTED.
- [ ] 1291-mcp-update-project-listing-tool.md VERIFIED or REFUTED.
- [ ] 1292-mcp-enforce-ownership-and-visibility.md VERIFIED or REFUTED; no MCP write path lets one repo change another slug or set public.
- [ ] 1293-mcp-publish-syncs-listing-file.md VERIFIED or REFUTED.
- [ ] 1294-docs-project-owned-listings.md VERIFIED or REFUTED; docs match landed code.
- [ ] Record written and committed at session-manager-operations/reviews/validation/too-many-projects-request-bilko-changes-bilko-is-16904868/validate-project-owned-listings.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/too-many-projects-request-bilko-changes-bilko-is-16904868/validate-project-owned-listings.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 2631da88e8a28b212c79516f5adef907fad05837
PRD files live under $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/too-many-projects-request-bilko-changes-bilko-is-16904868/prds/ while queued, prds-archived/ (possibly a timestamped subfolder) once done; find each by slug.
For 1287/1289 parity, compare HUB_CARDS / CATALOG_PROJECTS built at Base vs HEAD (e.g. a tsx script run in a temp worktree of Base).

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
