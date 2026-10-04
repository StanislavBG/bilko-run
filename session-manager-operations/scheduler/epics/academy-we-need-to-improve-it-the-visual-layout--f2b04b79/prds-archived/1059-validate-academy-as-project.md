---
title: Validate: Academy becomes a regular project and /projects is ordered by commit count
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T22:24:48.603Z
sourcePromptId: academy-we-need-to-improve-it-the-visual-layout--f2b04b79
tag: build
agentType: validator
dependsOn: [academy-retire-inrepo-pages, academy-drop-nav-section, projects-commit-counts-sidecar, projects-sort-by-commit-count]
planId: pl-musylbxr-9425e2
---
# Goal

Type: validate. Validate the plan: academy-retire-inrepo-pages (Retire the old in-repo /academy pages and redirect them to the Academy course), academy-drop-nav-section (Remove Academy as a top-level site section), projects-commit-counts-sidecar (Bake per-project commit counts alongside last-commit dates), projects-sort-by-commit-count (Order /projects by commit count (hidden) and list Academy publicly).

# Acceptance criteria

- [ ] academy-retire-inrepo-pages verified against session-manager-operations/scheduler/epics/academy-we-need-to-improve-it-the-visual-layout--f2b04b79/prds/1055-academy-retire-inrepo-pages.md (or prds-archived/ beside it).
- [ ] academy-drop-nav-section verified against .../prds/1056-academy-drop-nav-section.md (or prds-archived/).
- [ ] projects-commit-counts-sidecar verified against .../prds/1057-projects-commit-counts-sidecar.md (or prds-archived/).
- [ ] projects-sort-by-commit-count verified against .../prds/1058-projects-sort-by-commit-count.md (or prds-archived/).
- [ ] Write and commit session-manager-operations/reviews/validation/academy-we-need-to-improve-it-the-visual-layout--f2b04b79/validate-academy-as-project.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/academy-we-need-to-improve-it-the-visual-layout--f2b04b79/validate-academy-as-project.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 45a960b1ba2b6ef963ca12db4e6fca0fe4e7b6c5
Combined-diff checks worth doing: full `pnpm test` still green; no remaining import of deleted Academy files; no commit count rendered on /projects; footer/nav still list every remaining section.

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
