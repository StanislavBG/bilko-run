---
title: host-contract.md: document the marketing listing fields and catalog additions
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-13T03:52:14.213Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [catalog-marketing-fields]
planId: pl-mv653d38-529056
---
# Goal

doc: update docs/host-contract.md so sibling sessions know they own and should fill the new listing fields (offering, pricing, callToAction, avoidClaims), and so catalog consumers like Burrow know the four new catalog fields and that avoid_claims is binding.

# Acceptance criteria

- [ ] docs/host-contract.md "Project listing — who owns what" section: the Project row lists `offering`, `pricing`, `callToAction`, `avoidClaims` inside `listing`, and the limits table has rows for each (enum values for offering and pricing; callToAction 1–120 chars; avoidClaims up to 5, each 1–200 chars).
- [ ] The same section has a short subsection "Marketing meta-categories" defining each `offering` value in one line (notably `showcase` = a personal portfolio/presentation layer, not a product others sign up for; `saas` = others can sign up and use it with their own data) and stating `avoidClaims` are claims promoters must never make.
- [ ] The bilko.listing.json example in that section includes `offering`, `pricing` and `callToAction`.
- [ ] "Public project catalog" section lists `offering`, `pricing`, `call_to_action`, `avoid_claims` in the field list/example, notes '' / [] when unset, and states they are additive under schema_version 1.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/host-contract.md

# Implementation notes

Read first: docs/host-contract.md lines 100-200; the landed mcp-host-server/src/contract/registry.ts `ListingSchema` and src/data/projectCatalog.ts `CatalogProject` (use the exact names and limits there, not this PRD's text, if they differ).
Steps: edit only the two sections named in the AC. Plain, short sentences matching the doc's existing tone.

# Out of scope

- CLAUDE.md or README edits
- Any code change

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 grep -q avoid_claims docs/host-contract.md && timeout 30 grep -q callToAction docs/host-contract.md && timeout 30 grep -q showcase docs/host-contract.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
