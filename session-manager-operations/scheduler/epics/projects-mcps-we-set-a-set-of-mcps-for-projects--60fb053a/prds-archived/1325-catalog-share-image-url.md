---
title: Public catalog: expose each project's share_image_url
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-13T03:59:40.351Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [catalog-marketing-fields]
planId: pl-mv653d38-529056
---
# Goal

wire: add `share_image_url` (`https://bilko.run/og/<slug>.png`) to every project in GET /api/projects and the /mcp tools, so promoters like Burrow can attach or preview the project's own X card image. Additive; schema_version stays 1.

# Acceptance criteria

- [ ] src/data/projectCatalog.ts `CatalogProject` gains `share_image_url: string` set to `${SITE_ORIGIN}/og/${slug}.png` in `toCatalogProject`; `CATALOG_SCHEMA_VERSION` stays 1.
- [ ] tests/project-catalog.test.ts `FIELDS` includes `share_image_url` and a test asserts each public project's value equals `https://bilko.run/og/<slug>.png`.
- [ ] The header doc comment in projectCatalog.ts notes that X unfurls the project url's og:image automatically, so share_image_url is for previews/attachments only.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectCatalog.ts
- tests/project-catalog.test.ts

# Implementation notes

Read first: src/data/projectCatalog.ts (whole; PRD catalog-marketing-fields already added offering/pricing/call_to_action/avoid_claims — keep them); tests/project-catalog.test.ts.
Steps: red test, then add the field. No route change needed (server/routes/project-catalog.ts serializes the catalog whole).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/project-catalog.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
