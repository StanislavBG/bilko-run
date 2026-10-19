---
title: Retire React usePageView pageview POST (beacon now owns pageviews)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-18T18:26:51.401Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [beacon-session-and-navigation]
planId: pl-mve5lxlp-756161
---
# Goal

migration: the injected beacon (server/click-beacon.ts) now sends a pageview on load and on every SPA navigation, host-wide. The host SPA's React usePageView hook would double-count every host page, so remove it and its three call sites. Make the remaining host-side track() helper use the same cookie session identity.

# Acceptance criteria

- [ ] src/hooks/usePageView.ts no longer exports usePageView, and nothing in src/ POSTs to /analytics/pageview. Verify with: rg -n 'analytics/pageview' src/ returns no match.
- [ ] The usePageView() calls and imports are removed from src/components/Layout.tsx, src/pages/session-manager-landing/AccountChip.tsx and src/pages/session-manager-landing/ManualPage.tsx. Their other behavior is unchanged.
- [ ] In src/hooks/usePageView.ts, getOrCreateVisitorId() and getOrCreateSessionId() follow the cookie contract described in the implementation notes. The sessionStorage bilko_sid / bilko_sid_last logic is gone. track() keeps its signature and still posts to /api/analytics/event.
- [ ] pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/hooks/usePageView.ts
- src/components/Layout.tsx
- src/pages/session-manager-landing/AccountChip.tsx
- src/pages/session-manager-landing/ManualPage.tsx

# Implementation notes

Read first: src/hooks/usePageView.ts (whole file); src/components/Layout.tsx lines 1-30; src/pages/session-manager-landing/AccountChip.tsx lines 1-35; src/pages/session-manager-landing/ManualPage.tsx lines 15-20 and 140-150; server/click-beacon.ts BEACON_JS (landed by PRD beacon-session-and-navigation: the reference client implementation of the contract).

Cookie contract: bilko_vid = visitor UUID, Max-Age 31536000; bilko_sid = session UUID, Max-Age 1800, rewritten on every call (sliding). Both `Path=/; SameSite=Lax`, plus `; Secure` on https. Valid id = the UUID regex. vid = the valid cookie, else the valid legacy localStorage bilko_vid (which wins if it differs), else a new uuid; write both. sid = the valid cookie, else a new uuid.

Remove the now-unused UTM capture and useLocation/useUser imports if nothing else uses them. Keep the file name, since track() is imported from it elsewhere.

Do not touch: server/click-beacon.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-usepageview --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
