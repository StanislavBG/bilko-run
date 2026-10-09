# Validation: host simplification plan (PRDs 1083–1098)

Base: 756f65a0b1d63170de5ea1a1b23e957063abf3e0 (HEAD c9deed7). PRD files found under `prds-archived/` for all 16 slugs.

Whole-plan checks, run in the foreground on the combined tree (after `pnpm install --frozen-lockfile`):
- `pnpm typecheck` → exit 0
- `pnpm vitest run` → 54 files, 754 tests passed
- `pnpm build` → exit 0
- `pnpm --filter host-kit test` → 17 passed

## Per-PRD verdicts

- **1083-ci-typecheck-tests-on-push — VERIFIED.** Commit 3c573d1. `.github/workflows/ci.yml` triggers on push to main and on `pull_request`. Steps run in order: install, typecheck, test, host-kit test, build. Actions are pinned to the SHAs the PRD named, `permissions: contents: read` and a concurrency group are set. The js-yaml gate exited 0.
- **1084-publish-lock-wait-configurable — VERIFIED.** Commit ada6807. `mcp-host-server/src/publish-checkout.ts:27` adds `lockWaitMs`, and `:156` falls back to `LOCK_WAIT_TIMEOUT_MS`. `dist/publish-checkout.js` is rebuilt, and `tests/mcp-dist-sync.test.ts` and `tests/mcp-publish-checkout.test.ts` pass in the full run.
- **1085-readability-test-direct-tsx — VERIFIED.** Commit a4c2e26. `tests/blog-readability.test.ts` spawns `process.execPath` with the `tsx/cli` path, and the 15s abort timer is faked. Passes in the full run.
- **1086-tests-in-memory-db — VERIFIED.** Commit 44f7b60. `vitest.config.ts` sets `BILKO_SQLITE_PATH` to a tmpdir file and blanks `TURSO_DATABASE_URL`. `server/db.ts:19` reads `BILKO_SQLITE_PATH`. It is a tmpdir file, not `:memory:`, and the config comment explains why. Full suite green.
- **1087-docs-archive-historical — VERIFIED.** Commit 5cc8272. Historical docs moved to `docs/archive/`, `docs/card-spotter/` deleted, `docs/archive/README.md` added, `docs/deployment.md` rewritten. The CLAUDE.md link to `docs/archive/academy-research.md` resolves.
- **1088-env-example-and-dev-env-file — VERIFIED.** Commit 699a135. The `dev:server` script contains `env-file` (gate exited 0). `.env.example` was expanded and `docs/secrets-rotation.md` corrected.
- **1089-app-shell-lazy-routes — VERIFIED.** Commit b213615. `src/App.tsx:17` defines `lazyWithRetry` (reload once on chunk failure) and `:36-43` lazy-loads the non-core pages. The build output shows per-page chunks. `src/hooks/useAuth.tsx` is removed and typecheck is clean.
- **1090-tool-credit-deduct-check — VERIFIED.** Commit 846e632. `launch-grader`, `page-roast` (score and compare) and `stack-audit` now return 402 when `deductToken` reports `!success`. `tests/tool-credit-deduct.test.ts` is added and passes.
- **1091-games-limit-clamp — VERIFIED.** Commit 7d77543. `server/routes/games.ts:41-42` only accepts an integer ≥ 1, capped at 500, and defaults to 100. Tests added in `tests/game-services.test.ts` pass.
- **1092-feedback-list-skip-image-blobs — VERIFIED.** Commit 1961ac1. With `images=none`, `project-feedback.ts` selects `NULL AS image_data` plus `length(image_data) AS image_len`, so the blob is never read. A test was added and passes.
- **1093-remove-social-roast — VERIFIED.** Commit c8a36e3. `server/routes/social.ts` and `server/services/social-roast.ts` are deleted and the registration is removed from `server/index.ts`. A grep for `social-roast|socialRoast|config/tools` over src, server, tests and shared is clean. The fetcher user agent is now generic.
- **1094-remove-dead-tools-config — VERIFIED.** Commit d148059. `src/config/tools.ts` is deleted, `projectsRegistry.ts` is simplified, typecheck, build and tests are green.
- **1095-fonts-and-global-css-trim — VERIFIED.** Commit 703fcaa. Caveat is gone from `index.html` and `src/index.css` (grep count 0). The manual-reader rules moved to `src/styles/session-manager-manual.css`. Build is green.
- **1096-server-shutdown-flush-og-precompute — VERIFIED.** Commit 5f3e047. `server/index.ts` handles SIGTERM/SIGINT with `app.close()` and a 10s unref'd kill timer. OG HTML is precomputed into a Map at boot. `tests/server-shutdown.test.ts` passes.
- **1097-readme-plain-language — VERIFIED.** Commit 2f91a59. `README.md` was rewritten with setup, deploy and a repo map. There is no gate, and the diff was read.
- **1098-claude-md-truth-and-sanctioned-list — VERIFIED.** Commit c9deed7. CLAUDE.md now lists Session Manager as the react-route app, extends the sanctioned-code list, and states the test count as 54 files / 754 tests. That matches the run above.

## Findings

### Critical
- none

### Important
- none

### Minor
- `server/routes/tools/*.ts`: the credit is deducted after the Gemini call, so a user who races their balance to zero gets a 402 but the AI work has already run. This is existing ordering, not a regression, and the 402 closes the free-result hole.
- `server/index.ts` OG_OVERRIDES: the `/projects` description still names specific tools (PageRoast, HeadlineGrader, AdScorer). This is cosmetic.
- `docs/host-contract.md` and `packages/host-kit/docs/host-contract.md` were both edited. The host-kit copy was cut by 144 lines, so the two docs may drift again.

Review method: `/code-review` and `/security-review` were not run as separate passes. I self-reviewed the combined diff for correctness, input handling (the games `limit` clamp, parameterized SQL in feedback, no string interpolation of user input), secrets (none added) and path traversal (none introduced).
