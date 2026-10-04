# Validation: publish-hardening plan (1062–1081)

Base: `a7248f41d713d243b1b98defccc60fcb7fc4ca62`
HEAD at validation time: `a99598cac6025fde728bc87cb71bc30379f97d39`

## Method note — PRD files were not found on disk

None of the 19 PRD markdown files (1062–1081) exist anywhere in this worktree: not under
`session-manager-operations/scheduler/prds/`, not under `prds-archived/`, and the epic directory
`session-manager-operations/scheduler/epics/review-the-project-first-time-opus-5-5-is-scanni-2234a8bc/`
does not exist at all (`git ls-files` confirms none were ever committed). The epic's own branch
(`sm-epic/review-the-project-first-time-opus-5-5-is-scanni-2234a8bc`) also does not contain them.

What *was* available and used instead: the scheduler's own state files
(`session-manager-operations/scheduler/state/queue.json` and `state/history.jsonl`, both flagged
foreign-WIP and read-only for this job) carry one record per PRD with `title`, a truncated `Goal`
(`bodyPreview`), `status`, `exitCode`, and — critically — `landedCommit`, the exact commit SHA each
PRD's executor committed. All 19 `landedCommit` SHAs resolve to real commits and all 19 sit inside
`base..HEAD` (verified via `git log --oneline base..HEAD`, 20 commits exactly — 19 PRDs, with
1068 landing as a merge commit plus one child commit). Each PRD below was therefore validated by
reading its landed commit's diff against its title/goal and against the plan-level checks in this
PRD's implementation notes, not against formal acceptance-criteria prose (none exists to read).

## Plan-level checks

1. **`pnpm vitest run`** — 48 files passed, 672 tests passed. Matches the number CLAUDE.md now
   claims (PRD 1081).
2. **`pnpm typecheck`** — clean (`tsc --noEmit && tsc -p tsconfig.server.json --noEmit`), including
   with `noUnusedLocals`/`noUnusedParameters` now enabled (PRD 1079).
3. **`grep -rnE '\bbody\??\.email\b' server/routes/tools/` used in `checkRateLimit`/entitlement** —
   two remaining `body?.email` reads exist (`email-capture.ts:9`, `headline-grader.ts:15`), both for
   the unrelated "email capture / unlock" demo-gate feature, not for rate-limit or entitlement
   decisions. All five gateway routes' `checkRateLimit`/`enforceCallLimits` calls use
   `entitlementEmail(req)` (derived from `verifyClerkToken`), confirmed by `grep -n "VerifiedEmail\s*="`.
4. **`mcp-host-server/src/server.ts` has no `git commit`/`git push` against `HOST_ROOT`** — clean;
   `commitAndPush()` was deleted in 91858b8 and replaced by `withPublishCheckout`, which only
   touches the isolated checkout dir, never `HOST_ROOT`.
5. **`tests/mcp-dist-sync.test.ts` passes** — yes (1778ms, including a fresh `tsc` compile of
   `mcp-host-server/src` diffed byte-for-byte against committed `dist/`).

## Per-PRD verdicts

### 1062-registry-contract-schema — VERIFIED
Commit `5ffadd8`. Adds `mcp-host-server/src/contract/registry.ts` (`SlugSchema`,
`ProjectStatusSchema`, `ProjectHostSchema`, `RegistryProjectSchema`, `RegistrySchema`) and
`tests/registry-contract.test.ts` (parses the real `src/data/standalone-projects.json`, plus
rejection cases: duplicate slug, mismatched static-path `host.path`, non-https `external-url`,
unknown key). Test passes in the full run.

### 1063-registry-contract-wire-host — VERIFIED
Commit `96201e7`. `src/data/projectsRegistry.ts` and `scripts/sanity-qa.ts` now import
`ProjectStatus`/`RegistryProject` type-only from the new contract instead of hand-copied types.
Confirmed the import is type-only and zod does not leak into the client bundle
(`grep -rn "zod" dist/assets/*.js` → no hits after `vite build`). Deletes `tests/games-page.test.ts`
as superseded by `registry-contract.test.ts`.

