---
title: Write Launch Kit skills 5-8: launch-emails, launch-week (with readiness scorecard), build-in-public, first-100
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-11T04:37:01.163Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-skills-a]
planId: pl-mv3bwyfa-549f4d
---
# Goal

feature: write the remaining four skills of the paid "Bilko Launch Kit" in /home/bilko/Projects/Bilko-Launch-Kit, following exactly the conventions the first four established (sections, .launch/ shared state, scorecards, Bilko voice, credits), ending the path with a launch-readiness scorecard. Commit a metadata-only record in Bilko.

# Acceptance criteria

- [ ] pack/skills/{launch-emails,launch-week,build-in-public,first-100}/SKILL.md exist with the same frontmatter rules and the 8 required sections as skills 1-4, and scripts/lint-skills.mjs exits 0 over all 8 skills.
- [ ] launch-emails writes .launch/emails.md: a 5-email launch sequence (teaser, launch day, proof, objection, last call) with 2 subject-line variants each and a send schedule, using .launch/price-and-offer.md when present; it may mention https://bilko.run/projects/email-forge/ once.
- [ ] launch-week writes .launch/launch-week.md: a day-by-day plan from T-7 to T+7 across Product Hunt, Show HN, relevant subreddits (respecting self-promotion rules) and directories, then a Launch Readiness Scorecard (0-100 over 8 criteria fed by the other .launch/*.md files) written to .launch/scorecard.md; it may mention https://bilko.run/projects/launch-grader/ once.
- [ ] build-in-public writes .launch/build-in-public.md: 3 threads and 5 posts drawn from the user's changelog or git log, a scored hook for each, and an 'AI-tell' humanizer checklist pass; first-100 writes .launch/first-100.md: an ideal-customer list-building plan, 3 outreach templates per channel, a follow-up cadence, tracking-sheet columns, and ethics rules (honour opt-outs, CAN-SPAM/GDPR basics, no scraping of personal data).
- [ ] Committed in the sibling repo, and session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-skills-b.md is committed in Bilko with the sibling SHA, per-skill line counts and lint output (no skill text).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-skills-b.md

# Implementation notes

Read first: /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/page-roast/SKILL.md (the established format — copy its section layout and tone), /home/bilko/Projects/Bilko-Launch-Kit/research/sources.md, then the vendored sources for these skills: launch-emails <- sources/coreyhaines31__marketingskills/skills/emails; launch-week <- .../skills/launch + .../skills/directory-submissions; build-in-public <- sources/alirezarezvani__claude-skills/marketing-skill/skills/x-twitter-growth + .../content-humanizer; first-100 <- sources/coreyhaines31__marketingskills/skills/cold-email. Reference text only; run nothing from sources/.

'## Next' chain: launch-emails -> launch-week -> build-in-public -> first-100 -> (back to launch-week's scorecard). Remix in Bilko's voice; credit sources (MIT) in each Credits section.

Steps: write the four folders, run `node scripts/lint-skills.mjs` until it exits 0, commit in the sibling (`git -C /home/bilko/Projects/Bilko-Launch-Kit add -A && git -C ... commit -m "feat(pack): skills 5-8"`), then write and commit the Bilko record.

Do not touch: skills 1-4 except to fix a lint error, sources/, design/, any other Bilko file.

# Out of scope

- README, licenses, zip build (launch-kit-package)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 node /home/bilko/Projects/Bilko-Launch-Kit/scripts/lint-skills.mjs
timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/launch-emails/SKILL.md && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/launch-week/SKILL.md && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/build-in-public/SKILL.md && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/first-100/SKILL.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
