---
title: Document host-generated social cards in the host contract
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-10T21:50:52.709Z
sourcePromptId: url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f
agentType: dev-lead
disposition: new-head
planId: pl-mv2xhsth-4b8575
---
# Goal

doc: tell sibling-app authors that bilko.run now generates each project's X/Twitter/OpenGraph share card from the registry (displayName or name plus tagline) and injects it into the served index.html, so the registry tagline is the share copy and siblings should not hand-write og:/twitter: tags (the host overwrites them).

# Acceptance criteria

- [ ] docs/host-contract.md has a 'Social share cards' section stating: the card image is served at https://bilko.run/og/<slug>.png; title comes from displayName ?? name and description from tagline in src/data/standalone-projects.json; the host strips and replaces any og:* / twitter:* / <title> / meta description tags in /projects/<slug>/ HTML; to change a card, update the registry entry via the bilko-host MCP.
- [ ] The section names the files that implement it: server/og-meta.ts, server/og-image.ts, server/og-routes.ts.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/host-contract.md

# Implementation notes

Read first: docs/host-contract.md (find the section describing static-path index.html / registry fields and add the new section next to it, matching heading level and tone). Keep it under 25 lines. Do not touch any other file.

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
