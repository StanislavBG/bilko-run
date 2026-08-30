# Blog ledger — rotation memory

The editorial-rotation guard (SKILL.md Part 0) reads this before drafting. Each row is one
published post: date · slug · **project** · `on /projects?` (is the project a slug in
`src/data/standalone-projects.json`?) · tone used.

**Append a row every time you seed a new post.** Newest at the top. This file — not the git
scan — is what tells you whether you're about to break the consecutive-rule or repeat a project.

| Date | Slug | Project | On /projects? | Tone |
|---|---|---|---|---|
| 2026-08-27 | a-new-game-a-week-old-and-already-playable | starry-night-ships | ❌ no tile | shipped-note |
| 2026-08-23 | epics-stopped-sharing-one-working-directory | session-manager | ✅ | shipped-note |
| 2026-08-19 | siblings-can-now-see-their-own-bandwidth-bill | mcp-host | ✅ | changelog |
| 2026-08-15 | the-bug-that-silently-killed-every-post | burrow | ❌ no tile | field-note |
| 2026-08-11 | the-app-stays-free-the-manual-is-19-99 | session-manager | ✅ | problem→outcome |
| 2026-08-08 | a-bad-quote-almost-cost-14000-on-paper | social-signals-trader | ✅ | field-note |
| 2026-08-04 | the-retry-that-cost-93-calls-to-fail-once | signal-builder | ✅ | metric-update |
| 2026-07-31 | five-stats-replace-twenty-two-that-did-nothing | 01-shapes-foundation | ❌ no tile | field-note |
| 2026-07-28 | the-academy-course-is-now-just-about-claude | academy | ✅ | changelog |
| 2026-07-24 | deleting-951-lines-to-hit-100-percent | portfolio (burrow + claude-agents + shapes-foundation) | mixed | changelog |
| 2026-07-21 | the-web-remote-now-survives-a-reload | session-manager | ✅ | shipped-note |
| 2026-07-18 | sixty-five-hours-of-silence | burrow | ❌ no tile | metric-update |
| 2026-07-11 | the-topic-tagger-kept-answering-only | sigma (sigma-plus) | ✅ | field-note |
| 2026-07-06 | signal-builder-tombstones-stop-retrying-the-dead | signal-builder | ✅ | shipped-note |
| 2026-07-02 | sigma-quality-index-which-contracts-look-unhealthy | sigma | ✅ | problem→outcome |
| 2026-06-28 | session-manager-034-dormant-tabs | session-manager | ✅ | changelog |
| 2026-06-24 | i-gave-sigma-a-way-to-see-the-network | sigma | ✅ | shipped-note |
| 2026-06-21 | coverage-got-burrow-to-the-post-recall-reads-it | burrow | ❌ no tile | build-log (field-note) |
| 2026-06-18 | coverage-debt-making-burrow-visit-what-it-skips | burrow | ❌ no tile | build-log (field-note) |
| 2026-06-13 | hardening-the-trading-stack-before-the-mcp | burrow / trading-stack | ❌ no tile | build-log (field-note) |
| 2026-06-03 | mcp-host-istore-for-mcps | mcp-host | ✅ | build-log |
| 2026-06-03 | trader-extract-and-reclaim | social-signals-trader | ✅ | build-log |
| 2026-06-03 | signal-builder-m0-to-m9 | signal-builder | ✅ | build-log |
| 2026-06-03 | how-pageroast-went-from-frustration-to-product | page-roast | ✅ | product |


## Current rotation state (update when you append)

- **Last project covered:** starry-night-ships (off-list, no tile), 2026-08-27, closing the
  catch-up backfill of the 07-24→08-29 gap (9 posts seeded 2026-08-29 in one commit, backdated to
  when the work shipped). These were the first posts DRAFTED BY AUTOMATION —
  `scripts/blog-cadence-watchdog.sh` produced them unattended; a human reviewed and approved
  before seeding, per SKILL.md phase 6.
- **Rotation debt:** the last post was off-`/projects` (starry-night-ships) — the next post MUST be
  an on-`/projects` project.
- **Tone experiment log:** all five tones now published twice or more — changelog (06-28, 07-24,
  08-19), problem→outcome (07-02, 08-11), shipped-note (07-06, 07-21, 08-23, 08-27), field-note
  (07-11, 07-31, 08-08, 08-15), metric-update (07-18, 08-04). Next: compare reception/readability
  rather than adding tones.
- **Cooling off (covered in this backfill, deprioritize):** session-manager (×2), social-signals-trader,
  signal-builder, mcp-host, academy, burrow, 01-shapes-foundation, starry-night-ships.
- **Due / under-covered on-list projects** (good next candidates): outdoor-hours, local-score,
  game-academy, stack-audit, launch-grader, ad-scorer, headline-grader, thread-grader, email-forge,
  audience-decoder, bglabs, cellar, etch, fizzpop, mindswiffer, sudoku, git-viewer, sigma.
- **Unpushed-repo watchlist (re-verified 2026-08-29, all WORSE than 07-24):** signal-builder 116
  commits ahead (was 105), burrow 218 ahead (was 174), social-signals-trader ~200 ahead,
  starry-night-ships has no remote at all, sigma-plus still no remote. GitHub-first scans miss ALL
  of this work — local reconciliation is mandatory, not optional.
- **Cadence is now automated:** `blog-cadence-watchdog.timer` (systemd user timer, OnCalendar=daily,
  Persistent=true) drafts into `drafts/` whenever the live gap blows `target_gap_days`. It never
  seeds — phase 6 approval stays human. A stale watchdog is caught by
  `blog-watchdog-heartbeat-check.timer`; the live gap shows on /admin observability.
