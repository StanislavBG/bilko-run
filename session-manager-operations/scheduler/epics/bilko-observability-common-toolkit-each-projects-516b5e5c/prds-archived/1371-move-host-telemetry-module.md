---
title: Move host telemetry helpers from hooks/usePageView.ts to lib/telemetry.ts (fixes open-core Clerk-boundary test)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-18T22:17:50.187Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
disposition: new-head
planId: pl-mvedza7f-7380da
---
# Goal

migration: src/hooks/usePageView.ts no longer contains any React or Clerk hook. It only exports the plain telemetry helpers getOrCreateVisitorId, getOrCreateSessionId, track, trackFlow and trackScreen. But its file name makes tests/open-core-positioning.test.ts ('keeps every Clerk hook inside a quiet boundary') fail, because that test forbids the substring 'usePageView' in the Session Manager landing files. Move the module to src/lib/telemetry.ts under an honest name and update every importer, so the guard stays strict and the suite is green again.

# Acceptance criteria

- [ ] src/hooks/usePageView.ts is moved with git mv to src/lib/telemetry.ts, keeping its exports and behavior byte-for-byte apart from comments mentioning the old name. src/hooks/usePageView.ts no longer exists.
- [ ] Every importer imports from the new path (relative '../lib/telemetry.js' or '../../lib/telemetry.js'): src/components/Layout.tsx; src/pages/BlogPostPage.tsx, ContactPage.tsx, HomePage.tsx, NotFoundPage.tsx, PricingPage.tsx, ProjectsPage.tsx and UnpublishedProjectPage.tsx; src/pages/session-manager-landing/Downloads.tsx, Header.tsx, ManualPage.tsx and SessionManagerPage.tsx; tests/host-track-flow.test.ts. Verify with: rg -n 'usePageView' src/ tests/host-track-flow.test.ts returns no match.
- [ ] tests/open-core-positioning.test.ts is NOT modified, and all its tests pass, including 'keeps every Clerk hook inside a quiet boundary'.
- [ ] tests/host-track-flow.test.ts passes, and pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/hooks/usePageView.ts
- src/lib/telemetry.ts
- src/components/Layout.tsx
- src/pages/BlogPostPage.tsx
- src/pages/ContactPage.tsx
- src/pages/HomePage.tsx
- src/pages/NotFoundPage.tsx
- src/pages/PricingPage.tsx
- src/pages/ProjectsPage.tsx
- src/pages/UnpublishedProjectPage.tsx
- src/pages/session-manager-landing/Downloads.tsx
- src/pages/session-manager-landing/Header.tsx
- src/pages/session-manager-landing/ManualPage.tsx
- src/pages/session-manager-landing/SessionManagerPage.tsx
- tests/host-track-flow.test.ts

# Implementation notes

Read first: src/hooks/usePageView.ts (whole file); tests/open-core-positioning.test.ts lines 195-225 (the failing guard: do not edit it); tests/host-track-flow.test.ts lines 1-15 (its import).

Steps:
1. git mv src/hooks/usePageView.ts src/lib/telemetry.ts.
2. Update the import specifiers in the 13 files listed in the criteria. This is a mechanical change; touch nothing else in those files.
3. Run rg -n 'hooks/usePageView' to confirm nothing is left. If docs mention the path, leave them: docs are out of scope.

Validator context: this fixes the Important finding in session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-observability-toolkit.md. The full vitest run also has one known environmental failure, tests/spa-fallback-notfound-crash.test.ts, caused by a stale gitignored dist/. That is why the gate is scoped to the named tests.

# Out of scope

- Changing the open-core-positioning test
- Any behavior change to track/trackFlow/trackScreen

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/open-core-positioning.test.ts tests/host-track-flow.test.ts
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-telmove --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
