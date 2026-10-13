# Validation: project-owned listings (PRDs 1286–1294)

Base: `2631da88e8a28b212c79516f5adef907fad05837`. HEAD `2e8d00a`. PRD files read from `prds-archived/`.
(1292 has two archived files, `1292-mcp-enforce-…` and `1292-fix-mcp-enforce-…`; the fix file was not a listed slug.)

## How it was checked
- The job worktree has no `node_modules`. I symlinked the main checkout's into the worktree (gitignored). The main checkout lacks `@modelcontextprotocol/sdk` (it is only in `mcp-host-server/node_modules`), so I also linked that package in. This is an environment fix, not a code finding.
- `pnpm --dir mcp-host-server build`: clean, `dist/` unchanged (no git diff).
- `pnpm typecheck` (client + server + scripts): exit 0, no output.
- Plan test files (project-catalog, projects-view, registry-contract, mcp-listing-patch, mcp-ownership, mcp-listing-tool, mcp-dist-sync): 7 files, 80 tests, all pass.
- Full `pnpm vitest run`: 1098 passed, 5 skipped. The only failures were the SDK resolution above (fixed afterwards, see the 80-test run) and `tests/spa-fallback-notfound-crash.test.ts`, which shells out to `pnpm build`. That test was not exercised and is unrelated to this plan.
- Parity: built a detached worktree at Base, ran `HUB_CARDS`, `CATALOG_PROJECTS` and `buildCatalog(new Date(0))` under tsx at Base and at HEAD. After stripping the new `audience`/`talkingPoints` hub-card fields, output is **byte-identical**, so the 8 ENRICH cards and the `/api/projects` body are unchanged (no `generated_at` difference at a fixed clock).
  The 8 hub cards now carry `audience`/`talkingPoints`, which `GET /api/projects` already exposed through PROMO.

## Per-PRD verdicts

### 1286-listing-schema-standards — VERIFIED
- `ListingSchema` strict, optional fields and caps: `mcp-host-server/src/contract/registry.ts`; `RegistryProjectSchema.listing` present.
- Caps for name/tagline/category/tags/thumbnail and `BANNED_LISTING_TERMS = [/content-?grade/i]` at registry.ts:75; the issue message at :112 names slug and field.
- localPath for session-manager, fizzpop, bilko-host, sigma, bilko-flow, bglabs read from the JSON: all six match the AC values.
- registry-contract tests (36) pass. dist in sync.

### 1287-listing-migrate-enrich — VERIFIED
- All 8 slugs have `metric/metricLabel/lang/detail` in `listing`. Byte equality is shown by the HUB_CARDS Base-vs-HEAD diff being identical.
- `ENRICH` / `Enrich` removed from `projectsView.ts`; `Project.listing?: Listing` added.
- projects-view tests pass. /projects card output unchanged: confirmed by the parity run.

### 1288-listing-patch-primitive — VERIFIED
- `listing-patch.ts` exports `PROJECT_OWNED_FIELDS`, `ListingPatchSchema` (strict pick), `applyListingPatch` (non-owned keys rejected with the specified message, wholesale `listing` replace, null deletes, `url` https-only for external-url, `structuredClone`). 10 tests pass.
- See Important finding 2 (`null` and `url` are unreachable through the MCP tool schema).

### 1289-listing-migrate-promo — VERIFIED
- audience/talkingPoints in `listing`; `PROMO` / `Promo` removed from `projectCatalog.ts`; HubCard carries them. project-catalog tests (9) pass.
- `GET /api/projects` body unchanged: `buildCatalog` output identical Base vs HEAD at a fixed clock.

### 1290-slug-ownership-primitive — VERIFIED
- `ownership.ts` `assertCallerOwnsSlug`: both required error strings, `~` expansion, realpath with fallback, mismatch message. 6 tests (~, symlink, mismatch, missing localPath, missing caller, trailing slash) pass.

