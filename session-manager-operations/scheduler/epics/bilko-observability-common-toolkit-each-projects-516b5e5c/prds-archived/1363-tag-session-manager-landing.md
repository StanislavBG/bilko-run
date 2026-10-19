---
title: Tag Session Manager landing: downloads, tip, film, main buttons
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T18:42:50.107Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [host-trackflow-helper]
planId: pl-mve5lxlp-756161
---
# Goal

wire: the owner asked that every page, main button, monetization surface and download on bilko.run be tagged. The Session Manager landing at /products/session-manager is host-owned and carries the desktop app downloads and the coffee tip jar. Tag its main buttons with data-track and its download and tip funnels with trackFlow, using the shared taxonomy.

# Acceptance criteria

- [ ] Every download button and link in src/pages/session-manager-landing/Downloads.tsx has data-track="download-<platform>", e.g. download-mac, download-windows, download-linux. On click it calls trackFlow('download', 'click-download', { artifact: 'session-manager', version, platform }) with the version and platform values already in scope in the component.
- [ ] The coffee tip link(s) on this page (the /coffee link in Header.tsx or SessionManagerPage.tsx) have data-track="tip-coffee" and call trackFlow('tip', 'click-tip', { product: 'coffee' }) on click.
- [ ] The other primary buttons and links in Header.tsx, SessionManagerPage.tsx and FilmDialog.tsx (nav, manual link, play film, copy-command) get unique kebab data-track values prefixed sm-, e.g. sm-nav-manual or sm-film-play. Opening the film dialog calls trackFlow('film', 'play').
- [ ] No click handler changes navigation or download behavior: the trackFlow calls are fire-and-forget and run before the default action without preventDefault.
- [ ] pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/session-manager-landing/Downloads.tsx
- src/pages/session-manager-landing/Header.tsx
- src/pages/session-manager-landing/SessionManagerPage.tsx
- src/pages/session-manager-landing/FilmDialog.tsx

# Implementation notes

Read first: src/pages/session-manager-landing/Downloads.tsx, Header.tsx, SessionManagerPage.tsx and FilmDialog.tsx (grep -n 'href\|onClick\|<button' in each); src/hooks/usePageView.ts trackFlow (landed by PRD host-trackflow-helper).

Taxonomy:
- data-track is kebab-case "<area>-<action>", unique within the app.
- Download buttons use the prefix download-; tip buttons use tip-.
- Flows are 'download' (click-download, download-started, download-failed) and 'tip' (click-tip, checkout-redirect, success).

Never click the real tip link in any capture: /coffee starts a live Stripe checkout.

Do not touch: AccountChip.tsx, ManualPage.tsx, src/hooks/usePageView.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-smtag --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
