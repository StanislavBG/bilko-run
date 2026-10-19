---
title: Validate: admin and frontend code is simpler (shared admin hook, split AdminPage, registry-driven listing, lighter bundle)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:18:19.220Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: validator
dependsOn: [admin-api-hook, film-dialog-progress-rerender, registry-client-slim, frontend-dead-exports, document-title-hook, registry-public-fields-schema, admin-pages-wire, adminpage-split-1, projects-view-from-registry, adminpage-split-2, manual-page-hooks, adminpage-split-3, sm-landing-hooks, sm-pages-folder-move]
planId: pl-mv1ktdhy-60aef1
---
# Goal

validate. Plan: 1130 admin-api-hook; 1131 film-dialog-progress-rerender; 1132 registry-client-slim; 1133 frontend-dead-exports; 1136 document-title-hook; 1134 registry-public-fields-schema; 1147 admin-pages-wire; 1148 adminpage-split-1; 1149 projects-view-from-registry; 1152 adminpage-split-2; 1153 manual-page-hooks; 1156 adminpage-split-3; 1157 sm-landing-hooks; sm-pages-folder-move.

# Acceptance criteria

- [ ] Each of the 14 listed PRDs (find each by slug in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/review-the-project-for-code-quality-perofmance-i-c56527b0/prds/ or prds-archived/; ignore the archived 1158-sm-pages-folder, superseded by sm-pages-folder-move) gets its own VERIFIED/REFUTED line with evidence.
- [ ] UI check: build the site, start it locally under timeout, and load /, /projects, /blog, /admin (signed out → admin gate), /products/session-manager and its manual. Each renders without console errors (Playwright or curl of the SPA plus a headless check); report per page.
- [ ] Whole plan: `pnpm typecheck`, `pnpm test`, `pnpm build` green; write and commit session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-frontend-simplification.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-frontend-simplification.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: f6c830b41387627d97916c1af828bf4c1472dae1

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
