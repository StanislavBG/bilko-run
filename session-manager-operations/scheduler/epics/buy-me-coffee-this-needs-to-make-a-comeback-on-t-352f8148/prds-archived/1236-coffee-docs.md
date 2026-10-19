---
title: Document /coffee as the Stripe-backed Bilko tip jar with committed defaults
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-11T01:36:46.279Z
sourcePromptId: buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148
agentType: dev-lead
disposition: new-head
planId: pl-mv35katj-4b1860
---
# Goal

doc: /coffee is becoming the shared Bilko tip jar, linked from the main site and the Session Manager page, backed by live Stripe product prod_V2Q4ego2oijqo4 with its payment link and price committed as code defaults (env vars only override). Update .env.example and the CLAUDE.md sanctioned-host-code list so they no longer describe it as an unset, SocialSignalsTrader-only feature.

# Acceptance criteria

- [ ] .env.example coffee comment block (around lines 40-46) says the two vars are optional overrides, the committed defaults are the live Stripe product prod_V2Q4ego2oijqo4 / price_1U2LEcR6w0VtQRLThguPtRCI / payment link https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d (defined in shared/product-catalog.ts), and no longer claims /coffee shows 'temporarily unavailable' when unset.
- [ ] CLAUDE.md 'Sanctioned app-specific host code' bullet 'SocialSignalsTrader coffee checkout — in server/routes/stripe.ts' is replaced by one line describing the shared Bilko coffee tip jar: GET /coffee in server/routes/stripe.ts + catalog defaults in shared/product-catalog.ts, linked from the site footer, home hero and Session Manager header.
- [ ] No other lines in either file change.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .env.example
- CLAUDE.md

# Implementation notes

Read first: .env.example lines 35-50; CLAUDE.md lines 128-142.

Steps: edit the two spots only; keep tone and formatting of the surrounding text. Commit both files.

Do not touch: any code file.

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
