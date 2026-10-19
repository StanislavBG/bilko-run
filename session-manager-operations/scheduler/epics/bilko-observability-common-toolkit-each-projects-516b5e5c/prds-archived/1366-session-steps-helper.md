---
title: Session View: step builder (ordered clicks, page visits, dwell)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-18T19:19:13.938Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
disposition: new-head
planId: pl-mve7llht-15f8de
---
# Goal

primitive: the admin Session View lets the owner pick one user session and step through, in order, every page the user saw and every click they made on bilko.run. It needs a pure function that turns the merged session timeline from GET /api/admin/sessions/:id into numbered steps and page visits. Each page visit carries its dwell time and click count, so the player UI stays thin.

# Acceptance criteria

- [ ] New src/lib/sessionSteps.ts exports the type TimelineItem, the same union as server/routes/admin-sessions.ts lines 31-34 (view, click, event, error).
- [ ] src/lib/sessionSteps.ts also exports the types Step = { index, ts, offsetMs, kind, path, title, detail, pageIndex, count } and PageVisit = { index, path, enteredAt, dwellMs, clickCount, firstStepIndex }, and buildSessionSteps(timeline: TimelineItem[], startedAt?: number): { steps: Step[]; pages: PageVisit[] }.
- [ ] Ordering: buildSessionSteps sorts by ts ascending (stably). offsetMs is measured from startedAt, else from the first item. A 'view' whose path equals the current page's path is dropped as a duplicate. Consecutive clicks with the same path and label/track_name within 1000 ms collapse into one step with count incremented.
- [ ] Titles: a click's title is its track_name, else its label, else its href, else '(unlabeled click)'; detail holds the href when present. A view's title is its path. An event's title is its name. An error's title is 'Error: ' + msg.
- [ ] Pages: a new PageVisit starts at each view, or at a click or event whose path differs from the current page. dwellMs is the time until the next page's enteredAt (for the last page, the time until the last step); clickCount counts the click steps on that page.
- [ ] Also exported: filterSteps(steps: Step[], mode: 'all' | 'clicks'): Step[] ('clicks' keeps the click and view steps). New tests/session-steps.test.ts covers ordering of unsorted input, duplicate-view dropping, double-click collapse with count 2, title fallbacks, page dwell and click counts, the clicks filter, and empty input returning empty arrays.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/lib/sessionSteps.ts
- tests/session-steps.test.ts

# Implementation notes

Read first: server/routes/admin-sessions.ts lines 25-40 and 275-311 (the timeline item shapes and the GET /api/admin/sessions/:id response); src/pages/admin/SessionsPanel.tsx lines 23-68 (the existing describe/entryPath helpers to stay consistent with; do not modify that file).

Make it pure: no React, no DOM, no fetch.

Do not touch: SessionsPanel.tsx, server files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/session-steps.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
