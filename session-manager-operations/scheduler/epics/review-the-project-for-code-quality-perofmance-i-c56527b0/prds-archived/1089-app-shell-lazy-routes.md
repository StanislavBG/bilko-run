---
title: Site speed: lazy-load every non-home page, recover from stale chunks after a deploy, drop the dead AuthProvider
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T19:44:41.123Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1djnvm-ce23da
---
# Goal

behavior. src/App.tsx eagerly imports nearly every page, so every visitor downloads ~2.3k lines of admin-only code (AdminPage, admin/ObservabilityPage, BandwidthPanel, AdminCostPage, SecretsPage) plus WorkflowsPage and its JSON. After a deploy, a lazy chunk that 404s leaves a broken page. src/hooks/useAuth.tsx's AuthProvider is mounted but its hook is never used, yet it fires a subscription-status request at startup. Fix all three in the app shell.

# Acceptance criteria

- [ ] src/App.tsx: every route except HomePage, ProjectsPage, BlogPage and NotFoundPage is loaded with React.lazy through the file's existing lazy helper (lazyRoute or equivalent), each wrapped in Suspense plus an error boundary.
- [ ] The lazy helper retries a failed dynamic import by doing one full `window.location.reload()` guarded by a sessionStorage flag (no reload loop); a second failure shows the ErrorBoundary fallback.
- [ ] The ClerkErrorBoundary fallback no longer re-renders the routes without ClerkProvider; it shows a static message with a Reload button.
- [ ] src/hooks/useAuth.tsx is deleted and AuthProvider is removed from App.tsx; `git grep -n hooks/useAuth` finds no importers.
- [ ] `pnpm build` before vs after: the report lists the main entry chunk size (raw and gzip) both times, and the after-build shows admin pages in separate chunks.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/App.tsx
- src/hooks/useAuth.tsx
- src/components/ErrorBoundary.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. React 18 + react-router-dom 6 + Vite 6.

Read first: src/App.tsx (whole, ~240 lines: imports 1-30, ClerkErrorBoundary ~40-48, AuthProvider mount ~141, routes ~150-215); src/components/ErrorBoundary.tsx; src/hooks/useAuth.tsx.

Steps:
1. `timeout 300 pnpm build` and record dist/assets/index-*.js size (raw + `gzip -c | wc -c`).
2. Convert the eager page imports; keep route paths identical; keep the /products/session-manager and ManualPage routes working as they are now (do NOT edit src/config/tools.ts — a later PRD removes it).
3. Add the reload-once retry to the lazy helper; fix the ClerkErrorBoundary fallback; delete useAuth.tsx.
4. Rebuild and record sizes.

Do not touch: src/config/tools.ts, src/data/projectsRegistry.ts, page components themselves.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
timeout 400 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
