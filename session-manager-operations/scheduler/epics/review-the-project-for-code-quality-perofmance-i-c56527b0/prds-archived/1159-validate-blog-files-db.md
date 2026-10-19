---
title: Validate: blog posts live as files and server/db.ts is just the database (faster boot, real secret names)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:17:36.988Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: validator
dependsOn: [blog-posts-loader, blog-posts-migrate, blog-pipeline-seed-path, blog-skill-docs-seed-path, db-boot-batch, db-schema-split, secret-metadata-names]
planId: pl-mv1kpii1-1d18b9
---
# Goal

validate. Plan: 1115 blog-posts-loader; 1137 blog-posts-migrate; 1144 blog-pipeline-seed-path; 1145 blog-skill-docs-seed-path; 1146 db-boot-batch; 1150 db-schema-split; 1151 secret-metadata-names.

# Acceptance criteria

- [ ] 1115-blog-posts-loader verified against its PRD in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/review-the-project-for-code-quality-perofmance-i-c56527b0/prds/ or prds-archived/ (find by slug).
- [ ] 1137-blog-posts-migrate verified (including the before/after blog_posts equivalence evidence).
- [ ] 1144-blog-pipeline-seed-path verified (watchdog consistency check passes without publishing).
- [ ] 1145-blog-skill-docs-seed-path verified.
- [ ] 1146-db-boot-batch verified.
- [ ] 1150-db-schema-split verified.
- [ ] 1151-secret-metadata-names verified.
- [ ] Whole plan: `pnpm typecheck`, `pnpm test`, `pnpm build` green; write and commit session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-blog-files-db.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-blog-files-db.md

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