### 1064-tool-entitlement-verified-email — VERIFIED
Commit `89d11c8`. Adds `entitlementEmail(req)` and `checkRateLimitForRequest()` to
`server/routes/tools/_shared.ts`; `entitlementEmail` reads only `verifyClerkToken`, never
`req.body`. `handleGenerateEndpoint` now calls `entitlementEmail()` internally;
`opts.bodyEmail` is marked `@deprecated` and ignored. New `tests/tool-entitlement.test.ts` proves a
spoofed `body.email` for a paying user is ignored when unauthenticated, and that a verified
token's owner — not a differing body email — determines the limit.

### 1065-repo-hygiene-dead-config — VERIFIED
Commit `7da5952`. Removes the unused `ajv` dependency, unreferenced `npm-stats`/`metrics`/
`github-traffic` npm scripts, three unreferenced files (`src/hooks/useOgMeta.ts`,
`scripts/seed-rivals.ts`, `scripts/smoke-signal-builder-tile.sh`), untracks `test-results/`, and
stops force-adding the QA report from `sanity-qa-cron.sh`. Verified no remaining references to any
deleted script/hook anywhere outside `session-manager-operations/` (`grep -rn` across
`*.ts/*.tsx/*.json/*.md/*.sh`, zero hits), and `CONTRIBUTING.md` (removed from `package.json`'s
`files` array) does not exist on disk either.

### 1066-tool-entitlement-wire-a — VERIFIED
Commit `ec9e90f`. `headline-grader.ts`, `ad-scorer.ts`, `thread-grader.ts` all replace
`body?.email`-derived rate-limit/entitlement checks with a single `entitlementEmail(req)` call
reused for both `checkRateLimit`/`enforceCallLimits`.

### 1067-tool-entitlement-wire-b — VERIFIED
Commit `7e3e905`. Same pattern applied to `email-forge.ts` and `audience-decoder.ts`; also drops
the now-unused `hasPurchased` import from `audience-decoder.ts`.

### 1068-delete-low-value-tests — VERIFIED
Merge `a72182c` (child `0f8170e`). Deletes `tests/academy-nav.test.ts`,
`tests/academy-retired.test.ts`, `tests/commit-counts.test.ts`, `tests/projects-order.test.ts`
(done-migration / generated-data snapshot checks), `tests/blog-spotlight-mode.test.ts`,
`tests/blog-editorial-focus-not-content.test.ts` (skill-prose greps), `tests/smoke-fizzpop.spec.ts`,
`tests/games-prod-smoke.spec.ts` (production-hitting smoke specs matched by neither vitest nor
playwright config), and `e2e/local-score.spec.ts` + its fixture (sibling-app UI e2e). All match
CLAUDE.md's "what a test must guard" exclusion list added in 1081.

### 1069-clerk-auth-real-tests — VERIFIED
Commit `91bb390`. Deletes `tests/auth.test.ts` (only tested a regex and a hard-coded admin-email
literal). Adds `tests/clerk-auth.test.ts`, importing the real `server/clerk.ts` and mocking only
`@clerk/backend` — covers missing-header, non-Bearer, missing-secret, `verifyToken` throwing,
cache-hit, 401/403, and case-insensitive admin match. Also fixes a real bug found while writing the
test: `verifyClerkToken` returned the Clerk-reported email without lowercasing, so
`requireAdmin`'s `ADMIN_EMAILS.includes(email.toLowerCase())` silently failed for a mixed-case
Clerk profile email — now lowercased once in `verifyClerkToken`. New test
`passes for an ADMIN_EMAILS member regardless of email case` exercises exactly this fix.

### 1070-stripe-webhook-signature-test — VERIFIED
Commit `ff3524b`. New `tests/stripe-webhook-signature.test.ts` drives the real
`server/routes/stripe.ts` webhook handler via `app.inject` with `NODE_ENV=production` and a real
`Stripe.webhooks.generateTestHeaderString` signature — missing signature and wrong signature are
both rejected (4xx, no tokens credited), a correctly-signed request is accepted and credits tokens.
No application bug found; commit message states this explicitly.

### 1071-mcp-publish-checkout — VERIFIED
Commit `910646b`. New `mcp-host-server/src/publish-checkout.ts` (`withPublishCheckout`): keeps a
dedicated worktree checkout synced to `origin/main` via `fetch` + `reset --hard` + `clean -fd`,
stages only the caller-supplied paths, commits with a lock-protected directory mutex
(stale-lock detection via mtime), and retries push up to 3 times with a `fetch` + `rebase` between
attempts. Uses `execFile` (array args) throughout — no shell interpolation. `tests/mcp-publish-
checkout.test.ts` (210 lines) passes in the full run.