### 1291-mcp-update-project-listing-tool — VERIFIED
- `updateListingInRegistry` (unknown slug throws, ownership then patch, whole-array `RegistrySchema.parse`, `changed` via deep-equal) in `listing-tool.ts`.
- `server.ts` registers `update_project_listing` (`listing: update <slug>` commit, `no change: <slug>` without commit) and read-only `get_project`. 14 tests pass.

### 1292-mcp-enforce-ownership-and-visibility — VERIFIED
- `publish_static_project`: `requireRegistered` removed; `assertCallerOwnsSlug(p, sourceRepoPath)` runs inside the checkout against the fresh registry, before any copy.
- `unregister_project`: required `callerRepoPath`, ownership check before removal.
- `register_static_project`: no `public` input, `buildRegistration` yields no `public` key (tested), `callerRepoPath` collapsed to `~`, duplicate slug and already-bound repo refused, result says admin-only.
- Write-path audit: the only MCP writes are register (new slug only), unregister, update, publish. Update/publish patches go through the strict allowlist (no `public`, `slug`, `host`, `year`, `launchedAt`), and unregister/update/publish call `assertCallerOwnsSlug`. No path lets one repo change another's slug or set `public`, subject to Important finding 1.

### 1293-mcp-publish-syncs-listing-file — VERIFIED
- `readListingFile`: absent → undefined, 16384-byte cap, `bilko.listing.json: …` errors. Publish reads it after the ownership check and before the byte copy; a patch error aborts the publish; the registry is written after the swap in the same commit with `src/data/standalone-projects.json` added to the paths; the result line reports synced / unchanged / no file. Tests cover absent / invalid / oversize / valid / `public: true` rejected.

### 1294-docs-project-owned-listings — VERIFIED, with doc inaccuracies (Minor, see below)
- `docs/host-contract.md` has the "Project listing — who owns what" section: ownership table, rule, caps (match registry.ts), banned-term rule, both edit paths with JSON example, going-public statement. Catalog source-of-truth bullet now cites `listing`; the MCP steps include `callerRepoPath` and have no `public`.
- README tools table lists both tools; `requireRegistered` is gone. No `ENRICH` / `PROMO` / `requireRegistered` hits in the three docs files.

## Findings

### Critical
- none

### Important
1. `callerRepoPath` / `sourceRepoPath` are self-asserted strings (`mcp-host-server/src/ownership.ts:19-28`). Ownership is a path comparison with no proof the caller is that repo. Any session that knows another slug's `localPath` (it is in the public registry JSON) can pass it. This holds for the stdio MCP only under a trusted-local-session model; the docs do not state that limit. The "no write path lets one repo change another slug" claim therefore holds against mistakes, not against a hostile local session.
2. `publish_static_project` runs the gates (`golden`, `audit`) against caller-supplied `sourceRepoPath` before the ownership check (`mcp-host-server/src/server.ts`, gate run precedes `withPublishCheckout`). The check fires before any bytes are copied, as the AC requires, but arbitrary-repo gate commands can run first for a non-owner. A cheap early check would remove this.

### Minor
1. Docs claim `null` removes `displayName`/`tags`/`thumbnail`/`listing` through `update_project_listing`, and that `url` is project-owned on external-url entries (`docs/host-contract.md:134`, `:107`). The tool's input schema (`ListingPatchSchema`, `.partial().strict()`) rejects both: I confirmed `safeParse({displayName:null})` and `safeParse({url:'https://x'})` are both `false`. Only the `bilko.listing.json` path reaches `applyListingPatch` unfiltered. Fix the docs or widen the tool schema.
2. `mcp-host-server/src/listing-tool.ts:5-7` imports `ownership.js` twice (`assertCallerOwnsSlug` and `canonicalPath` on separate lines). Merge them.
3. `buildRegistration`'s absolute-path check expands `~` before testing (`listing-tool.ts`), so `~/x` passes as absolute. Intentional but undocumented.
4. `tests/spa-fallback-notfound-crash.test.ts` was not run (needs `pnpm build`); not part of this plan.
5. Stale-file note: `1292-fix-mcp-enforce-ownership-and-visibility.md` sits beside the original in `prds-archived/`; no action needed.
