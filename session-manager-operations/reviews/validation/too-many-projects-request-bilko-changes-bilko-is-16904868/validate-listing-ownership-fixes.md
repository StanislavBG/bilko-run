# Validation: listing ownership fix wave (1296, 1297)

Base: `ba3471f`. Commits: `86c984d` (1296), `81cdd27` (1297). PRD files read from `prds-archived/`.

## 1296-mcp-early-owner-check-and-patch-wire — VERIFIED

- `assertPublishOwner(projects, slug, sourceRepoPath)` is exported at `mcp-host-server/src/listing-tool.ts:30-43`. It throws `slug "<slug>" is not registered. Call register_static_project first.` for an unknown slug, otherwise calls `assertCallerOwnsSlug`.
- Order in `publish_static_project` (`mcp-host-server/src/server.ts:~349-370`): dist sanity checks (fs only) → `assertPublishOwner(await readRegistry(HOST_ROOT), slug, sourceRepoPath)` → `parseBypass` → `runGates`. The owner check precedes every gate command, and a throw lands in the handler's `catch` (returns `err`). The `withPublishCheckout` re-check is untouched.
- `update_project_listing` patch schema is `z.record(z.string(), z.unknown())` with the specified description (`server.ts:286`). It is passed to `updateListingInRegistry` → `applyListingPatch`, which handles `null` deletes (`listing-patch.ts:53`) and `url` on external-url entries (`:65-68`). The `ListingPatchSchema` import is removed from `server.ts`.
- `listing-tool.ts` has a single `./ownership.js` import (`assertCallerOwnsSlug, canonicalPath`).
- Tests added in `tests/mcp-listing-tool.test.ts`: unknown slug, non-owner path, owner path, `{displayName: null}` deletes, `{url}` sets `host.url`.
- `dist/` contains `assertPublishOwner` (`dist/listing-tool.js:29`, `dist/server.js:44,314`). A rebuild produced no git diff in `mcp-host-server/`, so dist is in sync.
- Gate re-run, in order:
  - `pnpm --dir mcp-host-server build`: exit 0.
  - `pnpm test`: 95 files, 1117 tests passed.
  - `pnpm typecheck`: exit 0.
- The worktree had no `node_modules`, so I temporarily symlinked the main tree's and removed the symlinks afterwards.

## 1297-docs-ownership-trust-model — VERIFIED

- `docs/host-contract.md:149` has `### Trust model` under `## Project listing — who owns what` (`:101`). It says the check compares a self-asserted path with `host.localPath`, guards against mistakes, and is not authentication. The real boundary is the local stdio `bilko-host` MCP plus the owner's GitHub access to `StanislavBG/bilko-run`. `https://bilko.run/mcp` is read-only.
- The same subsection says a leading `~` in `callerRepoPath` is expanded before the absolute-path check. This matches `ownership.ts` `canonicalPath`.
- `mcp-host-server/README.md:98` adds a Safety notes bullet with the same statement, linking to `../docs/host-contract.md#trust-model`.
- The `null` and `url` doc statements (`host-contract.md:107`, `:134`) agree with the landed schema and `listing-patch.ts`, so no edit was needed.
- Only the two listed files were changed; no `.ts` files.

## Findings

### Critical
- None.

### Important
- None. Both prior Important findings (gates running before the owner check; schema rejecting `null` and `url`) are fixed.

### Minor
- `docs/host-contract.md:149-153`: `Trust model` sits between the listing JSON example and the "Going public" paragraph, which now reads as belonging to the subsection. It should be moved above `### Trust model` or given its own heading. This is cosmetic.
- `assertPublishOwner` runs after `readRegistry(HOST_ROOT)` on the local checkout, which may be stale relative to origin/main. The authoritative check in `withPublishCheckout` covers this, as the PRD intended.
- An empty untracked file named `<path>` exists at the worktree root (created 17:51, during this run). It is not part of the plan's diff and was not committed. Its origin is unknown; I did not trace it.
- Review method: `/code-review` and `/security-review` were not run separately. I self-reviewed the combined diff, 7 files and +85/−11. No unsafe input handling or secrets, and no new path-traversal surface: path comparison goes through `canonicalPath` (realpath) as before. There is no duplicated helper.