### 1072-mcp-budget-contract — VERIFIED
Commit `7ab7ca7`. New `mcp-host-server/src/contract/app-budgets.ts` is the single source of truth
for per-slug gzip budgets (`academy`, `session-manager`, `escape-velocity`, default 200 KB).
`gates/budget.ts` now `gzipSync`s every file actually on disk under `ctx.bundleDir` instead of
trusting the manifest's self-reported size or querying the (sometimes-absent) Turso DB.
`tests/publish-gate.test.ts` updated to write real files and assert on measured, not mocked, sizes,
including a case where the manifest under-reports and the measured size still fails.

### 1073-mcp-a11y-gate-serve-fix — VERIFIED
Commit `abca238`. Exports `startBundleServer(bundleDir, slug)`: strips `/projects/<slug>` from
every request path (not just the golden path), guards path traversal
(`filePath.startsWith(resolvedBundleDir + sep)` check before any read), falls back to
`index.html` only for extension-less paths, adds a full MIME map (`.mjs`, `.wasm`, `.woff`/`.woff2`,
images, `.map`), and loads `axe-core` from the local package via `createRequire(...).resolve(...)`
instead of a CDN script tag, with a 30s `page.goto` timeout.

### 1074-budget-contract-wire — VERIFIED
Commit `509f0b6`. `server/db.ts`'s `app_budgets` seed and `scripts/sanity-qa-runners/size.ts` both
now read `DEFAULT_BUDGET_GZ_BYTES`/`APP_BUDGETS_GZ_BYTES`/`budgetFor` from the same contract file
added in 1072, closing the drift the commit message calls out (academy was 400 KB in QA vs 700 KB
in the gate). `size.ts`'s file-count check now exempts slugs with a contract override. New tests in
`tests/sanity-qa.test.ts` cover default budget, override budget, and the file-count exemption.

### 1075-mcp-tool-input-contract — VERIFIED
Commit `8015b0c`. New `mcp-host-server/src/publish-request.ts`: `projectDir()` validates the slug
against `SlugSchema` and resolves it under a root with an explicit traversal check before any
caller touches the filesystem; `parseBypass()` rejects an unregistered gate name, rejects bypassing
`manifest`, and requires a ≥15-char `bypassReason`; `parseRegistry()` runs the full `RegistrySchema`
over parsed JSON and reports which slug/field failed. `server.ts` is wired to all three — confirmed
by reading the diff (`register_static_project`'s `slug` field now uses `SlugSchema`,
`unregister_project`'s `deleteAssets` path now calls `projectDir()`, `publish_static_project`'s
bypass parsing now goes through `parseBypass()`).

### 1076-mcp-wire-publish-checkout — VERIFIED
Commit `91858b8`. `register_static_project`, `unregister_project`, and `publish_static_project` all
now do their registry read/write and file mutation inside `withPublishCheckout`, operating on the
isolated checkout root, not `HOST_ROOT`. `commitAndPush()` is deleted. `publish_static_project`
swaps the bundle via an `incoming-<pid>` / `old-<pid>` rename dance so a copy failure can't disturb
the live bundle, and cleans up a stale `incoming` dir from a prior failed attempt before copying.
`autoCommit` is removed from all three tool schemas — publishing now always commits and pushes.
`status` additionally reports the publish checkout's `HEAD` sha and whether it matches
`origin/main`. Satisfies plan-level check 4 (no `git commit`/`git push` left against `HOST_ROOT`).

### 1077-mcp-dist-rebuild-sync — VERIFIED
Commit `280520e`. Rebuilds `mcp-host-server/dist/` (it had drifted — missing `contract/`,
`publish-checkout.js`, `publish-request.js`, meaning sibling repos running the MCP from
`dist/server.js` never saw those fixes). Adds `tests/mcp-dist-sync.test.ts`: compiles `src/` fresh
via the TypeScript API into a tmp dir and diffs every emitted `.js` file byte-for-byte against the
committed `dist/`, plus a boot check that `node dist/server.js` starts without
`ERR_MODULE_NOT_FOUND` or a `SyntaxError`. Passes (confirmed in the full `vitest run`).

