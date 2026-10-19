---
title: Validate: simpler, faster, clearer bilko.run host (code quality + docs pass)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T19:48:11.671Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
tag: build
agentType: validator
dependsOn: [ci-typecheck-tests-on-push, publish-lock-wait-configurable, readability-test-direct-tsx, tests-in-memory-db, docs-archive-historical, env-example-and-dev-env-file, app-shell-lazy-routes, remove-dead-tools-config, fonts-and-global-css-trim, tool-credit-deduct-check, games-limit-clamp, feedback-list-skip-image-blobs, remove-social-roast, server-shutdown-flush-og-precompute, readme-plain-language, claude-md-truth-and-sanctioned-list]
planId: pl-mv1dgcto-8ab552
---
# Goal

validate. Plan slugs and titles: 1083 ci-typecheck-tests-on-push (CI on push/PR); 1084 publish-lock-wait-configurable (cut 60s from tests); 1085 readability-test-direct-tsx; 1086 tests-in-memory-db; 1087 docs-archive-historical; 1088 env-example-and-dev-env-file; 1089 app-shell-lazy-routes; 1094 remove-dead-tools-config; 1095 fonts-and-global-css-trim; 1090 tool-credit-deduct-check; 1091 games-limit-clamp; 1092 feedback-list-skip-image-blobs; 1093 remove-social-roast; 1096 server-shutdown-flush-og-precompute; 1097 readme-plain-language; 1098 claude-md-truth-and-sanctioned-list.

# Acceptance criteria

- [ ] 1083-ci-typecheck-tests-on-push: verified against /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/review-the-project-for-code-quality-perofmance-i-c56527b0/prds/1083-ci-typecheck-tests-on-push.md (or prds-archived/, find by slug).
- [ ] 1084-publish-lock-wait-configurable: verified against its PRD file in the same epic prds/ or prds-archived/ folder.
- [ ] 1085-readability-test-direct-tsx: verified against its PRD file.
- [ ] 1086-tests-in-memory-db: verified against its PRD file.
- [ ] 1087-docs-archive-historical: verified against its PRD file.
- [ ] 1088-env-example-and-dev-env-file: verified against its PRD file.
- [ ] 1089-app-shell-lazy-routes: verified against its PRD file.
- [ ] 1094-remove-dead-tools-config: verified against its PRD file.
- [ ] 1095-fonts-and-global-css-trim: verified against its PRD file.
- [ ] 1090-tool-credit-deduct-check: verified against its PRD file.
- [ ] 1091-games-limit-clamp: verified against its PRD file.
- [ ] 1092-feedback-list-skip-image-blobs: verified against its PRD file.
- [ ] 1093-remove-social-roast: verified against its PRD file.
- [ ] 1096-server-shutdown-flush-og-precompute: verified against its PRD file.
- [ ] 1097-readme-plain-language: verified against its PRD file.
- [ ] 1098-claude-md-truth-and-sanctioned-list: verified against its PRD file.
- [ ] Whole-plan check: `pnpm typecheck`, `pnpm test` and `pnpm build` are green on the combined tree.
- [ ] Write and commit session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-host-simplification.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-host-simplification.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 756f65a0b1d63170de5ea1a1b23e957063abf3e0

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
