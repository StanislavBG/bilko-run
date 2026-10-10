# Validation: workflows cleanup plan (PRDs 1200-1207)

Base: 3f50c16643dba1483180c6488fdf098de10aed03. HEAD: d5b4e2f (= origin/main). Validated 2026-10-10 PDT.
Commits: 247e7f6 (1200), 9091b4d (1201), 97ddf8b (1202), 41f064f (1203), 8649750 (1204), 382a579 (1205), 35dab2f (1206), d5b4e2f (1207).

Gate runs (fresh `pnpm install --frozen-lockfile --offline` in the job worktree): `pnpm typecheck` exit 0; `pnpm build` ok (index-DpzKiFP7.js); `pnpm --filter host-kit test|typecheck|build` all exit 0.
`pnpm vitest run` is **flaky here**: 3 full runs failed 4, 2 and 2 different files, each with `SQLITE_BUSY: database is locked` (shared on-disk DB, concurrent jobs). Re-running the failed files (plus retired-demo-endpoints and tool-gateway-wire) alone: 8 files / 88 tests pass. Run 1 totals: 76 files, 923 tests (902 passed, 21 skipped), matching CLAUDE.md. Not attributable to this plan.

## 1200 remove-workflows-page — VERIFIED
- src/pages/WorkflowsPage.tsx absent; no WorkflowsPage in src/App.tsx.
- Redirect route plus retirement comment beside /packages (src/App.tsx diff: `<Route path="/workflows" element={<Navigate to="/projects" replace />} />`).
- `id: 'workflows'` removed from src/data/portfolio.ts; `/workflows` branch removed from src/components/Layout.tsx.
- `grep -c pf-wf- src/styles/portfolio.css` = 0.
- typecheck and tests as above.

## 1201 host-kit-drop-workflows-section — VERIFIED
- packages/host-kit/src/SiteHeader.tsx DEFAULT_SECTIONS = Home, Projects, Blog, Academy, Contact.
- .changeset/site-header-drop-workflows.md: `"host-kit": patch` plus one-sentence body.
- No "workflows" references remain in host-kit src/tests; host-kit test/typecheck/build exit 0.

## 1202 remove-workflows-data-pipeline — VERIFIED
- The six files (workflowsView.ts, workflows.json, refresh-workflows.ts, workflows-allowlist.ts, lib/workflows.ts, tests/workflows.test.ts) are absent from the diff stat as deletions.
- scripts/sanity-qa-cron.sh: refresh step removed, `git add` stages only commit-order.json and commit-counts.json; `bash -n` ok.
- Negative grep over src server scripts tests shared: no matches (rc=1).

## 1203 trim-dead-portfolio-css — VERIFIED
- portfolio.css shrank 353 lines. Every `pf-*` token referenced outside portfolio.css that lacks a `.pf-` rule (pf-bg, pf-ink*, pf-paper, pf-rule, pf-font-*, pf-head, pf-hero-grid, pf-ord) also had 0 rules in the base file (CSS vars or never styled), so no still-used class lost its rule. No dynamic `pf-${` construction in src.
- build passes.

## 1204 remove-dead-demo-endpoints — VERIFIED
- email-capture.ts deleted; index.ts no longer imports or calls it; /unlock route removed from headline-grader.ts; resetUsage and clearCeilingCache removed with no remaining references; unused imports dropped.
- db-schema.ts untouched (not in diff stat).
- tests/retired-demo-endpoints.test.ts: 3 tests pass; tool-gateway-wire passes (scoring route intact). Live: POST /api/demos/headline-grader returns 400 (validation, not 404).

## 1205 remove-orphan-script-and-exports — VERIFIED
- scripts/render-deploy.sh deleted; no live-doc reference (grep over CLAUDE.md, README.md, docs/host-contract.md, host-internals.md, deployment.md: none).
- Panel (parts.tsx), AskRequest (academy-models.ts), LandingPages (copy.ts) removed; `git grep -nw` shows no remaining uses.

## 1206 claude-md-recount-after-cleanup — VERIFIED
- CLAUDE.md now says 76 files, 923 tests; fresh vitest run reports 76 files / 923 tests.
- Live-doc grep for workflows/render-deploy references: no hits.

## 1207 publish-workflows-cleanup — VERIFIED
- origin/main = d5b4e2f, which is the HEAD of this plan; publish.md exists in the repo (it records 35dab2f as the pushed SHA, and later docs commits followed).
- Live, 2026-10-10 10:14 PDT: served bundle /assets/index-DpzKiFP7.js lacks "Background AI agents and automations"; POST /api/demos/email-capture = 404; POST /api/demos/headline-grader/unlock = 404; /projects = 200 (after redirect).

## Findings
### Critical
- none
### Important
- none
### Minor
- The full vitest suite is not reliable when other jobs share the SQLite file (SQLITE_BUSY, different files on each run). Passing in isolation. Consider per-run DB paths in tests (unrelated to this plan).
- publish.md's pushed SHA (35dab2f) is not the final origin/main (d5b4e2f); only docs commits followed (35dab2f..d5b4e2f), so this is harmless.
- /workflows now returns 200 from the SPA and redirects client-side to /projects, as designed (no server-side 301).
- Self-review of the combined diff: only deletions plus a 58-line test; no new input handling, secrets or path handling. Removing /unlock closes an unauthenticated free-tier counter reset. `/code-review` and `/security-review` were not run as separate tools; reviewed by hand.
