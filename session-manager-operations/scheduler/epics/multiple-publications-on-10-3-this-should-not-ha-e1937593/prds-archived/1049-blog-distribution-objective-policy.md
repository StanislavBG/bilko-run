---
title: Blog constitution: distribution objective (drive traffic to project landing pages; LinkedIn syndication planned)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T21:09:27.539Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
disposition: new-head
planId: pl-musvxkkz-0193ba
---
# Goal

doc: bake the owner's distribution objective into the blog pipeline's grounding. Owner direction 2026-10-03, verbatim: "I want to eventually make this blog even more public by double-publishing to linkedIN - make sure that objective is already baked into the grouding for it - talking about hte projects I work on will drive traffic. so the language can't be marketing but urls need be real and we let the landing page convert". Every post must be written so it can be copied to LinkedIn unchanged, send readers to the project's real landing page, and never do the selling itself.

# Acceptance criteria

- [ ] `.claude/skills/blog-from-git/blog.config.yaml` gains a top-level `distribution:` block (placed right after `grounding:`) quoting the owner direction verbatim in a comment, with keys: `objective` (posts about the projects drive traffic to each project's landing page; the landing page converts, the post does not sell), `channels` (bilko.run/blog = live; linkedin = planned, cross-post of the same text, not yet automated), `syndication_ready: true` (post must stand alone off-site: no 'last post'/'see above'/'on this blog' references, every link absolute, first two sentences carry the cool part), `primary_link: project landing page per links: host-kind rules`, `no_marketing_language: true`, `marketing_blocklist` (at least: sign up now, don't miss, game-changer, game changer, revolutionary, unlock, level up, supercharge, best-in-class, world-class, cutting-edge, limited time, act now, buy now, skyrocket, must-have).
- [ ] `blog.config.yaml` `identity:` gains a `purpose:` line pointing to `distribution.objective`; `gates.5_draft` text adds: marketing_blocklist clean and post stands alone off-site (syndication_ready).
- [ ] `.claude/skills/blog-from-git/voice.md` gains a section `## Written to travel (LinkedIn-ready, no selling)` with the owner quote, the stand-alone rules, a Before/After pair (salesy -> plain + real landing-page link), and the rule that real, absolute, live URLs are mandatory because the landing page does the converting.
- [ ] `.claude/skills/blog-from-git/SKILL.md` phase-5 self-check list gains two checkboxes: marketing_blocklist clean; post reads complete if pasted into LinkedIn with no site context, with its one primary link pointing at the project's real landing page.
- [ ] Nothing in the new text tells the pipeline to post to LinkedIn yet, and it states syndicated copy must contain no automation/pipeline disclosure.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/blog.config.yaml
- .claude/skills/blog-from-git/voice.md
- .claude/skills/blog-from-git/SKILL.md

# Implementation notes

Read first: .claude/skills/blog-from-git/blog.config.yaml lines 1-60 (identity, grounding) and 180-215 (links, gates), .claude/skills/blog-from-git/voice.md lines 25-60 (Links readers can click section — match its style), .claude/skills/blog-from-git/SKILL.md phase-5 self-check checklist (search for `- [ ]`).

Steps: 1. Add the distribution block + identity.purpose + gates.5_draft text in blog.config.yaml (keep valid YAML; verify by loading it with js-yaml in a one-off `node -e` or tsx call). 2. voice.md section. 3. SKILL.md checkboxes.
Note: a sibling PRD (blog-readability-marketing-and-real-links) will make scripts/blog-readability.ts read `distribution.marketing_blocklist` — use exactly that key path.

Do not touch: scripts/, tests/, server/, seed.md, rotation.md, blog-ledger.md.

# Out of scope

- Actually posting to LinkedIn or building a LinkedIn integration
- Checker code changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 node -e 'require("js-yaml").load(require("fs").readFileSync(".claude/skills/blog-from-git/blog.config.yaml","utf8")).distribution.marketing_blocklist.length'
timeout 30 rg -n 'Written to travel' .claude/skills/blog-from-git/voice.md && timeout 30 rg -n 'marketing_blocklist' .claude/skills/blog-from-git/SKILL.md .claude/skills/blog-from-git/blog.config.yaml
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
