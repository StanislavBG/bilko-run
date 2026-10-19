---
title: Privacy page discloses the bilko_vid / bilko_sid analytics cookies
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-18T18:25:57.740Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-identity-cookie]
planId: pl-mve5lxlp-756161
---
# Goal

doc: bilko.run now sets two first-party analytics cookies on every page: bilko_vid, a random visitor id kept 1 year, and bilko_sid, a random session id that expires after 30 minutes idle. They are used to stitch page views and clicks into sessions for the site's own admin dashboard. Update the privacy page so it states this plainly, in Bilko's voice.

# Acceptance criteria

- [ ] src/pages/PrivacyPage.tsx names both cookies, bilko_vid and bilko_sid, with their lifetimes of 1 year and 30 minutes idle, and states their purpose: first-party session analytics, not shared with third parties, not used for ads.
- [ ] It states that page paths, clicked button and link labels, and app events are recorded against those ids, and that click labels are scrubbed of email addresses.
- [ ] Any existing statement on the page that contradicts this, such as 'no cookies' or 'sessionStorage only', is corrected.
- [ ] pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/PrivacyPage.tsx

# Implementation notes

Read first: src/pages/PrivacyPage.tsx (whole file); server/session-identity.ts (added by PRD session-identity-cookie: the cookie names and lifetimes). Match the existing section and heading markup and the tone. Voice: witty, direct, no corporate fluff. Bilko is described as the site, not as a first-person human. Do not touch any other file.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
