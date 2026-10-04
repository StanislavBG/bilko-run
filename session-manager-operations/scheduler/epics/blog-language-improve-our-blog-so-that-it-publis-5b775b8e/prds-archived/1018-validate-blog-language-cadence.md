---
title: Validate: blog plain-language voice + reliable 3-day cadence plan
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T06:44:41.292Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: build
agentType: validator
dependsOn: [blog-spotlight-mode-docs]
planId: pl-mus0ziaz-37bb07
---
# Goal

validate. Plan PRDs: blog-readability-checker (plain-language readability checker), blog-plain-language-voice (plain-language, cool-side-first voice in config/voice/SKILL), blog-watchdog-spotlight-fallback (never skip a due post; publish-date = today; readability gate before seed), blog-spotlight-mode-docs (skill prose for spotlight mode).

# Acceptance criteria

- [ ] blog-readability-checker: verify against session-manager-operations/scheduler/epics/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/prds/1014-blog-readability-checker.md (or prds-archived/)
- [ ] blog-plain-language-voice: verify against .../prds/1015-blog-plain-language-voice.md (or prds-archived/)
- [ ] blog-watchdog-spotlight-fallback: verify against .../prds/1016-blog-watchdog-spotlight-fallback.md (or prds-archived/)
- [ ] blog-spotlight-mode-docs: verify against .../prds/<NN>-blog-spotlight-mode-docs.md (find by slug, or prds-archived/)
- [ ] Write and commit session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-language-cadence.md

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/validate-blog-language-cadence.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: b3eff74641acf20a7106dddd0511b1d9e1e7746b

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
