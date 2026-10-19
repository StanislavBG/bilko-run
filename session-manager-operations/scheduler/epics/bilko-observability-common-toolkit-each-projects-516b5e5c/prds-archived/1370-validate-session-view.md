---
title: Validate: Session View — pick a user session and step through what they clicked, in order
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T19:21:34.588Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
tag: build
agentType: validator
dependsOn: [session-steps-helper, session-player-component, session-view-page, session-view-entry-links]
planId: pl-mve7llht-15f8de
---
# Goal

validate: verify the Session View plan. PRDs: session-steps-helper (step and page-visit builder); session-player-component (SessionPlayer journey strip, step card and controls); session-view-page (/admin/sessions picker and /admin/sessions/:id player route); session-view-entry-links (links from the Sessions panel and the Observability page).

# Acceptance criteria

- [ ] session-steps-helper: the PRD file under $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/bilko-observability-common-toolkit-each-projects-516b5e5c/prds/ (or prds-archived/), found by slug, is VERIFIED against its criteria.
- [ ] session-player-component: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. The play interval is cleaned up and keyboard handling is scoped to the player element.
- [ ] session-view-page: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. The page is admin-gated and the ?step deep link round-trips.
- [ ] session-view-entry-links: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] Combined: the full pnpm vitest run and pnpm typecheck are green on the final tree.
- [ ] Write and commit session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-session-view.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-session-view.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 9ff5e673cd3dfc599aa60c26546392b0ca56d057

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
