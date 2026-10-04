---
title: Draft the catch-up backfill queue for the 2026-07-24 to 2026-08-29 blog gap (drafts only, no seeding)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 90
createdVia: scheduler-api
issuedAt: 2026-08-29T23:59:44.263Z
sourcePromptId: blogs-are-behind-i-don-t-see-new-blogs-on-the-si-8d72aba1
tag: feature
---
# Goal

The blog has been silent for 36 days (last post 2026-07-24). Per the blog-from-git skill's catch-up mode (rotation.md Part 0.5), a gap this size is backfilled as a queue of normal-sized posts at the standing 3-5 day cadence, each dated to when the work actually shipped — not one mega post. Run phases 1-5 of the pipeline over the whole 07-24 to 08-29 window and produce the full draft queue on disk, ready for the human to read and approve. Do NOT seed and do NOT publish.

# Acceptance criteria

- [ ] Phase 1 (rotation) ran: read rotation.md + blog-ledger.md and recorded which projects are eligible. The ledger's current rotation-state block says rotation debt is owed to an on-/projects project (last posts leaned on burrow, which has no tile) — the first backfilled slot MUST satisfy that
- [ ] Phase 2 (scan) ran across the whole 2026-07-24 to 2026-08-29 window, enumerating repos via `gh` per scan.md, WITH the local-only reconciliation step — the ledger's unpushed-repo watchlist warns that signal-builder, burrow, and sigma-plus have large unpushed local histories a GitHub-first scan would miss entirely
- [ ] Cron-generated commit noise is filtered out of the scan — e.g. the ~hourly 'social-signals-trader: publish dashboard snapshot' commits in this repo are not shippable work and must not become a story unit
- [ ] Slot dates laid out every 3-5 days from ~2026-07-28 through 2026-08-29, one story unit per slot, each slot's date matching when that work actually landed (honest backdating per blog.config.yaml `cadence.backdating: honest-only`)
- [ ] Rotation rules hold ACROSS the whole backfilled sequence: no two consecutive posts on the same project, and never two consecutive posts about a project with no /projects tile
- [ ] The planned queue is written into blog-ledger.md under a 'Planned backfill queue' block BEFORE drafting, so a later session can resume mid-way
- [ ] Every post is fully drafted (phases 3-5: research, ground, voice) to file at .claude/skills/blog-from-git/drafts/<slot-date>-<slug>.md — real evidence, every printed number traced to a named source, one named tone per post within its length target
- [ ] server/db.ts is NOT modified and nothing is published — confirm with `git status` and `git diff --stat`; the only tracked-file change is the blog-ledger.md queue block plus the new drafts/
- [ ] The report names each drafted post (slot date, slug, project, on-/projects yes/no, tone) so the human can approve or reject them individually

# Implementation notes

Read .claude/skills/blog-from-git/SKILL.md first, then blog.config.yaml (the grounding authority — it wins over any prose), then the per-phase sub-skill files as each phase starts: rotation.md, scan.md, research.md, ground.md, voice.md. Do NOT read seed.md's phase-7 instructions as license to seed — phase 6 is an explicit hard gate ("explicit user OK. Never seed without it") and this PRD stops before it.

Window boundary is established: live https://bilko.run/api/blog newest published_at = 2026-07-24T16:00:00.000Z (31 posts total); the seeding commit was d2f32cf on 2026-07-24. Today is 2026-08-29 → 36-day gap, well past blog.config.yaml's catchup_trigger_days: 10, so catch-up mode is correct and unambiguous.

Rotation constraints from blog-ledger.md's current state block, which the drafts must respect:
- Cooling off (covered in the last backfill, deprioritize): session-manager x2, sigma x2 (incl. sigma-plus), burrow x2, signal-builder.
- Due / under-covered ON-/projects candidates: outdoor-hours, local-score, game-academy, academy, stack-audit, launch-grader, ad-scorer, headline-grader, thread-grader, email-forge, audience-decoder, bglabs, cellar, etch, fizzpop, mindswiffer, sudoku, git-viewer.
- A project is "on /projects" iff its slug is in src/data/standalone-projects.json — check there, don't guess.

Phase 3 fans out one read-only agent per story unit; that pays for itself at this window size. Where a covered project exposes its own MCP or scorecard (e.g. Burrow's burrow-brain MCP + coverage_scorecard.py), query it during grounding so value claims come from live state, not just diffs.

This PRD depends on nothing, but note the sibling PRD 1001 (blog-cadence-watchdog) builds the automation that prevents the next gap; this one clears the existing one.

# Out of scope

- Seeding posts into server/db.ts
- Committing or pushing anything beyond the ledger queue block and the drafts directory
- Appending final ledger rows / updating the rotation-state block (that happens at seed time, after approval)
- One mega 'everything since July' post — catch-up mode is explicitly a queue of normal-sized posts
- Building the cadence automation (PRD 1001 owns that)

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
