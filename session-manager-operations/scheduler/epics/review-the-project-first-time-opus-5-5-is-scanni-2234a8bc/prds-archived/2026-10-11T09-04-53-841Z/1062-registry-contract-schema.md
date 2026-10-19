---
title: Registry contract: one zod schema for standalone-projects.json
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-04T08:55:34.872Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
planId: pl-mutl5nfc-6ec319
---
# Goal

primitive: create the single canonical, strongly typed contract for registry entries in src/data/standalone-projects.json. Right now the entry type is copied in 4 places and has drifted: the MCP type lacks status 'postponed', and the JSON has a `launchedAt` key that no type declares. Nothing validates the JSON at runtime, so a bad edit by a publishing agent only shows up when the UI breaks. This PRD adds the schema and a test that the real JSON passes it.

# Acceptance criteria

- [ ] New file mcp-host-server/src/contract/registry.ts exports zod schemas SlugSchema, ProjectStatusSchema, ProjectHostSchema, RegistryProjectSchema, RegistrySchema and inferred types Slug, ProjectStatus, RegistryProject; it imports only 'zod' (no node:fs, no MCP SDK)
- [ ] SlugSchema accepts 2-40 chars of [a-z0-9-] with no leading or trailing hyphen, and rejects '..', 'a', 'Foo', '-x', 'x-', 'a/b', and a 41-char string
- [ ] RegistrySchema rejects: a duplicate slug, a static-path entry whose host.path is not exactly `/projects/<slug>/`, an external-url host whose url is not https, and an entry with an unknown top-level key (strict objects)
- [ ] ProjectStatusSchema is exactly 'live' | 'cooking' | 'postponed' | 'archived', and RegistryProjectSchema allows optional launchedAt, tags, thumbnail
- [ ] New test tests/registry-contract.test.ts parses the real src/data/standalone-projects.json with RegistrySchema successfully and covers every rejection case above

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/contract/registry.ts
- tests/registry-contract.test.ts

# Implementation notes

Read first: src/data/projectsRegistry.ts lines 1-50 (current Project / ProjectHost / ProjectStatus types); mcp-host-server/src/server.ts lines 83-110 (MCP's drifted copy); shared/manifest-schema.ts lines 1-30 (zod style to match; its slug regex is /^[a-z0-9-]{2,40}$/); src/data/standalone-projects.json (27 entries; keys used: slug,name,tagline,category,status,year,host,tags,launchedAt).

Steps:
1. Create mcp-host-server/src/contract/registry.ts. Suggested slug regex: /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/. Host is a z.discriminatedUnion('kind', [...]) of {kind:'static-path', path, sourceRepo?, localPath?} and {kind:'external-url', url}. Do NOT include 'react-route' here — react-route entries come from src/config/tools.ts, not the JSON. Use .strict() on objects. Put the path-equals-`/projects/<slug>/` check and the unique-slug check in a superRefine on RegistrySchema (or the entry schema), with issue messages that name the offending slug — publishing agents read these messages.
2. If the real JSON fails on a field (e.g. launchedAt format), make the schema describe the real data (z.string() is fine for launchedAt) rather than editing the JSON.
3. Write tests/registry-contract.test.ts (vitest; import JSON via readFileSync + JSON.parse from the repo root path, like tests/games-page.test.ts does).

This file lives under mcp-host-server/src so the MCP server (whose tsconfig rootDir is mcp-host-server/src) can import it; the host app will import it as a type-only import in a later PRD.

Do not touch: mcp-host-server/src/server.ts, src/data/projectsRegistry.ts, mcp-host-server/dist/ (later PRDs wire and rebuild).

# Out of scope

- Wiring the schema into server.ts or projectsRegistry.ts
- Editing standalone-projects.json

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/registry-contract.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
