---
title: bilko-host MCP: `applyListingPatch` — project-owned field allowlist
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T00:11:59.334Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [listing-schema-standards]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

primitive. Add a pure helper that applies a sibling's content patch to its registry entry, allowing only project-owned fields and rejecting host-owned ones (slug, host, year, public, launchedAt), then re-validating against the registry schema. This is the core of "the project owns its content, Bilko owns the listing and the standards".

# Acceptance criteria

- [ ] New file mcp-host-server/src/listing-patch.ts exports `PROJECT_OWNED_FIELDS` = ['name','displayName','tagline','category','tags','status','thumbnail','listing'] and `ListingPatchSchema` (strict zod object of exactly those keys, all optional, reusing the field schemas from RegistryProjectSchema via `.pick`).
- [ ] It exports `applyListingPatch(entry: RegistryProject, patch: unknown): RegistryProject` that throws an Error naming the offending keys when the patch contains any key outside PROJECT_OWNED_FIELDS (e.g. 'public', 'slug', 'host'), throws with the zod message when values break a cap, replaces `listing` wholesale when given (no deep merge), treats `null` for an optional field as delete, and returns a new object validated by RegistryProjectSchema.
- [ ] For an external-url entry, a patch key `url` (string) is allowed and sets host.url (https only); for static-path entries `url` is rejected.
- [ ] New tests in tests/mcp-listing-patch.test.ts cover: allowed patch applied; `public: true` rejected; `slug` rejected; tagline over 160 chars rejected; listing replaced not merged; null deletes displayName; url on external-url accepted and http:// rejected; url on static-path rejected; input entry not mutated.
- [ ] mcp-host-server/dist/ rebuilt and committed (tests/mcp-dist-sync.test.ts passes).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/listing-patch.ts
- mcp-host-server/dist/
- tests/mcp-listing-patch.test.ts

# Implementation notes

Depends on listing-schema-standards (adds ListingSchema + caps in mcp-host-server/src/contract/registry.ts) — read the landed registry.ts first.
Read first: mcp-host-server/src/contract/registry.ts (whole); mcp-host-server/src/server.ts lines 1-130 (imports, helper style, `buildStaticEntry`); tests/mcp-publish-request.test.ts (how tests import from mcp-host-server/src).
Steps:
1. Create mcp-host-server/src/listing-patch.ts with the exports in the AC. Use `structuredClone(entry)` for the copy. Validate the final object with `RegistryProjectSchema.parse`.
2. Unknown-key error text: `fields not owned by the project: public, slug — visibility and hosting are set by the Bilko owner, not by sibling sessions`.
3. Write tests/mcp-listing-patch.test.ts (red first), then `pnpm --dir mcp-host-server build`.
Do not touch: mcp-host-server/src/server.ts (wired later), src/data/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --dir mcp-host-server build && timeout 300 pnpm vitest run tests/mcp-listing-patch.test.ts tests/mcp-dist-sync.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