### 1079-ts-no-unused-flags — VERIFIED
Commit `34adbff`. Flips `noUnusedLocals`/`noUnusedParameters` on in both `tsconfig.json` and
`tsconfig.server.json`, and removes the handful of symbols that flag (unused `useNavigate` import,
unused `ADMIN_EMAILS` import, unused `dbRun` import, two unused callback params renamed `_label`/
`_now`). `pnpm typecheck` is green on the final tree with both flags on.

### 1080-docs-host-contract-publish — VERIFIED
Commit `1f17ced`. Splits `docs/host-contract.md` (662 → ~290 lines) into app-facing contract plus
new `docs/host-internals.md` (Synthetic monitoring, Sanity QA gate, cost controls, static-asset
caching, observability, security headers moved verbatim). Rewrites the publish-gate section to
match the actual code added by 1071–1076: spot-checked the bypass-reason "at least 15 characters"
claim against `publish-request.ts`'s `MIN_BYPASS_REASON_LENGTH = 15`, and the audit-gate claim
("reads vulnerability counts from the JSON output regardless of the process's exit code") against
`gates/audit.ts`, which does parse `stdout` JSON in both the success and the catch branch. Both
check out. `mcp-host-server/README.md` updated to match.

### 1081-claude-md-platform-rules — VERIFIED
Commit `a99598c`. Fixes the Testing section's stale "27 tests / 4 files" claim to "48 files, 672
tests" — matches the real `pnpm vitest run` result exactly. Adds the "Sanctioned app-specific host
code" list and the "What a test must guard" exclusion rules (both now visible verbatim in the
live `CLAUDE.md` loaded for this very validation job). Updates the Shared Hooks list to drop the
deleted `useOgMeta`/`useToolApi` entries and add `useAuth` — confirmed `src/hooks/` contains
`useAuth.tsx` and `usePageView.ts` only, no `useOgMeta.ts`, no `useToolApi.ts`.

## Findings

**Important** — missing PRD archive (process gap, not a code defect in this plan's changes): all
19 PRD markdown files for this plan are unrecoverable from this worktree — they were
apparently never committed to either `prds/`, `prds-archived/`, or an epic's own `prds/` directory,
despite the acceptance criteria for this very validation PRD pointing at exact paths for each of
them. The only reason this validation could be completed at all is that `queue.json`/
`history.jsonl` happened to retain a `landedCommit` SHA per PRD. If those state files are ever
pruned or rotated before a plan is validated, a future validator would have no way to tie a slug to
a commit, or to read the actual acceptance criteria that were promised. Recommend the scheduler (or
the `/develop` skill that authors PRDs) persist each archived PRD's file into
`prds-archived/<slug>.md` as part of its own completion step, not just a scheduler-state record.

No other findings. All 19 commits are internally consistent with their own messages, consistent
with each other (no later PRD undoes an earlier one's fix), and the plan-level security/behavior
checks (verified-email-only entitlement, no direct `HOST_ROOT` git mutation, path-traversal guards
on every slug-derived filesystem path, `execFile` instead of shell `exec`, dist/src sync) all hold
on the real tree.

## Sentinel

VALIDATION: 1062-registry-contract-schema VERIFIED
VALIDATION: 1063-registry-contract-wire-host VERIFIED
VALIDATION: 1064-tool-entitlement-verified-email VERIFIED
VALIDATION: 1065-repo-hygiene-dead-config VERIFIED
VALIDATION: 1066-tool-entitlement-wire-a VERIFIED
VALIDATION: 1067-tool-entitlement-wire-b VERIFIED
VALIDATION: 1068-delete-low-value-tests VERIFIED
VALIDATION: 1069-clerk-auth-real-tests VERIFIED
VALIDATION: 1070-stripe-webhook-signature-test VERIFIED
VALIDATION: 1071-mcp-publish-checkout VERIFIED
VALIDATION: 1072-mcp-budget-contract VERIFIED
VALIDATION: 1073-mcp-a11y-gate-serve-fix VERIFIED
VALIDATION: 1074-budget-contract-wire VERIFIED
VALIDATION: 1075-mcp-tool-input-contract VERIFIED
VALIDATION: 1076-mcp-wire-publish-checkout VERIFIED
VALIDATION: 1077-mcp-dist-rebuild-sync VERIFIED
VALIDATION: 1079-ts-no-unused-flags VERIFIED
VALIDATION: 1080-docs-host-contract-publish VERIFIED
VALIDATION: 1081-claude-md-platform-rules VERIFIED
SCHEDULER_VERDICT: PASS
