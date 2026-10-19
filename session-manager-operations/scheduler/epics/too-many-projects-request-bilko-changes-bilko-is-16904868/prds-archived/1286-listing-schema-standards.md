---
title: Registry schema: project-owned `listing` block + content standards caps
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:10:42.099Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

primitive. Bilko's /projects card content (drawer story, metric, audience, talking points) is hardcoded in host source, so every sibling project has to ask Bilko for a change. This PRD adds an optional, project-owned `listing` object to the registry schema and enforces content standards (length caps, banned terms, link format) on every registry entry, so later PRDs can move that content into the registry and let siblings edit it through the bilko-host MCP. It also backfills `host.localPath` (the ownership key used later) on entries that lack it.

# Acceptance criteria

- [ ] mcp-host-server/src/contract/registry.ts exports `ListingSchema` (strict zod object, all fields optional): `detail` string 1-400, `metric` string 1-24, `metricLabel` string 1-24, `lang` string 1-40, `audience` string 0-200, `talkingPoints` array of 1-200-char strings, max 5 items; and `RegistryProjectSchema` gains `listing: ListingSchema.optional()`.
- [ ] RegistryProjectSchema enforces caps: `name` 1-40, `tagline` 1-160, `category` 1-40, `tags` max 6 items each 1-24 chars, `thumbnail` must start with `https://` or `/`.
- [ ] RegistrySchema superRefine rejects any entry whose name, displayName, tagline, category, tags or any listing string matches /content-?grade/i, with a message naming the slug and field.
- [ ] src/data/standalone-projects.json still parses; entries session-manager, fizzpop, bilko-host, sigma, bilko-flow, bglabs gain `host.localPath` values `~/Projects/session-manager`, `~/Projects/Bilko-Fizzpop`, `~/Projects/Bilko`, `~/Projects/sigma`, `~/Projects/bilko-flow`, `~/Projects/BGLabs` respectively.
- [ ] tests/registry-contract.test.ts has new tests: a valid listing parses; each cap (tagline 161 chars, 7 tags, 6 talking points, detail 401 chars) is rejected; a ContentGrade mention in listing.detail is rejected; a thumbnail `http://x` is rejected.
- [ ] mcp-host-server/dist/ is rebuilt (`pnpm --dir mcp-host-server build`) and committed so tests/mcp-dist-sync.test.ts passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/contract/registry.ts
- mcp-host-server/dist/
- src/data/standalone-projects.json
- tests/registry-contract.test.ts

# Implementation notes

Read first: mcp-host-server/src/contract/registry.ts (whole file, ~95 lines; `RegistryProjectSchema` at ~line 40, `RegistrySchema` superRefine below it); tests/registry-contract.test.ts (whole file); src/data/standalone-projects.json (JSON array of entries).
Steps:
1. In registry.ts add `export const ListingSchema = z.object({...}).strict()` per the AC, then add `listing: ListingSchema.optional()` to `RegistryProjectSchema` and tighten the existing fields (`name: z.string().min(1).max(40)`, `tagline: z.string().min(1).max(160)`, `category: z.string().min(1).max(40)`, `tags: z.array(z.string().min(1).max(24)).max(6).optional()`, `thumbnail: z.string().refine(s => s.startsWith('https://') || s.startsWith('/'), 'thumbnail must be https:// or a /path').optional()`). Export `type Listing = z.infer<typeof ListingSchema>`.
2. In the `RegistrySchema` superRefine loop, add a banned-term check: collect name, displayName, tagline, category, each tag, and every string in entry.listing (including talkingPoints items); if any matches /content-?grade/i add an issue `slug "<slug>" field "<field>" mentions a retired product (ContentGrade)`. Export the regex as `BANNED_LISTING_TERMS` (array of RegExp) so it can be extended.
3. Current data max lengths: name 21, tagline 99, category 24, tags 5 items x 18 chars — all within the caps. If the real registry still fails a cap, raise that one cap to the smallest multiple of 10 that passes and note it in your report; never edit an entry's copy to fit.
4. Edit standalone-projects.json: add the six `host.localPath` values in the AC (keep 2-space JSON formatting, key order as existing entries: localPath after sourceRepo/url).
5. Write the tests (red first), then `pnpm --dir mcp-host-server build` to refresh mcp-host-server/dist/.
Do not touch: src/data/projectsView.ts, src/data/projectCatalog.ts, mcp-host-server/src/server.ts (later PRDs own them).

# Out of scope

- Moving ENRICH/PROMO data into the registry (next PRDs)
- Any new MCP tool

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --dir mcp-host-server build && timeout 300 pnpm vitest run tests/registry-contract.test.ts tests/mcp-dist-sync.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
