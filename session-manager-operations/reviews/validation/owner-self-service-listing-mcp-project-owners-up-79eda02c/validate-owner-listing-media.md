# Validation: owner listing media (PRDs 1852-1861)

Base: eeb0a8c2fa7a4ad9ec2282037ed0d2207a263dff. All ten PRD files found in prds-archived/. Each PRD has landed commits (c9b4dfec, 2ba13aa0, 8a9af0eb, e74b73e0, f3251c11, 250d1af0, d51629e0, f75570c0, 6a6c4f00, 6f6c7ed2).

Gates re-run in the foreground: one combined `pnpm vitest run` over every gate test file (18 files, 313 tests, all pass, including tests/mcp-share-assets-gate, asset-versions, projects-view, og-routes, static-cache, mcp-dist-sync). `tsc --noEmit` passes for mcp-host-server, tsconfig.server.json and the client. `/code-review` and `/security-review` were not run as separate passes; I self-reviewed the new server, store and MCP code (below).

## listing-media-mcp-contract — VERIFIED
Contract helpers, registry `/_media/` rule, `checkCardMediaFile`, `_media` reservation and dist rebuild are all covered by tests/mcp-listing-media-contract.test.ts (11) and tests/mcp-share-assets-gate.test.ts (32). dist-sync passes.

## listing-media-shared-checks — VERIFIED
shared/listing-media.ts:42-46 holds CARD_MEDIA_LIMITS with the specified values. The parity table and path-agreement tests pass (tests/listing-media-shared.test.ts, 31).

## listing-media-store — VERIFIED
server/services/listing-media.ts:84-160: chunks are inserted first and the listing_media row last. The sha256 and `checkCardMediaBytes` checks run before any write. All SQL goes through dbGet/dbRun/dbAll with `?` parameters (grep found no interpolation). getListingMedia re-hashes and returns null on mismatch. Tests: 5 pass.

## listing-media-serve-route — VERIFIED
server/routes/listing-media.ts:98-143: file regex, immutable Cache-Control, 16-hex ETag with 304, parseRange (206/416/multi-range falls back to 200), `.json` meta, and 404 with no-store and x-bilko-media. 27 tests pass, including the @fastify/static case.

## listing-media-ingest-route — VERIFIED
server/routes/listing-media.ts:146-171 and server/services/listing-media-declared.ts. `isDeclared` is checked before the body is used, so undeclared bytes are never stored. The sha256 and content checks run in the store. The GitHub URL is a fixed constant (declared.ts:17-18); slug and file are regex-validated. The rate limit is 20 per 10 minutes, bodyLimit 8388608, and the no-auth comment is present. 11 tests pass.

## og-hosted-card-media — VERIFIED
tests/og-routes.test.ts and tests/asset-versions.test.ts pass with the new hosted-media cases (hosted shareImage, hosted icon, fallback max-age=60, version hashing of the path).

## set-listing-media-core — VERIFIED
mcp-host-server/src/listing-media-tool.ts. The only file write is the registry JSON, inside the isolated checkout (line 93). There is no write path under public/projects/ (the header at line 8 states this; grep found none). 19 tests pass, covering owner check, per-file checks, 404 retries, re-run with no commit, and a temp origin.

## set-listing-media-tool-wire — VERIFIED
server.ts:18 and 387-390 register `set_listing_media`. The update_project_listing description at server.ts:355 points at it. listing-tool.ts:45 has the new refusal text. README.md:21 has the tool row. dist-sync passes.

## card-hosted-video-audio — VERIFIED
tests/project-card-shot.test.ts (13) and tests/projects-view.test.ts (15) pass; tsc is clean.

## doc-owner-listing-media — VERIFIED
docs/host-contract.md:155-159 (limits table), 216 (no-auth trust model, 20 per 10 min, 8 MB), 254 and 267-339 (the new section: hosted path, immutable cache header, Unmute from bytes, `listing: media <slug>`, null removal), 316 (`_media/` reserved), 460-463 (MCP tool list). Limits and paths match shared/listing-media.ts:42-46 and the server routes.

## Plan-wide
- A grep for project names in the new source files (shared, routes, services, tool, contract, ProjectCardShot) found no hardcoded project media.
- The named existing tests pass in the run above.

## Findings
### Critical
None.
### Important
None.
### Minor
- server/services/listing-media.ts:84-110: the check-then-insert is not atomic. Concurrent uploads of the same file are harmless (INSERT OR IGNORE, identical bytes), but a crash between the chunk inserts and the meta insert leaves orphan chunks. These are never served because the meta row is missing, and a retry overwrites them.
- server/routes/listing-media.ts:155: the rate-limit counter is incremented before the declared check, so 404 probes also consume the 20-upload budget. This is conservative, not a bug.
- The `/code-review` and `/security-review` skills were not run as separate passes, because the plan's diff is mixed with unrelated base-range commits. Self-review found no injection, path traversal or secret handling issues.
