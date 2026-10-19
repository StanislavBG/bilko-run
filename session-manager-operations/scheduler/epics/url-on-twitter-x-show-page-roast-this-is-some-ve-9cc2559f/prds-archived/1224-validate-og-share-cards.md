---
title: Validate: links shared from bilko.run show the right, current project card on X (not PageRoast)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T21:51:28.265Z
sourcePromptId: url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f
tag: build
agentType: validator
dependsOn: [og-meta-resolver, og-image-renderer, og-base-html-refresh, og-wire-routes, og-host-contract-doc, og-live-verify]
planId: pl-mv2xgl7c-32470c
---
# Goal

validate: confirm the plan that replaces bilko.run's stale PageRoast / 'AI Advisory for Small Business' share card with registry-driven per-project cards. PRDs: og-meta-resolver (Social-card metadata resolver), og-image-renderer (Social-card image renderer), og-base-html-refresh (Refresh the stale base share card), og-wire-routes (Wire social cards into the server), og-host-contract-doc (Document host-generated social cards), og-live-verify (Ship and verify live).

# Acceptance criteria

- [ ] og-meta-resolver VERIFIED against /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f/prds/1218-og-meta-resolver.md (or prds-archived/, find by slug).
- [ ] og-image-renderer VERIFIED against .../prds/1219-og-image-renderer.md (or prds-archived/).
- [ ] og-base-html-refresh VERIFIED against .../prds/1220-og-base-html-refresh.md (or prds-archived/).
- [ ] og-wire-routes VERIFIED against .../prds/1221-og-wire-routes.md (or prds-archived/).
- [ ] og-host-contract-doc VERIFIED against .../prds/1222-og-host-contract-doc.md (or prds-archived/).
- [ ] og-live-verify VERIFIED against .../prds/1223-og-live-verify.md (or prds-archived/), including its committed og-live-check.md record.
- [ ] Write and commit session-manager-operations/reviews/validation/url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f/validate-og-share-cards.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f/validate-og-share-cards.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 3f0111bd92a98bfca6a5930bff1430f40404410c
PRD files live under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f/ (prds/ while queued, prds-archived/ once done).

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
