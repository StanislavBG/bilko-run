---
title: Blog watchdog: never skip a due post — spotlight fallback, publish-date = today, readability gate before seeding
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-03T06:44:20.293Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
agentType: dev-lead
dependsOn: [blog-plain-language-voice]
planId: pl-mus0ziaz-37bb07
---
# Goal

behavior. The owner wants a post every 3 days; the live record shows gaps of 6, 14, 6 days (08-27, 09-02, 09-16, 09-22, then a post seeded 2026-10-01 but backdated to 09-26). Two mechanical causes in scripts/blog-cadence-watchdog.sh: (1) when a post is due but the scan finds no new git work (or only cooldown projects) the claude -p run is told to print `SEED_RESULT: noop`/`cooldown_blocked` and publish nothing — even though ~17 tiled projects are under-covered and a post's subject is meant to be the project's value, not its commits; (2) current-mode posts get backdated to the ship date, so the blog looks stale and the next gap is miscounted. Fix both, and make the plain-language checker a hard step before seeding.

# Acceptance criteria

- [ ] blog.config.yaml `cadence:` gains `no_new_work_fallback: spotlight` (comment: when a post is due and no rotation-eligible project has new work in the window, write an evergreen feature spotlight on the most-overdue tiled project instead of skipping) and `current_post_published_at: authored_at` (comment: portfolio/focused/spotlight posts are dated the moment they are authored; only catchup-mode backfill posts are honestly backdated); `grounding:` comment notes spotlight mode picks its focus by coverage age, not git
- [ ] scripts/blog-cadence-watchdog.sh has a pure function `spotlight_candidates <registry.json> <ledger.md> <cooldown_csv>` that prints, one per line, the slugs of tiled projects in src/data/standalone-projects.json that are NOT in the cooldown list, ordered never-covered first, then by oldest last ledger appearance
- [ ] In portfolio mode the claude -p prompt passes the top spotlight candidates and instructs: if there is no publishable new work, write a spotlight post on the first candidate (grounded in its live tile, README and source, plain language, cool-side-first per blog.config.yaml angle:); `SEED_RESULT: noop` / `cooldown_blocked` are allowed only when spotlight_candidates prints nothing
- [ ] The autonomous prompt requires: non-catchup posts use published_at = the script's AUTHORED_AT value exactly; and before seeding, `npx tsx scripts/blog-readability.ts <draft>` must exit 0 — rewrite and re-check up to 2 times, then finish with `SEED_RESULT: error note="readability"` without committing
- [ ] tests/blog-cadence-watchdog.test.ts gains behavioral tests (sourcing the real function, no network, no claude -p) proving spotlight_candidates excludes cooldown slugs, puts a never-covered tiled slug before a covered one, prints nothing when every tiled slug is on cooldown, and handles an empty ledger
- [ ] All existing tests in tests/blog-cadence-watchdog.test.ts, tests/blog-watchdog-heartbeat.test.ts and the rails from PRDs 1007/1009/1010/1011/1012 (remote assertion, explicit-pathspec staging, blanket-add ban, max_posts_per_run, push-race recovery, single write_heartbeat per run, --model pin) are unchanged and passing; `bash -n` passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- tests/blog-cadence-watchdog.test.ts
- .claude/skills/blog-from-git/blog.config.yaml

# Implementation notes

Read first: scripts/blog-cadence-watchdog.sh lines 120-200 (config parsing + cooldown helpers — follow the exact style used for the cooldown/`publish_due_status` pure functions and the source-guard that lets tests call them), lines 436-520 (MODE_INSTRUCTIONS, AUTHORED_AT, COOLDOWN_INSTRUCTIONS, the autonomous REQUIREMENTS prompt incl. the `SEED_RESULT: noop` line), tests/blog-cadence-watchdog.test.ts (how existing tests source functions — reuse that harness), .claude/skills/blog-from-git/blog-ledger.md (row format: find which column names the project), src/data/standalone-projects.json (registry shape; 'tiled' = an entry present in this file — read how the existing max_consecutive_untiled_posts logic decides tiled vs untiled and reuse it).

Context: the 2026-10-02 run log said "No new substantive work since the 2026-09-26 post" and published nothing while the blog was 6 days stale. The ledger's 'Due / under-covered on-list projects' list (outdoor-hours, local-score, game-academy, stack-audit, launch-grader, ad-scorer, headline-grader, thread-grader, email-forge, audience-decoder, bglabs, cellar, etch, fizzpop, mindswiffer, sudoku, git-viewer) is what spotlight mode should be drawing from — but compute it, don't hard-code it.

Steps:
1. Red tests for spotlight_candidates first.
2. Add spotlight_candidates (use jq for the registry — jq is already a dependency of this script).
3. Compute SPOTLIGHT_CANDIDATES (top 3) after RECENT_PROJECTS_CSV is set; inject into the portfolio-mode and autonomous prompts; narrow the noop/cooldown_blocked instructions as in the AC. Catch-up mode keeps honest backdating untouched.
4. Edit blog.config.yaml cadence:/grounding: keys. Keep `backdating: honest-only` (an existing test asserts it).
5. bash -n, then the gate last.

Do not touch: rotation.md, seed.md, SKILL.md (next PRD), voice.md, scripts/blog-readability.ts, server/db.ts. Never run the watchdog for real (it invokes claude -p and pushes).

# Out of scope

- Re-dating the already-live 2026-09-26 post
- Changing the daily timer or the 3/5-day bounds
- Prose docs for spotlight mode (next PRD)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 60 bash -n scripts/blog-cadence-watchdog.sh
timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts tests/blog-editorial-focus-not-content.test.ts tests/blog-plain-language.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
