---
title: Host contract: the share image is now also the project's /projects hero
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-14T02:03:46.937Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
disposition: new-head
planId: pl-mv7gulbt-d399db
---
# Goal

doc: once PRD projects-ring-og-image lands, the /projects Projects Ring hero shows each project's `/og/<slug>.png`, the same image X shows for a shared link. Update docs/host-contract.md so sibling projects know their `listing.shareImage` is now their hero on bilko.run/projects too, and treat it as a designed hero rather than an afterthought social card.

# Acceptance criteria

- [ ] docs/host-contract.md "Custom share image" section gains a short paragraph (≤6 lines) right under its heading: the same `/og/<slug>.png` is the X/LinkedIn link preview AND the hero image of the project's card on https://bilko.run/projects (shown uncropped at 1200x630 on a dark background), so a project without a `listing.shareImage` shows the plain generated text card in both places.
- [ ] The same section adds 3-4 bullets of design guidance for a hero-quality share image: show the product itself (real UI or the key visual), keep the name and one-line promise legible at small sizes, keep important content inside the central ~1000x500 safe area, no tiny text; and states it must stay 1200x630 PNG ≤ 5 MB (unchanged rule).
- [ ] No other section of docs/host-contract.md changes; the published MCP host-contract text stays in sync if mcp-host-server serves this doc from a copy (check `grep -rn 'Custom share image' mcp-host-server/src` — if a copy exists, update it identically and rebuild mcp-host-server/dist so tests/mcp-dist-sync.test.ts passes).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/host-contract.md
- mcp-host-server/

# Implementation notes

Read first: docs/host-contract.md lines ~195-216 ("Custom share image"), server/og-routes.ts (resolution order, read only), CLAUDE.md "Rules" (mcp-host-server/dist must be rebuilt and committed with any mcp-host-server/src change).
Voice: plain, direct; follow the surrounding doc's style (short sentences, numbered recipe stays as is).
Do not touch: any src/ or server/ file.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-dist-sync.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
