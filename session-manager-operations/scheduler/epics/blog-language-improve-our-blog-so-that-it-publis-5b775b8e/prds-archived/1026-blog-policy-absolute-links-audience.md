---
title: Blog policy: early-college audience, full clickable links, open-source claims link the repo
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T16:26:49.004Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-checker-absolute-links]
planId: pl-musltsgp-a1757b
---
# Goal

doc. Owner direction 2026-10-03: "you need to print the full links not a sudo-code ... the audience is early college people so they need to click." blog.config.yaml (the declared authority) still says the static-path link is "/projects/<slug>/" and names a generic reader. Update the config and voice.md so drafts use absolute bilko.run URLs, link the real GitHub repo whenever they mention source code, and are written for early-college readers.

# Acceptance criteria

- [ ] blog.config.yaml `identity.reader` says the reader is an early college student, new to these tools, who should be able to click straight through to try each one
- [ ] blog.config.yaml `links:` values are absolute: static-path 'https://bilko.run/projects/<slug>/', react-route 'https://bilko.run/products/<slug>', cross-post 'https://bilko.run/blog/<slug>'. A new key `absolute_urls_only: true` has a comment saying the readability checker fails relative links. A new key `source_repo:` says any mention of open source / GitHub / forking links 'https://' + the registry's host.sourceRepo, and that this repo link does not count against max_ctas_per_post.
- [ ] voice.md gains a short 'Links readers can click' rule: full https URLs only; name where the link goes in the link text; when you say open source, link the repo. It includes one before/after example built from the git-viewer sentence ('[the project page](/projects/git-viewer/) ... the project is open source' to the absolute, linked version).
- [ ] tests/blog-plain-language.test.ts gains assertions for identity.reader mentioning college, links.static-path starting with https://bilko.run/, links.absolute_urls_only === true, and voice.md's after-example passing analyzeReadability with zero linkIssues; all existing tests in that file and in tests/blog-editorial-focus-not-content.test.ts still pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/blog.config.yaml
- .claude/skills/blog-from-git/voice.md
- tests/blog-plain-language.test.ts

# Implementation notes

Read first: .claude/skills/blog-from-git/blog.config.yaml (identity: block near the top, links: block ~line 123), .claude/skills/blog-from-git/voice.md (the Plain language section near the top), tests/blog-plain-language.test.ts, scripts/blog-readability.ts (its linkIssues output, from the PRD blog-checker-absolute-links that this one depends on).

Steps: red assertions first; edit the config; edit voice.md; run the gate last.

Do not touch: scripts/, server/db.ts, SKILL.md, seed.md, rotation.md.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-plain-language.test.ts tests/blog-editorial-focus-not-content.test.ts tests/blog-readability.test.ts tests/blog-spotlight-mode.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
