---
title: Session View: SessionPlayer component (journey strip, step card, prev/next/play)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-18T19:20:37.252Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-steps-helper]
planId: pl-mve7llht-15f8de
---
# Goal

behavior: build the visual core of the Session View, a player that shows one user session as a sequence. A journey strip shows the pages visited in order. A large card shows the current step: what was clicked, on which page, and at what time offset. A numbered step list sits beside it, and Prev/Next/Play controls step through the clicks in order.

# Acceptance criteria

- [ ] New src/pages/admin/SessionPlayer.tsx exports SessionPlayer({ timeline, startedAt, initialStep?, onStepChange? }). It computes steps and pages with buildSessionSteps from src/lib/sessionSteps.ts (memoized), and filterSteps applies the All / Clicks-only toggle.
- [ ] Journey strip: one chip per PageVisit, in order, showing the path, dwell (m:ss) and click count, with arrows between chips. The chip of the current step's page is highlighted, and clicking a chip jumps to that page's firstStepIndex.
- [ ] Step card: shows 'Step N of M', the +m:ss offset, a kind badge (view/click/event/error; errors visually distinct), the title, the page path, and the detail (href) when present. Collapsed double clicks show 'x2'.
- [ ] Step list: a numbered, scrollable list of all filtered steps. The current one is highlighted and scrolled into view; clicking an item selects it.
- [ ] Controls: Prev, Next, and Play/Pause (advances 1 step per second at 1x, with a 1x/2x/4x speed selector, stopping at the last step). Left/Right arrow keys move one step and Space toggles play while the player has focus. onStepChange(index) fires on every change.
- [ ] An empty timeline renders 'No recorded activity for this session'. Styling follows SessionsPanel.tsx's Tailwind patterns, including dark: variants. pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/SessionPlayer.tsx

# Implementation notes

Read first: src/lib/sessionSteps.ts (landed by PRD session-steps-helper: the exact Step/PageVisit types); src/pages/admin/SessionsPanel.tsx (the styling, the kind-badge colours and the dark-mode classes to match; do not modify it).

Use plain divs and no new dependencies. Clean up the play interval on unmount and when the step reaches the end. Register keyboard handling on the player's root element (tabIndex=0), not on window, so it doesn't hijack the rest of the admin page.

Do not touch: SessionsPanel.tsx, App.tsx.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-player --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
