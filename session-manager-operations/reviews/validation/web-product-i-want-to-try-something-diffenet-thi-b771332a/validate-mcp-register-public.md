# Validation: mcp-register-public (plan pl-mv3ifdyr-cbe8da)

Base: da0047df4beb7741fa705736deaaf859c803c4b8. PRD files found under `prds-archived/` (1262, 1264).
Commits: 3b4abcd (builder + tests + dist/publish-request.js), 1bb77b5 (server.ts + dist/server.js + docs).

## 1262-mcp-register-entry-builder — VERIFIED
- Export + signature: `mcp-host-server/src/publish-request.ts:84-96`; host path `/projects/${slug}/`, sourceRepo/localPath/tags/public/displayName conditionally spread (`:105-117`).
- Validation: `RegistryProjectSchema.safeParse`, throws `Error` naming the field path (`:119-124`).
- Key order slug…year, host, tags, public, displayName: asserted in `tests/mcp-publish-request.test.ts` ("registry key order") and passing.
- Tests: `describe('buildStaticEntry')` has minimal / public+displayName / public false / empty tags / 61-char displayName (`tests/mcp-publish-request.test.ts:121-171`).
- dist: `dist/publish-request.js` contains buildStaticEntry; `tests/mcp-dist-sync.test.ts` 2/2 pass.
- server.ts unchanged by this PRD's commit 3b4abcd (its only change is in 1bb77b5, PRD 1264).
- Gate: vitest (publish-request, dist-sync, registry-contract) 55/55 pass; `tsc --noEmit` exit 0.

## 1264-mcp-register-public-flag — VERIFIED
- `public: z.boolean().optional()` with hub/home description, omit = admin-only: `mcp-host-server/src/server.ts:197`.
- `displayName: z.string().min(1).max(60).optional()`, hub-only: `server.ts:198`.
- Handler uses `buildStaticEntry(...)` with `public: isPublic`, `displayName` (`server.ts:208`); no inline entry literal remains (grep for `const entry: RegistryProject` / `kind: 'static-path'` in src/server.ts and dist/server.js: only the helper call). Duplicate-slug check and `withPublishCheckout` flow unchanged in the diff.
- Description corrected: "appears in ⌘K and the admin view of /projects; … public /projects hub only with public: true" (`server.ts:186`).
- Docs: `docs/host-contract.md:187` documents `public` and `displayName`.
- dist/server.js matches src: `tests/mcp-dist-sync.test.ts` (byte-compare to fresh compile) passes.
- Gate: vitest (mcp-dist-sync, mcp-publish-request) pass; `tsc --noEmit` exit 0. (Required `pnpm install --offline --frozen-lockfile` in the worktree first; node_modules is gitignored.)

## Findings
### Critical
- none
### Important
- none
### Minor
- Plan diff base..HEAD also contains `src/data/*`, `commit-*.json`, `tests/projects-view.test.ts` changes (commits 1e2c6a7, 9bc0109) — another plan's work, outside these PRDs; not reviewed for these verdicts.
- `buildStaticEntry` treats empty-string `displayName`/`sourceRepo`/`localPath` as absent (truthiness) rather than rejecting; consistent with prior handler behavior for repo/path, harmless for displayName since the tool schema enforces min(1). `mcp-host-server/src/publish-request.ts:105-117`.
- The red-first TDD step could not be verified from history (tests and impl landed in one commit).
- Security/code review: self-reviewed (no new input surface beyond zod-validated fields; slug is SlugSchema-validated before path construction; no secrets). No issues.
