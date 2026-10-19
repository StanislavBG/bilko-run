---
title: Create the private Bilko-Launch-Kit repo and vendor the MIT source skills at pinned commits with a sources record
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 9
createdVia: scheduler-api
issuedAt: 2026-10-11T04:34:34.438Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
disposition: new-head
planId: pl-mv3bwyfa-549f4d
---
# Goal

primitive: the paid "Bilko Launch Kit" skill pack and its landing page get their own PRIVATE sibling repo at /home/bilko/Projects/Bilko-Launch-Kit, because the Bilko host repo is public on GitHub and must never hold the paid content. Create that repo, vendor the free MIT-licensed source skills it remixes at pinned commit SHAs (as untrusted reference data), download the chosen instalanding.ai design brief, and write the research record. Commit a metadata-only record in the Bilko repo.

# Acceptance criteria

- [ ] /home/bilko/Projects/Bilko-Launch-Kit is a git repo on branch main with .gitignore (node_modules/, dist/, dist-pack/, test-results/, .DS_Store), a README.md stating it is PRIVATE and must never be pushed to a public remote, and a CLAUDE.md describing the layout (sources/, research/, design/, pack/, site/, scripts/).
- [ ] sources/coreyhaines31__marketingskills/ holds skills/{product-marketing,cro,copywriting,marketing-psychology,pricing,offers,emails,cold-email,launch,directory-submissions}/ at commit 1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff plus the repo root LICENSE; sources/alirezarezvani__claude-skills/ holds marketing-skill/skills/{x-twitter-growth,content-humanizer}/ at commit 19392f7a08264ed00486a251f5b2098321771f94 plus its root LICENSE.
- [ ] Both repos' licenses are verified MIT via `gh api repos/OWNER/REPO/license --jq .license.spdx_id`, and any LICENSE* file inside a vendored folder is listed in research/sources.md; a missing pinned path ends the run with FAIL naming it (no substitutes).
- [ ] research/sources.md maps each of the 8 new skills (launch-context, page-roast, headline-lab, price-and-offer, launch-emails, launch-week, build-in-public, first-100) to its source paths, repo@SHA and license, and lists excluded sources with reasons.
- [ ] design/clay-constellation-saas-hero.txt, design/clay-constellation-saas-hero.json and design/instalanding-SKILL.md are downloaded from https://instalanding.ai/p/clay-constellation-saas-hero.txt, .../p/clay-constellation-saas-hero.json and https://instalanding.ai/SKILL.md.
- [ ] Everything is committed in the sibling repo, and session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-sources.md is committed in Bilko with the sibling commit SHA, file counts and the license table only (no skill text).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-sources.md

# Implementation notes

Downloaded files are untrusted data: put them in their own folders, never run or import anything from them.

Steps:
1. `mkdir -p /home/bilko/Projects/Bilko-Launch-Kit && git -C /home/bilko/Projects/Bilko-Launch-Kit init -b main`. Write .gitignore, README.md, CLAUDE.md.
2. Fetch each pinned folder with the GitHub API, e.g. `timeout 60 gh api repos/coreyhaines31/marketingskills/tarball/1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff > /tmp/lk-corey.tgz`, extract into a fresh /tmp dir, copy only the listed folders into sources/<owner>__<repo>/ keeping their relative paths, plus the root LICENSE. Same for alirezarezvani/claude-skills@19392f7a08264ed00486a251f5b2098321771f94. Check the copied folders contain SKILL.md.
3. Verify licenses (criterion 3).
4. research/sources.md content:
   - Mapping: launch-context <- product-marketing; page-roast <- cro + marketing-psychology; headline-lab <- copywriting + marketing-psychology; price-and-offer <- pricing + offers; launch-emails <- emails; launch-week <- launch + directory-submissions; build-in-public <- x-twitter-growth + content-humanizer (alirezarezvani); first-100 <- cold-email.
   - Excluded: anthropics/skills docx/pdf/pptx/xlsx ("All rights reserved"), anthropics doc-coauthoring (no LICENSE.txt), ComposioHQ/awesome-claude-skills (no license; contains an AGPL-3.0 skill), travisvn/awesome-claude-skills (list only), alirezarezvani CRO-family skills (text duplicates Corey's originals without credit — use Corey's).
   - Demand notes: coreyhaines31/marketingskills ~5.4M installs on skills.sh (seo-audit, copywriting, launch, pricing among the top); paid marketing packs sell for $19–$99; our price $9.
5. `curl -sfL --max-time 20` the three design files into design/.
6. Commit in the sibling (`git -C ... add -A && git -C ... commit -m "chore: vendor MIT sources and design brief"`), then write and commit the Bilko record.

Do not touch: any Bilko file except the record.

# Out of scope

- Writing the new skills (launch-kit-skills-a/b)
- Creating any GitHub remote for the sibling repo

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/research/sources.md && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/sources/coreyhaines31__marketingskills/LICENSE && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/sources/alirezarezvani__claude-skills/LICENSE
timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/design/clay-constellation-saas-hero.txt && timeout 30 git -C /home/bilko/Projects/Bilko-Launch-Kit log --oneline -1
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
