# Validation: docs current-only plan

Base: 428d30dd (from PRD notes). Combined diff: 31 files, +845/-1192. Gates re-run in the foreground in the job worktree.
Review tooling: no separate /code-review or /security-review run; self-reviewed the diff (docs, one shell script, one TS string, CI step). No secrets, no unsafe input handling; docs-guard.sh only reads tracked files and its test uses mkdtemp fixtures.

Gate results: `bash scripts/docs-guard.sh` -> `clean (14 files)`; each per-doc guard run clean; `pnpm vitest run` on docs-guard, publish-gate, mcp-dist-sync, blog-cadence-watchdog, blog-watchdog-env, blog-watchdog-heartbeat, sync-local-main, mcp-host-contract-tool, identity-guard -> 9 files, 152 tests pass. Orphan-dir check clean. `git grep -F` for coffee-checkouts-verdict / session-manager-chat.html / release.yml.tmpl outside session-manager-operations -> no hits.

## docs-guard-script: VERIFIED
scripts/docs-guard.sh (143 lines) + tests/docs-guard.test.ts (16 tests pass, mkdtemp fixtures) + package.json `docs:guard`. Clean run prints `docs-guard: clean (14 files)`.

## delete-orphan-docs: VERIFIED
docs/stripe/ and docs/feature-showcase/ absent; no stale grep hits.

## golden-template-path: VERIFIED
mcp-host-server/src/gates/golden.ts and dist/gates/golden.js name the GitHub template URL; tests/publish-gate.test.ts asserts the text; mcp-dist-sync passes.

## blog-comments-drop-repo-writers-cites: VERIFIED
No `repo-writers` in either file. FATAL message keeps meaning, stderr, exit path. Remaining dated comments in these files (e.g. watchdog lines 6, 22, 143) are untouched older comments, not the edited ones, so the criterion ("in the edited comments") holds. Three watchdog tests pass.

## repo-writers-current-only: VERIFIED
docs/repo-writers.md is 37 lines (<=45), guard clean; sync-local-main.sh header no longer cites the removed heading; tests/sync-local-main.test.ts passes; BLOG_DRAFT_CONTEXT moved to content/blog/README.md (+15 lines in diff).

## host-contract-current-only: VERIFIED
Guard clean, 809 lines (<=900), contents list links all 24 `##` headings, 16,000-char manifest limit stated (docs/host-contract.md:460), 100 MiB rule stated at :532, no usePageView, no "owner decision". mcp-host-contract-tool test passes.

## host-contract-move-host-only: VERIFIED
Host sections moved with pointers (host-internals.md#react-route-apps, #host-stack-and-code-helpers, #admin-and-webhook-internals, #game-services-config, #room-and-play-currency-wiring, #web-product-host-steps; deployment.md#env-vars). All cited anchors resolve (checked by slugifying headings). The superseding fix PRD's cap (<=809 lines) holds at exactly 809; the original 650-line cap was explicitly replaced by that PRD.

## host-internals-current-only: VERIFIED
Guard clean; `Sanctioned app-specific host code` heading present, anchor resolves; 313 lines.

## deployment-current-only: VERIFIED
Guard clean; `## Env vars` and `## Realtime relay constraints` anchors resolve; .env.example gained 39 lines of empty-valued entries.

## commerce-current-only: VERIFIED
Guard clean; analytics text now points to observability.md#visitor-classes (resolves); host-contract.md#play-currency resolves and commerce anchor `play-currency-three-winds-taels` resolves.

## observability-current-only: VERIFIED
Guard clean; `rate_limited` without Retry-After (:148), `quota_exceeded` with retryAfterSec (:149); errors_report, error_detail, usage_report, git_viewer_report in the table (:198-201); heading `11. Reading your numbers through the bilko-host MCP` and `9. Tagging taxonomy` kept.

## small-docs-current-only: VERIFIED
Guard clean on secrets-rotation, project-feedback-api, site.

## identity-boundary-current-only: VERIFIED
Guard clean; identity-guard.sh warning names "Older revisions"; identity-guard tests pass.

## publishing-contract-by-hand: VERIFIED
Guard clean; by-hand flow (pack, scan, publish, cache-busted verify) at docs/publishing-contract.md:145-152; release.yml.tmpl deleted with no references.

## map-claude-md-current-only: VERIFIED
docs/map.md is 49 lines (<=70); guard clean on map/CLAUDE.md/README.md; content-grade rule and test-count line removed from CLAUDE.md; map comment carries last-review 2026-11-22.

## docs-guard-in-ci: VERIFIED
.github/workflows/ci.yml:59 `Docs guard` runs `bash scripts/docs-guard.sh` after the Identity scan step; other steps unchanged in the diff.

## Cross-cutting: stale references
Deleted docs and changed headings were grepped without a file-type filter outside session-manager-operations/: no stale references to deleted files; all `*.md#anchor` references in docs and code resolve. One stale content-grade rule remains (below), so this criterion is met for files and headings but not for the removed rule.

## Findings

### Critical
none

### Important
none

### Minor
- docs/deployment.md:75: still states "Never push Bilko to the `content-grade` remote", the rule the map PRD removed from map.md and CLAUDE.md because that remote no longer exists. Restate as "push only to origin main".
- scripts/blog-cadence-watchdog.sh:216 and scripts/sanity-qa-cron.sh:72: comments still cite the removed content-grade hard rule (code unchanged; comment-only drift).
- Review-tool note: /code-review and /security-review were not run; self-review only.
