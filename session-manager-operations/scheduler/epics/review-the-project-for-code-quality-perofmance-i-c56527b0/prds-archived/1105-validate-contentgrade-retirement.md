---
title: Validate: ContentGrade is retired from bilko.run (no sales, no license keys, no public mentions)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T21:30:18.888Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: validator
dependsOn: [stripe-retire-contentgrade-pro, blog-scrub-contentgrade-mentions, delete-contentgrade-license-code, contentgrade-docs-license-env]
planId: pl-mv1hacoj-72fbb4
---
# Goal

validate. Plan slugs and titles: 1101 stripe-retire-contentgrade-pro (stop selling ContentGrade Pro, no license-key issuance); 1102 blog-scrub-contentgrade-mentions (two published posts stop naming Content-Grade); 1103 delete-contentgrade-license-code (license API and service deleted); 1104 contentgrade-docs-license-env (LICENSE copyright, .env.example, CLAUDE.md).

# Acceptance criteria

- [ ] 1101-stripe-retire-contentgrade-pro: checked against /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/review-the-project-for-code-quality-perofmance-i-c56527b0/prds/1101-stripe-retire-contentgrade-pro.md (or prds-archived/, find by slug).
- [ ] 1102-blog-scrub-contentgrade-mentions: checked against its PRD file in the same epic prds/ or prds-archived/ folder.
- [ ] 1103-delete-contentgrade-license-code: checked against its PRD file.
- [ ] 1104-contentgrade-docs-license-env: checked against its PRD file.
- [ ] Whole-plan check: `git grep -n -i -E 'content.?grade|CG-'` over server/, shared/, src/, LICENSE and .env.example lists only the allowed leftovers: the legacy priceToPlanTier env names, the internal contentgrade.db filename and the db.ts column default. `pnpm typecheck`, `pnpm test` and `pnpm build` are green.
- [ ] Write and commit session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-contentgrade-retirement.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-contentgrade-retirement.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: cb9feb41391c924d483d68e111febc9806a02683

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
