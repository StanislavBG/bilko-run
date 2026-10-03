# Blog ledger — rotation memory

The editorial-rotation guard (SKILL.md Part 0) reads this before drafting. Each row is one
published post: date · slug · **project** · `on /projects?` (is the project a slug in
`src/data/standalone-projects.json`?) · tone used.

**Append a row every time you seed a new post.** Newest at the top. This file — not the git
scan — is what tells you whether you're about to break the consecutive-rule or repeat a project.

| Date | Slug | Project | On /projects? | Tone |
|---|---|---|---|---|
| 2026-10-03 | twelve-places-one-weather-rule-you-set-yourself | outdoor-hours | ✅ | problem-outcome (spotlight) |
| 2026-10-03 | turn-your-github-year-into-a-heatmap-and-badge-wall | git-viewer | ✅ | problem-outcome (spotlight) |
| 2026-09-26 | a-space-shooter-shrank-66-percent-to-fit-in-your-browser | escape-velocity | ✅ | shipped-note |
| 2026-09-22 | twelve-releases-in-four-days-for-the-scheduler-view | session-manager | ✅ | shipped-note |
| 2026-09-16 | sigma-now-shows-who-sits-behind-a-contract | sigma | ✅ | shipped-note |
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

- **Last project covered:** outdoor-hours (on-list, ✅ tile), spotlight post dated 2026-10-03.
  Owner override, verbatim 2026-10-03: "publish, lets start getting new blogs" —
  `rotation.override: user-explicit-only` invoked to publish one more post the same day as the
  git-viewer spotlight below, ahead of the normal ~2026-10-06 cadence window. The override covers
  cadence TIMING only; the 3-post project cooldown and every other rotation rule still applied
  normally when picking the subject. Re-ran the GitHub scan since 2026-09-26: still only
  `bilko-run` (host, meta) and `claude-code-session-manager` (session-manager, on cooldown) had
  pushed — no rotation-eligible project had new work, so `cadence.no_new_work_fallback: spotlight`
  fired again. Candidate order (never-covered-first, registry slug order, cooldown projects
  removed): outdoor-hours, sudoku, mindswiffer, local-score, bilko-flow, game-academy,
  headline-grader, thread-grader, stepproof, ad-scorer, email-forge, audience-decoder,
  launch-grader, stack-audit, bglabs, fizzpop, etch, cellar. Picked outdoor-hours (first on that
  list). Grounded in its live data bundle (`public/outdoor-hours/last10y.json`: 12 regions across
  CA/WA/FL/VA/NY/HI/Bulgaria, 5 named weather profiles, data back to 2016) and its page source
  (`~/Projects/Outdoor-Hours/src/OutdoorHoursPage.tsx`: 7-dial custom rule, plain-English
  leaderboard sentence, percent-gap-to-days math, year-over-year toggle), not git activity.
  `max_posts_per_run: 1` capped it to one seed for this run.
- **Rotation debt:** none — last post on-`/projects`. burrow (off-list, no tile) is ineligible as a
  sole subject (no user-facing surface); do not queue it as a standalone post.
- **Tone experiment log:** all five tones now published twice or more — changelog (06-28, 07-24,
  08-19), problem→outcome (07-02, 08-11, 10-03 ×2 spotlight), shipped-note (07-06, 07-21, 08-23,
  08-27, 09-22, 09-26), field-note (07-11, 07-31, 08-08, 08-15, 09-02), metric-update (07-18,
  08-04). Next: compare reception/readability rather than adding tones.
- **Cooling off (last 3 ledger rows — ineligible as next primary subject):** outdoor-hours,
  git-viewer, escape-velocity.
- **Due / under-covered on-list projects** (good next candidates): local-score, game-academy,
  stack-audit, launch-grader, ad-scorer, headline-grader, thread-grader, email-forge,
  audience-decoder, bglabs, cellar, etch, fizzpop, mindswiffer, sudoku.
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
