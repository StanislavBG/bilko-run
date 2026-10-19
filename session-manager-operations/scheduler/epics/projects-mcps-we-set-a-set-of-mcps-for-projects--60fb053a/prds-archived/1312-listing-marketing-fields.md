---
title: Registry listing: add marketing meta-categories (offering, pricing, callToAction, avoidClaims)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:46:54.596Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
planId: pl-mv653d38-529056
---
# Goal

primitive: extend the registry `ListingSchema` with four optional, project-owned marketing fields so social pipelines (Burrow) know what kind of thing each project is and what to say or not say about it. Today a personal showcase (e.g. git-viewer) and a paid SaaS look identical to a consumer — only free-text detail/audience/talkingPoints exist. Because `listing` is already a project-owned field, sibling repos can set these through the existing `update_project_listing` MCP tool and `bilko.listing.json` with no other wiring.

# Acceptance criteria

- [ ] mcp-host-server/src/contract/registry.ts `ListingSchema` accepts optional `offering` = z.enum(['saas','free-tool','showcase','open-source','game','content','experiment']), `pricing` = z.enum(['free','freemium','paid','none']), `callToAction` = z.string().min(1).max(120), `avoidClaims` = z.array(z.string().min(1).max(200)).max(5); the schema stays `.strict()` and every existing registry entry in src/data/standalone-projects.json still validates.
- [ ] `listingTextFields` in registry.ts scans `listing.callToAction` and each `listing.avoidClaims[i]` for BANNED_LISTING_TERMS, so a ContentGrade mention there fails with the slug and field path.
- [ ] The `update_project_listing` tool description string in mcp-host-server/src/server.ts lists the four new listing keys alongside detail,metric,metricLabel,lang,audience,talkingPoints.
- [ ] tests/registry-contract.test.ts has new tests: valid values for all four fields parse; an unknown `offering` value, a 121-char callToAction and 6 avoidClaims are each rejected; a ContentGrade mention in avoidClaims is rejected.
- [ ] mcp-host-server/dist/ is rebuilt with `pnpm --dir mcp-host-server build` and committed so tests/mcp-dist-sync.test.ts passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/contract/registry.ts
- mcp-host-server/src/server.ts
- mcp-host-server/dist/
- tests/registry-contract.test.ts

# Implementation notes

Read first: mcp-host-server/src/contract/registry.ts (whole file, 137 lines); mcp-host-server/src/listing-patch.ts lines 1-30 (listing is already in PROJECT_OWNED_FIELDS — no change needed there); mcp-host-server/src/server.ts lines 275-290; tests/registry-contract.test.ts (existing style).
Steps:
1. registry.ts: add the four optional keys to `ListingSchema` (exact zod shapes in the AC). Export `ListingOfferingSchema` and `ListingPricingSchema` enums so the UI can reuse them.
2. registry.ts `listingTextFields`: add 'callToAction' to the scalar loop and push each avoidClaims entry as `listing.avoidClaims[i]` (mirror the talkingPoints line).
3. server.ts line ~282: update the description text to `listing{detail,metric,metricLabel,lang,audience,talkingPoints,offering,pricing,callToAction,avoidClaims}` and add one sentence: "offering/pricing/callToAction/avoidClaims tell promoters (e.g. Burrow) what kind of project this is, what the reader should do, and claims never to make."
4. Write the tests first (red), then implement. 
5. Run `pnpm --dir mcp-host-server build` and commit mcp-host-server/dist/ changes with the src change.
src/data/projectsRegistry.ts re-exports the `Listing` type from this schema, so the client picks the new fields up automatically — do not edit it.

# Out of scope

- Changing any registry entry's data in src/data/standalone-projects.json
- Public catalog / API output (separate PRD)
- docs/host-contract.md (separate PRD)
- Making these fields required

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/registry-contract.test.ts tests/mcp-dist-sync.test.ts tests/mcp-listing-patch.test.ts tests/mcp-listing-tool.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
