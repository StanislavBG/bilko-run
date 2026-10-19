---
title: bilko-host MCP: pure buildStaticEntry helper that carries public and displayName into a registry entry
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-11T07:36:52.083Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
disposition: new-head
planId: pl-mv3ifdyr-cbe8da
---
# Goal

primitive: the bilko-host MCP's register_static_project tool builds its registry entry inline in mcp-host-server/src/server.ts (lines ~199-221) and cannot set the registry's optional `public` and `displayName` fields, so a newly registered app is never listed on the public /projects hub — the Bilko Launch Kit was registered this way and stayed invisible. Add a pure, tested helper that builds and schema-validates a static-path entry including those two fields, for the next PRD to wire into the tool.

# Acceptance criteria

- [ ] mcp-host-server/src/publish-request.ts exports `buildStaticEntry(input: { slug: string; name: string; tagline: string; category: string; status: ProjectStatus; year: number; sourceRepo?: string; localPath?: string; tags?: string[]; public?: boolean; displayName?: string }): RegistryProject` that returns host { kind: 'static-path', path: `/projects/${slug}/` } plus sourceRepo/localPath only when given, tags only when non-empty, public only when it is a boolean, displayName only when given.
- [ ] buildStaticEntry validates its result with RegistryProjectSchema from mcp-host-server/src/contract/registry.ts and throws an Error naming the bad field on invalid input.
- [ ] Output key order matches existing entries in src/data/standalone-projects.json: slug, name, tagline, category, status, year, host, tags, public, displayName.
- [ ] tests/mcp-publish-request.test.ts has a new describe('buildStaticEntry') covering: minimal input yields no optional keys; public true and displayName carried through; public false kept as false; empty tags omitted; a 61-character displayName throws.
- [ ] mcp-host-server/dist/publish-request.js is rebuilt with `pnpm --dir mcp-host-server build` and committed; tests/mcp-dist-sync.test.ts passes.
- [ ] mcp-host-server/src/server.ts is unchanged (the next PRD wires the helper in).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/publish-request.ts
- mcp-host-server/dist/publish-request.js
- tests/mcp-publish-request.test.ts

# Implementation notes

Read first:
- mcp-host-server/src/publish-request.ts (whole file: projectDir, parseBypass, parseRegistry — the pure-helper home, imports from ./contract/registry.js).
- mcp-host-server/src/contract/registry.ts lines 1-60 (SlugSchema, ProjectStatusSchema, ProjectHostSchema, RegistryProjectSchema with optional public: z.boolean() and displayName: z.string().min(1).max(60), RegistryProject type).
- mcp-host-server/src/server.ts lines 180-230 (register_static_project: the inline entry literal this helper replaces later).
- tests/mcp-publish-request.test.ts (existing describe blocks and import style).

Steps:
1. Write the new describe('buildStaticEntry') tests first; run `pnpm vitest run tests/mcp-publish-request.test.ts` and see them fail (red), captured early.
2. Implement buildStaticEntry in publish-request.ts with conditional spreads in the stated key order; validate with RegistryProjectSchema.safeParse and throw `new Error(...)` naming the issue path and message on failure (mirror parseRegistry's error style). Import the ProjectStatus type from ./contract/registry.js.
3. Rebuild dist: `pnpm --dir mcp-host-server build` (tsc). Commit only mcp-host-server/dist/publish-request.js from dist; if other dist files change, src and dist were already out of sync — HALT and report instead of committing them.
4. Gate last.

Do not touch: mcp-host-server/src/server.ts and mcp-host-server/dist/server.js (next PRD), docs/, src/data/ (another plan edits the registry JSON).

# Out of scope

- Wiring the helper into register_static_project
- An update/edit tool for existing registry entries
- Docs changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-publish-request.test.ts tests/mcp-dist-sync.test.ts tests/registry-contract.test.ts && timeout 300 pnpm --dir mcp-host-server exec tsc --noEmit
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
