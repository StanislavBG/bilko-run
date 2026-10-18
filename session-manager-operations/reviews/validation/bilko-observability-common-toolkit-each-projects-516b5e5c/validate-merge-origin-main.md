# Validation: merge-origin-main-observability

Base: 841183c4 (merge commit ee3bb601, parents 841183c4 + 7736fba6). Reviewed by self-review (diff is a merge; conflicts inspected directly).

## merge-origin-main-observability — VERIFIED

- Ancestor: `git merge-base --is-ancestor origin/main HEAD` exits 0; origin/main = 7736fba6 = second parent of ee3bb601.
- README: `packages/host-kit/README.md:15-21` keeps local telemetry docs (initTelemetry, track, trackFlow, logError, link to docs/observability.md); install line reads `host-kit@^0.9.0` (origin's only README change).
- Auth API (getAuthState/subscribeAuth, no clerk-react peer): origin's README never documented these — they live in `packages/host-kit/CHANGELOG.md:7` and `.changeset/host-kit-drop-clerk-react-peer.md`, both present. `packages/host-kit/package.json` has no clerk-react reference.
- `src/pages/UnpublishedProjectPage.tsx`: origin's terminal-404 page kept (title, 404 copy, no redirect); local `track` import from `../lib/telemetry.js` and `track('project_unpublished')` call at line 13-14. Diff against origin's side is the import line only.
- `tests/spa-fallback-notfound-crash.test.ts`: all 7 cases present (5 in the first describe, 2 in `/projects/<slug>/ with no published bundle`); origin's unpublished-slug 404 test (line 112) and local cases both kept.
- Version: `packages/host-kit/package.json` is 0.9.0. `.changeset/host-kit-session-telemetry.md` retained alongside `host-kit-drop-clerk-react-peer.md`.
- No conflict markers: `rg -n '^(<<<<<<<|>>>>>>>)' src server packages tests docs` → clean.
- Gate (after `CI=true pnpm install --frozen-lockfile` and `pnpm --filter host-kit build`, which this fresh worktree needed):
  - `pnpm typecheck` → exit 0
  - `pnpm --filter host-kit test` → 6 files / 31 tests passed
  - `pnpm vitest run` on the 6 named test files → 6 files / 85 tests passed

## Findings

### Critical
- none

### Important
- none

### Minor
- PRD acceptance text says origin's README documents getAuthState/subscribeAuth; origin's README does not (docs are only in CHANGELOG/changeset). Nothing was lost in the merge; the criterion wording was inaccurate. `packages/host-kit/README.md` has no getAuthState/subscribeAuth section — consider adding one.
