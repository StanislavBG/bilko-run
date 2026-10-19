---
title: CLAUDE.md + host contract: remove stale claims, complete the sanctioned app-specific list, real test numbers
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T19:47:33.245Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [ci-typecheck-tests-on-push, publish-lock-wait-configurable, readability-test-direct-tsx, tests-in-memory-db, docs-archive-historical, env-example-and-dev-env-file, app-shell-lazy-routes, remove-dead-tools-config, fonts-and-global-css-trim, tool-credit-deduct-check, games-limit-clamp, feedback-list-skip-image-blobs, remove-social-roast, server-shutdown-flush-og-precompute, readme-plain-language]
planId: pl-mv1dgcto-8ab552
---
# Goal

doc. CLAUDE.md is the instruction file every future agent and maintainer reads, and several claims are now false: it documents a deleted src/components/tool-page/ kit, a useAuth hook (deleted by app-shell-lazy-routes), says no react-route apps exist (Session Manager is one), has stale test counts, and its sanctioned app-specific list misses half of Session Manager's footprint. docs/host-contract.md and packages/host-kit/docs/host-contract.md carry the same drift. Make all three match the tree as it is after this plan's other PRDs.

# Acceptance criteria

- [ ] CLAUDE.md: the 'Shared Component Kit (src/components/tool-page/)' section and the useAuth hook line are removed; 'Current apps' says Session Manager is the one react-route app at /products/session-manager; the /products mention in the portfolio paragraph reflects that /products redirects to /projects; links to moved docs point into docs/archive/.
- [ ] CLAUDE.md 'Sanctioned app-specific host code' adds: shared/academy-models.ts (Academy); shared/manual-catalog.ts, server/services/manual.ts, src/lib/manualClient.ts, src/pages/SessionManagerPage.tsx, src/pages/ManualPage.tsx, src/styles/session-manager-*.css, data/manual/ (Session Manager); and notes server/routes/license.ts + server/services/license.ts as legacy ContentGrade license code pending an owner decision.
- [ ] CLAUDE.md Testing line states the real counts from `pnpm vitest run` output (files and tests) and mentions CI (.github/workflows/ci.yml); a one-line pointer to README.md 'Where things live' is added near the top.
- [ ] docs/host-contract.md: references to the tool-page kit / useToolApi hook and 'react-route = the AI-tool family' are corrected (react-route is now only Session Manager; AI tools are static-path siblings with host gateway routes).
- [ ] packages/host-kit/docs/host-contract.md is replaced by a short pointer to the canonical docs/host-contract.md (relative link) so the two can no longer drift.
- [ ] Every path CLAUDE.md names as existing is checked with ls/git ls-files; the report lists any still-missing path.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- CLAUDE.md
- docs/host-contract.md
- packages/host-kit/docs/host-contract.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko. All earlier PRDs of this plan have landed; read the tree, not memory.

Read first: CLAUDE.md (whole); docs/host-contract.md lines 1-60; packages/host-kit/docs/host-contract.md (head); `ls src/components src/hooks src/config docs docs/archive`.

Run `timeout 400 pnpm vitest run` once to get the real counts.

Do not touch: README.md, any code, any other doc.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
