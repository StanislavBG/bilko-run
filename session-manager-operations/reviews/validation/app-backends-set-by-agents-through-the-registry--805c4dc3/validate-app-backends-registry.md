# Validation: app-backends-set-by-agents-through-the-registry

Base: 4e4d5cf57285fe502fa5a87b0ce4cad73bddb9c1. Plan commits: 71ef8ed5, 1f29ee33, 801cbe06, 2d3c04a4. (The base..HEAD range also contains unrelated ops-folder untrack commits 64a93b42 / d268599a; excluded from this review.)

Gates re-run (all exit 0): vitest on the 12 files named across the four PRD gates (339 tests passed, incl. mcp-dist-sync); `pnpm --dir mcp-host-server exec tsc --noEmit`; `pnpm typecheck`; `bash scripts/docs-guard.sh` (clean, 14 files).

## registry-app-backend-field — VERIFIED
- `appBackendOriginProblem` + `AppBackendOriginSchema` (max 200, rejects non-bare forms): mcp-host-server/src/contract/registry.ts:13-42.
- `backend: AppBackendOriginSchema.optional()` on the strict StaticPathHostSchema: registry.ts:55; ExternalUrlHostSchema untouched.
- Tests: tests/registry-contract.test.ts (+57 lines) pass; dist rebuilt (dist/contract/registry.js, mcp-dist-sync passes); src/data/standalone-projects.json absent from the diff.

## app-backends-from-registry — VERIFIED
- `appBackendsFromRegistry` / `resolveAppBackends`: server/app-backends/config.ts:89-148; registry origins use `allowLoopbackHttp:false`, APP_BACKENDS path keeps `true` (config.ts:38, :74). Warnings carry slug and reason, never the origin.
- `loadDeployedRegistry` never throws: server/app-backends/registry.ts:12-36.
- Wiring, boot lines `(registry)` / `(env APP_BACKENDS)` and `/api/health.appBackends` (slug -> source only): server/index.ts:259-268, :297. Comment updated at server/egress.ts:327.
- Parity table (>12 origins) against AppBackendOriginSchema: tests/app-backends-config.test.ts:317+; passes.

## set-app-backend-tool — VERIFIED
- `setBackendInRegistry` (unknown slug, ownership via assertCallerOwnsSlug, external-url refusal, origin check, normalized store, null clears): mcp-host-server/src/app-backend-tool.ts:39-60.
- `setAppBackend` via withPublishCheckout, 5 s health fetch for the env-override note: app-backend-tool.ts:102, :130, :152.
- Registered with the specified input schema: mcp-host-server/src/server.ts:417-438; header list line 19; README +1 line.
- tests/mcp-app-backend-tool.test.ts (15 tests, incl. temp origin repo push/clear) pass; dist rebuilt and in sync.

## app-backends-registry-docs — VERIFIED
- docs/host-contract.md: "Turning it on" section, env var sentence replaced by registry-first/override wording, `host.backend` in Registry rules, tool list and ownership rule include set_app_backend.
- docs/deployment.md: APP_BACKENDS is an optional per-slug override; both boot log lines match server/index.ts:264 exactly; format/validation text kept.
- CLAUDE.md: one new rule line about agent-operable hosting.
- docs-guard clean; no dates/SHAs/PRD numbers in added text.

## Plan-level checks
- `git diff base..HEAD -- server/ mcp-host-server/src/ | grep -i threewinds`: no match (clean). The only "threewinds" mention is a slug example in docs/deployment.md (allowed).
- src/data/standalone-projects.json: unchanged by the plan.
- Registry backends https-only; APP_BACKENDS keeps loopback http: confirmed (config.ts:38, :74).
- Parity test ties AppBackendOriginSchema to appBackendsFromRegistry: present and green.
- Self-review (no separate /code-review or /security-review output captured): no secrets, no path traversal; origins are never logged or exposed in /api/health; ownership enforced before write; https-only registry origin prevents loopback calls with user Authorization headers.

## Findings
- Critical: none.
- Important: none.
- Minor: `server/app-backends/config.ts:117-118` labels a bad-slug registry warning `#<n>` (index), fine, but a slug-valid duplicate registry entry is skipped with a warning only; acceptable. The original-slug-regex is duplicated across server and registry by design (parity-tested).
