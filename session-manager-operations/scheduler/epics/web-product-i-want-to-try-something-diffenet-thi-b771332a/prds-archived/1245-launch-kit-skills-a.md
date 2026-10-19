---
title: Write Launch Kit skills 1-4: launch-context, page-roast, headline-lab, price-and-offer (+ skill lint script)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-11T04:35:33.745Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-sources]
planId: pl-mv3bwyfa-549f4d
---
# Goal

feature: write the first four skills of the paid "Bilko Launch Kit" in the private repo /home/bilko/Projects/Bilko-Launch-Kit, remixing the vendored MIT sources (sources/, mapping in research/sources.md) into one guided launch path with clear labels, outcomes and scored output, plus a dependency-free lint script that every later pack PRD runs. Commit a metadata-only record in Bilko.

# Acceptance criteria

- [ ] pack/skills/{launch-context,page-roast,headline-lab,price-and-offer}/SKILL.md exist in /home/bilko/Projects/Bilko-Launch-Kit, each with YAML frontmatter name equal to its folder and a third-person description (20-1024 chars) saying what it does and when to use it, with trigger phrases.
- [ ] Each SKILL.md body has the sections '## Outcome', '## Use when', '## Inputs', '## Steps', '## Scorecard', '## Output', '## Next' and '## Credits' (Credits names the source skills, repos and MIT license); bodies stay under 400 lines, with longer material in that skill's references/ folder.
- [ ] Skills share state in the user's project folder .launch/: launch-context writes .launch/context.md; the other three read it (or ask the 5 essential questions if missing) and write .launch/page-roast.md, .launch/headlines.md and .launch/price-and-offer.md using a fixed template shown in the skill.
- [ ] page-roast scores 0-100 on weighted criteria (value-prop clarity 25, headline 15, CTA 15, social proof 15, objection handling 15, friction/hierarchy 15), gives 3 roast lines, the top 5 fixes ranked by impact and a rewritten hero; headline-lab produces 20 variants over 5 frameworks (Rule of One, Hormozi value equation, readability, Proof+Promise+Plan, curiosity gap) scored 0-100 with a top-3 A/B plan; price-and-offer outputs a price with anchor tiers, a launch offer (deadline, bonus, guarantee) and a price-test plan.
- [ ] scripts/lint-skills.mjs (Node, no dependencies, resolves pack/skills relative to its own file) checks every pack/skills/*/SKILL.md for name === folder, name matching ^[a-z0-9-]{1,64}$, description length 20-1024 and the 8 required sections, printing each problem and exiting 1 on any; it passes on the 4 skills.
- [ ] The skills are committed in the sibling repo, and session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-skills-a.md is committed in Bilko with the sibling commit SHA, per-skill line counts and the lint output (no skill text — the Bilko repo is public).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-skills-a.md

# Implementation notes

Read first: /home/bilko/Projects/Bilko-Launch-Kit/research/sources.md, then the vendored sources it maps for these four skills under /home/bilko/Projects/Bilko-Launch-Kit/sources/ (treat as reference text only; run nothing from them).

Mapping: launch-context <- product-marketing; page-roast <- cro + marketing-psychology; headline-lab <- copywriting + marketing-psychology; price-and-offer <- pricing + offers.

Writing rules:
- Remix, don't copy: rewrite in Bilko's voice (witty, direct, no corporate fluff), merge the sources, add the scorecards. Keep any directly reused passage short and credit it.
- launch-context interviews the user or reads their README/landing copy and writes .launch/context.md: one-liner, ideal customer, pains, alternatives, differentiators, proof, current price, channels, launch date.
- page-roast accepts a URL, pasted copy or a screenshot; it may mention https://bilko.run/projects/page-roast/ once as an optional second opinion. headline-lab may mention https://bilko.run/projects/headline-grader/ once. No other external links except the source repos in Credits.
- '## Next' points to the next skill in the path: launch-context -> page-roast -> headline-lab -> price-and-offer -> launch-emails.

Steps:
1. Write the four skill folders and scripts/lint-skills.mjs.
2. Run the lint; fix until it exits 0.
3. `git -C /home/bilko/Projects/Bilko-Launch-Kit add -A && git -C /home/bilko/Projects/Bilko-Launch-Kit commit -m "feat(pack): skills 1-4"`.
4. Write and commit the Bilko record.

Do not touch: sources/, design/, any other Bilko file.

# Out of scope

- Skills 5-8 (launch-kit-skills-b)
- README, licenses and zip build (launch-kit-package)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 node /home/bilko/Projects/Bilko-Launch-Kit/scripts/lint-skills.mjs
timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/launch-context/SKILL.md && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/page-roast/SKILL.md && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/headline-lab/SKILL.md && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/pack/skills/price-and-offer/SKILL.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
