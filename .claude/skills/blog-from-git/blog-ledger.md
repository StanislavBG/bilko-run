# Blog ledger — rotation memory

The editorial-rotation guard (SKILL.md Part 0) reads this before drafting. Each row is one
published post: date · slug · **project** · `on /projects?` (is the project public on
https://bilko.run/projects, i.e. `public: true` in `src/data/standalone-projects.json`?) · tone used.
Rows before 2026-10-13 predate that rule and record registry membership only.

**Append a row every time you seed a new post.** Newest at the top. This file — not the git
scan — is what tells you whether you're about to break the consecutive-rule or repeat a project.

| Date | Slug | Project | On /projects? | Tone |
|---|---|---|---|---|
| 2026-11-05 | a-minesweeper-that-never-makes-you-guess | mindswiffer (admin-only) | ❌ not public | unspecified (burrow) |
| 2026-11-02 | your-build-now-carries-to-the-next-planet | escape-velocity | ✅ | unspecified (burrow) |
| 2026-10-29 | the-web-remote-now-drives-any-computer-you-pair | session-manager | ✅ | unspecified (burrow) |
| 2026-10-26 | no-subscription-bilkos-help-now-costs-50-cents-to-9 | bilko-run (credits wallet, host feature) | ❌ not public | unspecified (burrow) |
| 2026-10-22 | four-arcade-games-now-playable-online-with-a-friend | game-academy | ✅ | unspecified (burrow) |
| 2026-10-19 | boat-shooter-is-back-116-mb-down-to-2 | game-academy | ✅ | unspecified (burrow) |
| 2026-10-16 | the-family-screen-that-opens-your-mail-for-you | family-frame | ✅ | unspecified (burrow) |
| 2026-10-13 | launch-kit-eight-skills-hand-off-one-shared-brief | launch-kit | ✅ | unspecified (burrow) |
| 2026-10-07 | twelve-places-one-weather-rule-you-set-yourself | outdoor-hours | ✅ | problem-outcome (spotlight, scheduled) |
| 2026-10-03 | turn-your-github-year-into-a-heatmap-and-badge-wall | git-viewer | ✅ | problem-outcome (spotlight) |
| 2026-09-26 | a-space-shooter-shrank-66-percent-to-fit-in-your-browser | escape-velocity | ✅ | shipped-note |
| 2026-09-22 | twelve-releases-in-four-days-for-the-scheduler-view | session-manager | ✅ | shipped-note |
| 2026-09-16 | sigma-now-shows-who-sits-behind-a-contract | sigma | ✅ | shipped-note |
| 2026-09-02 | the-book-didnt-know-what-it-already-held | social-signals-trader | ✅ | field-note |
| 2026-08-27 | a-new-game-a-week-old-and-already-playable | starry-night-ships | ❌ no tile | shipped-note |
| 2026-08-23 | epics-stopped-sharing-one-working-directory | session-manager | ✅ | shipped-note |
| 2026-08-19 | siblings-can-now-see-their-own-bandwidth-bill | bilko-host | ✅ | changelog |
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
| 2026-06-03 | mcp-host-istore-for-mcps | mcp-host (retired 2026-10-09) | ✅ | build-log |
| 2026-06-03 | trader-extract-and-reclaim | social-signals-trader | ✅ | build-log |
| 2026-06-03 | signal-builder-m0-to-m9 | signal-builder | ✅ | build-log |
| 2026-06-03 | how-pageroast-went-from-frustration-to-product | page-roast | ✅ | product |


## Current rotation state (update when you append)

- **Last project covered:** mindswiffer (not public), post `a-minesweeper-that-never-makes-you-guess` seeded 2026-11-05 by scripts/blog-seed.sh.
- **Subject rule (owner, 2026-11-05):** every post is about one project that is public on
  https://bilko.run/projects. Admin-only and untiled projects (mindswiffer, burrow, …) are never a
  subject; scripts/blog-subjects.ts enforces it at draft time. The 2026-11-05 MindSwiffer post
  broke this rule before it existed in code.
- **Tone experiment log:** all five tones now published twice or more — changelog (06-28, 07-24,
  08-19), problem→outcome (07-02, 08-11, 10-03 ×2 spotlight), shipped-note (07-06, 07-21, 08-23,
  08-27, 09-22, 09-26), field-note (07-11, 07-31, 08-08, 08-15, 09-02), metric-update (07-18,
  08-04). Next: compare reception/readability rather than adding tones.
- **Cooling off (last 3 ledger rows — ineligible as next primary subject):** mindswiffer, escape-velocity, session-manager.
- **Due / under-covered public projects** (next candidates, never covered first, then longest since last covered; regenerated by scripts/blog-seed-apply.ts): human-for-hire (never), academy (2026-07-28), social-signals-trader (2026-09-02), git-viewer (2026-10-03), outdoor-hours (2026-10-07), launch-kit (2026-10-13), family-frame (2026-10-16), game-academy (2026-10-22).
- **Unpushed-repo watchlist (re-verified 2026-10-03):** `starry-night-2` is local-only (no remote)
  despite being published and tiled as escape-velocity — pushing it to GitHub is still outstanding.
  `wizzard-arena` is still local-only, no tile, last commit 09-25 (nothing new this window) — not
  yet eligible for a standalone post. `signal-builder`, `burrow`, `sigma-plus`, `Preflight`,
  `review-pilot` unchanged, no commits in this window. GitHub-first scans miss ALL local-only
  work — local reconciliation is mandatory, not optional.
- **Planned backfill queue:** empty — gap was 6d (under the 10d catch-up trigger), handled as a
  single spotlight post, not a backfill queue.
- **Cadence is now automated:** `blog-cadence-watchdog.timer` (systemd user timer, OnCalendar=daily,
  Persistent=true) runs the full pipeline unattended per `blog.config.yaml`'s
  `autonomy.autonomous_publish: true` — phases 6/7 (approve, seed) no longer wait on a human when
  that flag is true. A stale watchdog is caught by `blog-watchdog-heartbeat-check.timer`; the live
  gap shows on /admin observability. This row was seeded by an explicit owner override, not the
  watchdog — the next watchdog run should treat 2026-10-03 as the last-post date either way.
