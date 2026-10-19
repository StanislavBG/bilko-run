---
title: Validate: every project on /projects shows its real landing-page screenshot, live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-14T01:59:29.242Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
tag: build
agentType: validator
dependsOn: [project-screenshots-capture, project-screenshots-wire, project-screenshots-publish]
planId: pl-mv7gnqik-e4cc0a
---
# Goal

validate: the project-screenshots plan — project-screenshots-capture (one-shot capture script + committed images/JSON), project-screenshots-wire (hero shows them), project-screenshots-publish (push + verify live). Owner ask: the Projects Ring hero had only placeholders; every project should show its landing page.

# Acceptance criteria

- [ ] project-screenshots-capture verified against /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/project-landing-page-design-fully-follow-and-imp-ea2c8617/prds/1338-project-screenshots-capture.md (or prds-archived/), including opening a sample of the committed images to confirm they are real landing pages, not blank/error/sign-in pages.
- [ ] project-screenshots-wire verified against .../prds/1339-project-screenshots-wire.md (or prds-archived/).
- [ ] project-screenshots-publish verified against .../prds/1340-project-screenshots-publish.md (or prds-archived/), including a live screenshot of https://bilko.run/projects with a real image in the hero.
- [ ] Write and commit session-manager-operations/reviews/validation/project-landing-page-design-fully-follow-and-imp-ea2c8617/validate-project-screenshots.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/project-landing-page-design-fully-follow-and-imp-ea2c8617/validate-project-screenshots.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: a3d40ce

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
