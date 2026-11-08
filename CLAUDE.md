@docs/map.md

# Bilko: in-repo rules

Everything above the first heading is imported from the entry map. This file keeps only rules for working inside this repo.

## Git

- The shared rules (push to `origin` `main` only, never `content-grade`; no real name or personal email in tracked files) come from the imported map above. This file adds only the details below.
- Local `main` must match `origin/main` (`git status -sb` in `~/Projects/Bilko`). If not, run `bash scripts/sync-local-main.sh`. Writers: [`docs/repo-writers.md`](docs/repo-writers.md).
- Commit messages and the commit author count as tracked content too. Write "the owner". `session-manager-operations/prompt-sessions/` is gitignored for this; `pnpm hooks:install` installs the identity guard. See [`docs/identity-boundary.md`](docs/identity-boundary.md).

## Rules

- Never propose solutions; implement them directly.
- TypeScript for every new file.
- Gemini: use the `gemini-flash-latest` alias, with the key in a header, not the URL.
- All SQL is parameterized through the db helpers; never string interpolation.
- `requireAuth` on token-spending endpoints; rate limiting on free-tier endpoints. Paid-tier entitlement comes only from the verified Clerk token.
- Each tool is independent: no cross-dependencies in backend or frontend. Paid tools share the credit model; free tools (LocalScore, OutdoorHours) deduct nothing.
- New apps default to `static-path` in their own repo; `react-route` only when the app must live in this bundle.
- Static-path fixes go in the sibling repo that owns the source, not in `public/projects/<slug>/` (the publisher overwrites it). Registry changes go through the `bilko-host` MCP.
- The registry is schema-validated (`mcp-host-server/src/contract/registry.ts`). Rebuild and commit `mcp-host-server/dist/` with any `src/` change (`tests/mcp-dist-sync.test.ts` enforces this).
- App-specific host code must be added to the list in [`docs/host-internals.md`](docs/host-internals.md#sanctioned-app-specific-host-code) in the same commit, or live in the sibling repo.
- New npm packages follow [`docs/publishing-contract.md`](docs/publishing-contract.md) (templates in `docs/templates/`).
- Paid download bytes never go in this repo. Commit only the sha256 in `shared/web-products.ts`; bytes live in the `web_product_releases` table.
- Blog videos are made in Burrow and hosted here. Keep `scripts/blog-video-capture.ts` and `scripts/blog-video-frames.ts` and their flags stable (Burrow runs them).

## Testing

183 files (2 skipped), 2151 tests (2136 pass, 15 skipped; counted via `pnpm vitest run` on 2026-11-08; recount whenever this drifts). CI runs on every push via `.github/workflows/ci.yml`.

Commands:
- `pnpm test` — vitest run
- `pnpm typecheck` — client (`tsc --noEmit`) + server (`tsc -p tsconfig.server.json --noEmit`) + scripts (`tsc -p tsconfig.scripts.json`)
- `pnpm test:e2e` — Playwright

### What a test must guard

A test earns its place by exercising host behavior: security (SSRF, auth, egress), money (tokens, Stripe checkout/webhooks), the publish contract (registry schema, mcp-dist sync), or routing (static-path vs react-route canonicalization). Do not add tests that:
- grep prose, docs, or skill files instead of exercising code
- snapshot the registry or other generated data
- test a sibling app's UI — that belongs in the sibling's own golden spec
- call production bilko.run from vitest
