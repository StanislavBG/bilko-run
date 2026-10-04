---
title: Blog skill docs: document spotlight mode and publish-date-is-today in SKILL.md, rotation.md and seed.md
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T06:44:36.999Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-watchdog-spotlight-fallback]
planId: pl-mus0ziaz-37bb07
---
# Goal

doc. The previous PRD added `cadence.no_new_work_fallback: spotlight` and `cadence.current_post_published_at: authored_at` to blog.config.yaml and wired them into the watchdog. blog.config.yaml says prose must agree with it, so the blog-from-git skill's prose (SKILL.md mode decision, rotation.md, seed.md) must describe spotlight mode and the no-backdating rule for current posts — otherwise a human-invoked /blog-from-git run still skips or backdates.

# Acceptance criteria

- [ ] SKILL.md 'Mode decision' section lists a fourth mode, spotlight: used when a post is due and no rotation-eligible project has new work; subject = most-overdue tiled project not on cooldown; grounded in its live tile, README and source (not commits); written plain-language and cool-side-first per blog.config.yaml readability: and angle:
- [ ] rotation.md explains how the spotlight subject is picked (never-covered tiled projects first, then oldest last ledger row, cooldown still applies) and that a ledger row is still written with the tone and a `spotlight` mode note
- [ ] seed.md states published_at for portfolio/focused/spotlight posts is the authoring time (blog.config.yaml cadence.current_post_published_at), and honest backdating applies to catch-up backfill posts only; the existing 'never new Date()' rule stays
- [ ] New tests/blog-spotlight-mode.test.ts asserts each of the three files mentions spotlight mode and that seed.md references current_post_published_at, and that blog.config.yaml cadence.no_new_work_fallback === 'spotlight'

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/SKILL.md
- .claude/skills/blog-from-git/rotation.md
- .claude/skills/blog-from-git/seed.md
- tests/blog-spotlight-mode.test.ts

# Implementation notes

Read first: .claude/skills/blog-from-git/blog.config.yaml (cadence:, grounding:, readability:, angle: — landed by the two prior PRDs in this chain; prose must match these values), .claude/skills/blog-from-git/SKILL.md lines 60-80 (Mode decision), .claude/skills/blog-from-git/rotation.md (whole, 62 lines), .claude/skills/blog-from-git/seed.md (whole, 63 lines; published_at guidance near lines 15 and 38).

Steps: write tests/blog-spotlight-mode.test.ts (red) following tests/blog-editorial-focus-not-content.test.ts's loading style; then edit the three docs; keep wording short and plain.

Do not touch: blog.config.yaml, voice.md, scripts/, server/db.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-spotlight-mode.test.ts tests/blog-editorial-focus-not-content.test.ts tests/blog-plain-language.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
