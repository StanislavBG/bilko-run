---
title: ContentGrade retired: fix the LICENSE copyright, env template and CLAUDE.md
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-09T21:29:49.595Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [stripe-retire-contentgrade-pro, delete-contentgrade-license-code]
planId: pl-mv1hacoj-72fbb4
---
# Goal

doc. The public GitHub repo's LICENSE still reads 'Copyright (c) 2026 ContentGrade'. .env.example lists ContentGrade Stripe variables the code may no longer read. CLAUDE.md still describes the license code as 'pending an owner decision'. The owner has decided that ContentGrade is retired. Update all three to match the code as landed by stripe-retire-contentgrade-pro and delete-contentgrade-license-code (read those changes first).

# Acceptance criteria

- [ ] LICENSE line 3 reads `Copyright (c) 2026 Bilko`. The rest of the MIT text is unchanged.
- [ ] .env.example lists a CONTENTGRADE variable only if `git grep -n` shows code still reads it (expected: only the BUSINESS/TEAM price vars used by priceToPlanTier). Any that remain sit under a 'Legacy ContentGrade subscriptions (no longer sold)' heading. STRIPE_PAYMENT_LINK_CONTENTGRADE_PRO is removed.
- [ ] CLAUDE.md replaces the 'legacy ContentGrade license code pending an owner decision' note with one line: ContentGrade was retired on 2026-10-09. There are no license keys and no Pro sales. /upgrade redirects home. The subscription lifecycle (webhook saveSubscription, billing portal, priceToPlanTier) stays only until Stripe shows zero active ContentGrade subscriptions.
- [ ] The 'never push to the content-grade remote' guardrails in CLAUDE.md, README.md and docs/ are left as they are, because the git remote still exists.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- LICENSE
- .env.example
- CLAUDE.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko.

Read first: LICENSE; .env.example; CLAUDE.md (search 'ContentGrade' and 'license'); `git grep -n -i contentgrade -- server shared src scripts`.

Do not touch: README.md, docs/, any code.

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
