---
title: Validate: blog absolute links + early-college audience
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T16:26:55.788Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: build
agentType: validator
dependsOn: [blog-live-posts-absolute-links, blog-checker-absolute-links, blog-policy-absolute-links-audience]
planId: pl-musltlof-c41006
---
# Goal

validate. Plan PRDs: blog-live-posts-absolute-links (fix the live posts' links), blog-checker-absolute-links (checker fails relative links and unlinked open-source claims), blog-policy-absolute-links-audience (config and voice: early-college audience, absolute links).

# Acceptance criteria

- [ ] blog-live-posts-absolute-links: verify against session-manager-operations/scheduler/epics/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/prds/1024-blog-live-posts-absolute-links.md (or prds-archived/). Also check LIVE: once Render has deployed the commit, curl https://bilko.run/api/blog/turn-your-github-year-into-a-heatmap-and-badge-wall (--max-time 15, at most 20 tries 30s apart). Its content must contain https://bilko.run/projects/git-viewer/ and https://github.com/StanislavBG/git-viewer and must not contain '](/'.
- [ ] blog-checker-absolute-links: verify against .../prds/1025-blog-checker-absolute-links.md (or prds-archived/)
- [ ] blog-policy-absolute-links-audience: verify against .../prds/<NN>-blog-policy-absolute-links-audience.md (find by slug, or prds-archived/)
- [ ] Write and commit session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-absolute-links.md

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-absolute-links.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 929fbf4

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
