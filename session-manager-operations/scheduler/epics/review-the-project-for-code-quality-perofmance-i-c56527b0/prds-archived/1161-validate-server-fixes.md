---
title: Validate: server speed and safety fixes (caching, batching, error handling, auth, analytics, Stripe attribution)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:17:48.118Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: validator
dependsOn: [project-events-cache, egress-batch-flush, analytics-pageview-hardening, manual-service-cache, blog-list-cache, server-error-handler, auth-reply-hardening, games-leaderboard-index, analytics-admin-queries, webhook-unknown-price, server-dev-routes-og-copy, server-dead-exports]
planId: pl-mv1kqg3p-1cba31
---
# Goal

validate. Plan: 1119 project-events-cache; 1120 egress-batch-flush; 1122 analytics-pageview-hardening; 1124 manual-service-cache; 1126 blog-list-cache; 1127 server-error-handler; 1128 auth-reply-hardening; 1129 games-leaderboard-index; 1141 analytics-admin-queries; 1142 webhook-unknown-price; 1143 server-dev-routes-og-copy; 1154 server-dead-exports.

# Acceptance criteria

- [ ] 1119-project-events-cache verified against its PRD in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/review-the-project-for-code-quality-perofmance-i-c56527b0/prds/ or prds-archived/ (find by slug).
- [ ] 1120-egress-batch-flush verified.
- [ ] 1122-analytics-pageview-hardening verified.
- [ ] 1124-manual-service-cache verified.
- [ ] 1126-blog-list-cache verified.
- [ ] 1127-server-error-handler verified.
- [ ] 1128-auth-reply-hardening verified.
- [ ] 1129-games-leaderboard-index verified.
- [ ] 1141-analytics-admin-queries verified.
- [ ] 1142-webhook-unknown-price verified.
- [ ] 1143-server-dev-routes-og-copy verified.
- [ ] 1154-server-dead-exports verified.
- [ ] Whole plan: `pnpm typecheck`, `pnpm test`, `pnpm build` green; write and commit session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-server-fixes.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-server-fixes.md

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
