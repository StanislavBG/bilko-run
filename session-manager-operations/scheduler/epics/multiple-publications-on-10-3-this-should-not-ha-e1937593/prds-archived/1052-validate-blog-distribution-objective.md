---
title: Validate: blog distribution objective (LinkedIn-ready, no marketing, real URLs)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T21:10:05.464Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
tag: build
agentType: validator
dependsOn: [blog-distribution-objective-policy, blog-readability-marketing-and-real-links, blog-readability-live-link-check]
planId: pl-musvxkkz-0193ba
---
# Goal

validate: blog-distribution-objective-policy (distribution block, voice + SKILL rules), blog-readability-marketing-and-real-links (marketing blocklist + registry-checked project links), blog-readability-live-link-check (--check-live before seeding).

# Acceptance criteria

- [ ] blog-distribution-objective-policy (session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/prds/1049-blog-distribution-objective-policy.md, or prds-archived/) VERIFIED.
- [ ] blog-readability-marketing-and-real-links (.../prds/1050-blog-readability-marketing-and-real-links.md) VERIFIED, including that the checker's DEFAULT marketing list matches blog.config.yaml distribution.marketing_blocklist.
- [ ] blog-readability-live-link-check (.../prds/1051-blog-readability-live-link-check.md) VERIFIED, including one real run of `npx tsx scripts/blog-readability.ts <a temp draft linking https://bilko.run/projects/outdoor-hours/> --check-live` exiting 0, and exiting 1 for https://bilko.run/projects/does-not-exist-xyz/ (if the host returns 200 for unknown paths, record that as a finding).
- [ ] Write and commit session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-distribution-objective.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/multiple-publications-on-10-3-this-should-not-ha-e1937593/validate-blog-distribution-objective.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 93dbb33

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
