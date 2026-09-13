# Blog ledger — rotation memory

The editorial-rotation guard (SKILL.md Part 0) reads this before drafting. Each row is one
published post: date · slug · **project** · `on /projects?` (is the project a slug in
`src/data/standalone-projects.json`?) · tone used.

**Append a row every time you seed a new post.** Newest at the top. This file — not the git
scan — is what tells you whether you're about to break the consecutive-rule or repeat a project.

| Date | Slug | Project | On /projects? | Tone |
|---|---|---|---|---|
| 2026-09-02 | the-book-didnt-know-what-it-already-held | social-signals-trader | ✅ | field-note |
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

- **Last project covered:** social-signals-trader (on-list, ✅ tile), post dated 2026-09-02, seeded
  2026-09-12 by an unattended watchdog run — first post where the watchdog ran the FULL pipeline
  (phases 1-7, including autonomous approve + seed) rather than stopping at draft. This is 1 of
  potentially several backfill posts for the 08-27→09-12 gap (16 days); `max_posts_per_run: 1`
  capped this run to one seed — remaining window is in the "Planned backfill queue" below.
- **Rotation debt:** none — the last post was on-`/projects`. The next post MAY be off-list
  (burrow is the strongest queued candidate) since two consecutive off-list posts is the rule being
  guarded against, not one.
- **Tone experiment log:** all five tones now published twice or more — changelog (06-28, 07-24,
  08-19), problem→outcome (07-02, 08-11), shipped-note (07-06, 07-21, 08-23, 08-27), field-note
  (07-11, 07-31, 08-08, 08-15, 09-02), metric-update (07-18, 08-04). Next: compare
  reception/readability rather than adding tones.
- **Cooling off (last 3 ledger rows — ineligible as next primary subject):** social-signals-trader,
  starry-night-ships, session-manager.
- **Due / under-covered on-list projects** (good next candidates): outdoor-hours, local-score,
  game-academy, stack-audit, launch-grader, ad-scorer, headline-grader, thread-grader, email-forge,
  audience-decoder, bglabs, cellar, etch, fizzpop, mindswiffer, sudoku, git-viewer, sigma.
- **Unpushed-repo watchlist (re-verified 2026-09-12):** signal-builder 116 commits ahead (0 new
  since 2026-08-27, unchanged), burrow 239 ahead (21 landed since 2026-08-27 — active, off-list,
  next queued candidate), sigma-plus still no remote at all (0 new commits found), starry-night-ships
  still no remote at all but very active (256 commits since 2026-08-27 — already covered/cooling,
  skip). GitHub-first scans miss ALL of this work — local reconciliation is mandatory, not optional.
- **Planned backfill queue (08-27 → 09-12 gap, 16 days; `catchup_trigger_days: 10` tripped):**
  - ~~2026-09-02 · social-signals-trader · the-book-didnt-know-what-it-already-held (seeded this run)~~
  - 2026-09-06ish · burrow (off-list) · candidate story units in the 21 unpushed commits since
    2026-08-27 not yet researched in depth — next run should read them before drafting.
  - claude-code-session-manager shipped substantial work in this window too (telemetry, scheduler
    escalation/quarantine guards, v0.86.0 release) but is on cooldown until social-signals-trader
    and starry-night-ships roll off — do not draft it next even though it's on-list and active.
  - Remaining slots (09-10ish → today) still need a scan pass once burrow's story unit is placed;
    a future run should re-run `scan.md` §5 for local-only repos before assuming this queue is complete.
- **Cadence is now automated:** `blog-cadence-watchdog.timer` (systemd user timer, OnCalendar=daily,
  Persistent=true) runs the full pipeline unattended per `blog.config.yaml`'s
  `autonomy.autonomous_publish: true` — phases 6/7 (approve, seed) no longer wait on a human when
  that flag is true. A stale watchdog is caught by `blog-watchdog-heartbeat-check.timer`; the live
  gap shows on /admin observability.
