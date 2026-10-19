---
title: Fix click tagging data: per-project click names, manual download funnel, header tip area
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-19T02:43:11.742Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [cleanup-host-telemetry-module]
planId: pl-mvenfpj7-94f4a9
---
# Goal

behavior: an independent review found three tagging data bugs. On /projects, every project card click records the same name, because the beacon only reads data-track and ignores data-track-slug. The Field Manual records a 'download' for a link that only opens the product page, which inflates the download funnel, and it labels manual-file downloads as the Session Manager app. The Session Manager header's tip event lacks the area prop the other tip events carry.

# Acceptance criteria

- [ ] In src/pages/ProjectsPage.tsx (around lines 282 and 334), project card links use data-track={`project-open-${slug}`.slice(0, 60)} and the data-track-slug attribute is removed. The trackFlow('explore', 'open-project', { slug }) call stays.
- [ ] In src/pages/session-manager-landing/ManualPage.tsx, links that only navigate to the product or download page record trackFlow('download', 'open-download-page', ...), not click-download. Real manual-file downloads (around line 268) use artifact 'session-manager-manual'.
- [ ] Downloads.tsx's click helper is exported with an artifact parameter, e.g. trackDownloadClick(artifact, platform, version), and ManualPage.tsx reuses it instead of its own trackAppDownload. Downloads.tsx's own calls are unchanged in behavior.
- [ ] In src/pages/session-manager-landing/Header.tsx (around line 37), the tip trackFlow call includes area: 'sm-header'.
- [ ] No tracking call changes navigation or calls preventDefault. tests/open-core-positioning.test.ts, pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/ProjectsPage.tsx
- src/pages/session-manager-landing/ManualPage.tsx
- src/pages/session-manager-landing/Downloads.tsx
- src/pages/session-manager-landing/Header.tsx

# Implementation notes

Read first: server/click-beacon.ts BEACON_JS (confirm it reads only data-track); src/pages/ProjectsPage.tsx lines 270-340; src/pages/session-manager-landing/ManualPage.tsx (rg -n 'trackAppDownload|trackFlow|download'); src/pages/session-manager-landing/Downloads.tsx lines 1-30; src/pages/session-manager-landing/Header.tsx lines 25-45; src/lib/telemetry.ts (after PRD cleanup-host-telemetry-module).

Never click real /coffee or download links in any capture.

Do not touch: src/lib/telemetry.ts, server files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/open-core-positioning.test.ts
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-tagfix --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
