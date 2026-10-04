---
title: Publish one new bilko.run blog post now (owner override of the 3-day cadence)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-03T17:04:35.054Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: build
agentType: dev-lead
dependsOn: [blog-config-reader-scalar-fix, blog-checker-source-claim-scope]
planId: pl-musn5bd6-b4cbc7
---
# Goal

behavior. The owner said on 2026-10-03, verbatim: "publish, lets start getting new blogs". The last post went live today, so the watchdog won't publish again until about 2026-10-06. This is the owner's explicit override (blog.config.yaml rotation.override: user-explicit-only) to publish ONE more post now. Run the blog-from-git skill end to end (phases 1-7). Every other rule still holds: rotation cooldown, truth rules, plain language, cool side first, absolute links.

# Acceptance criteria

- [ ] Exactly one new post is seeded in server/db.ts (INSERT OR IGNORE per .claude/skills/blog-from-git/seed.md). published_at is the actual authoring time as an explicit ISO string, never new Date(). In the SAME commit, a ledger row plus a rewritten 'Current rotation state' block are added to .claude/skills/blog-from-git/blog-ledger.md. Commit those two paths only, via explicit pathspecs.
- [ ] Subject: a tiled project (src/data/standalone-projects.json) NOT on the 3-post cooldown in blog-ledger.md (git-viewer, escape-velocity/starry-night-2 and session-manager are on cooldown as of today). Prefer one with real new work since 2026-09-26; otherwise use the most-overdue never-covered tiled project (spotlight mode, per SKILL.md and rotation.md). Grounded in its live tile, README and source. Never invent metrics.
- [ ] Before seeding, write the draft to a temp .md file and run `npx tsx scripts/blog-readability.ts <file>`. It must exit 0: FK grade <= 8, zero jargonHits, zero linkIssues. Every link is a full https URL, and any open-source/GitHub mention links https:// + the registry's host.sourceRepo. Rewrite and re-check at most 3 times; if it still fails, HALT with exit 1 and seed nothing.
- [ ] The post opens with the coolest thing an early-college reader can do with the project, in plain English, and has one clear clickable link to try it (https://bilko.run/projects/<slug>/ for static-path).
- [ ] `git push origin main` succeeds (never any other remote). Then, polling at most 20 times 30s apart with curl --max-time 15, https://bilko.run/api/blog lists the new slug. Report the live URL https://bilko.run/blog/<slug>. If it is not live after 20 polls, say so in the report; do not loop longer.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- .claude/skills/blog-from-git/blog-ledger.md

# Implementation notes

Read first: .claude/skills/blog-from-git/SKILL.md (the pipeline and final self-check), .claude/skills/blog-from-git/blog.config.yaml (the authority: readability, angle, links, rotation, truth, autonomy), .claude/skills/blog-from-git/voice.md, .claude/skills/blog-from-git/blog-ledger.md (cooldown and under-covered list; the row format to append). Also read seed.md and rotation.md for the mechanics.

Recent example of a good spotlight post: the 'turn-your-github-year-into-a-heatmap-and-badge-wall' seed in server/db.ts (grade 5.2, absolute links, links its repo).

Rails, copied from scripts/blog-cadence-watchdog.sh's autonomous prompt and all binding:
- Before committing, run `npx tsc --noEmit -p tsconfig.json` and `pnpm test tests/db.test.ts`.
- Stage only `git add server/db.ts .claude/skills/blog-from-git/blog-ledger.md`. Never `git add -A`, `.` or `-a`; the tree has hundreds of unrelated modified public/outdoor-hours/*.json files.
- Push to origin main only, never content-grade.
- Bilko is an AI agent: no invented human persona or location.

Do not run scripts/blog-cadence-watchdog.sh. Do not touch drafts/.watchdog-state.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/db.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
