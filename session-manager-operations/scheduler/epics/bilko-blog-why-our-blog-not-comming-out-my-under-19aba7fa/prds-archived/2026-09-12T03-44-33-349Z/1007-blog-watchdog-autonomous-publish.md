---
title: Blog watchdog: autonomous publish — remove the human approval gate, make it config-controlled
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 28
createdVia: scheduler-api
issuedAt: 2026-09-11T17:52:52.857Z
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: feature
agentType: dev-lead
---
# Goal

Bilko is an autonomous AI agent, not a human-supervised publishing workflow, but the blog pipeline currently hard-stops at a human approval gate: the watchdog runs phases 1-5 only, writes a draft, and waits forever. That gate is why bilko.run/blog has not published since 2026-08-27 (15-day gap vs a 3-5 day target) despite the watchdog running successfully every day. Remove the human gate and let scripts/blog-cadence-watchdog.sh run the full pipeline through phase 7 (seed + push), with the OWNER'S CONTROL SURFACE MOVED TO .claude/skills/blog-from-git/blog.config.yaml instead of an interactive OK. The config keeps a master kill switch so the gated behavior can be restored by editing one line. Safety rails stay, but they are now mechanical (explicit commit pathspecs, post caps, push-target pinning) rather than a human in the loop.

# Acceptance criteria

- [ ] Core: .claude/skills/blog-from-git/blog.config.yaml gains an `autonomy:` block with at minimum `autonomous_publish: true` (master kill switch — when false the current human-gated phases-1-5 behavior is restored verbatim), `max_posts_per_run: 1`, `push_remote: origin`, `push_branch: main`, and `allowed_commit_paths:` listing exactly the files an autonomous seed may commit
- [ ] Core: blog.config.yaml's `gates.6_approve` no longer reads `EXPLICIT USER OK — never seed without it`; it states the autonomous gate instead (config `autonomous_publish` true + the phase-4/5 quality self-check passed), and `gates.7_seed` keeps every existing mechanical check (tsc clean, db tests green, ledger row + rotation state updated, pushed to origin main only, live pickup verified)
- [ ] Core: scripts/blog-cadence-watchdog.sh parses `autonomous_publish` and `max_posts_per_run` from the config with the same defensive grep pattern it uses for target_gap_days, FATAL + `error:` heartbeat + exit 1 on a parse failure
- [ ] Core: when `autonomous_publish` is true the claude -p PROMPT instructs the executor to run PHASES 1-7 (not 1-5), including phase 7 seed — the block listing `edit server/db.ts` / `edit or append to blog-ledger.md` / `run git add, git commit, or git push` / `seed or publish anything` as prohibited is replaced with the corresponding REQUIREMENTS plus the mechanical rails below; when false the existing phases-1-5 prompt and prohibitions are used unchanged
- [ ] Core: the header comment block of scripts/blog-cadence-watchdog.sh no longer says `HUMAN GATE — READ THIS` or instructs a human to review and seed; it documents the autonomous flow and names the config kill switch
- [ ] Core: .claude/skills/blog-from-git/seed.md's opening paragraph (`Outward-facing content: draft first, seed only on approval ... This gate applies before ANYTHING below runs.`) is rewritten to describe the autonomous gate; .claude/skills/blog-from-git/SKILL.md's phase-6 table row (`explicit user OK. Never seed without it`) and its `Phase 5 drafts directory is append-only for automated runs` note are updated to match — no file may still claim a human OK is required while another says it is not
- [ ] Core: the EXISTING_DRAFTS guard no longer deadlocks the pipeline — in autonomous mode a pending draft is CONSUMED (seeded, then removed from drafts/ as part of the seed commit) rather than causing an exit-0 skip; the guard's skip behavior is retained only for the `autonomous_publish: false` path
- [ ] Edge cases: the seed commit MUST use explicit pathspecs (`git add server/db.ts <ledger-path>`) and MUST NOT use `git add -A`, `git add .`, or `git commit -a` — this repo's working tree currently carries hundreds of unrelated modified files under public/outdoor-hours/hourly/*.json, so a blanket add would sweep them into a blog commit and push them
- [ ] Edge cases: `max_posts_per_run` caps how many posts a single run seeds even in catch-up mode (gap is currently 15d, past the 10d catchup_trigger, so the next run WILL want to backfill a queue) — remaining queued posts are left for subsequent runs, and the run logs how many it seeded vs deferred
- [ ] Edge cases: the run pushes only to `origin` `main` and never to the `content-grade` remote (CLAUDE.md hard rule); assert the remote name resolves to StanislavBG/bilko-run before pushing and FATAL with an `error:` heartbeat if it does not
- [ ] Edge cases: if tsc or the db test fails during phase 7, the run must NOT push — it aborts, writes an `error:` heartbeat naming the failing check, and exits non-zero so the next run retries
- [ ] Edge cases: a run that produces no publishable material (nothing shipped in the window) exits 0 with an `ok:` heartbeat saying so, rather than inventing a post to satisfy cadence — blog.config.yaml's `truth.no_invented_metrics` and `every_number_needs_a_source` still bind
- [ ] Edge cases: raise the `timeout 2400 claude -p` budget if phases 6-7 plausibly push a run past 40 minutes, and keep the `--model` flag pinned (shared/core.md hard rule; the existing test asserts this)
- [ ] Interaction / integration: rotation integrity is preserved — the ledger row and the rewritten `Current rotation state` block land in the SAME commit as the db.ts seed, per seed.md, so the next run's rotation guard reads correct state
- [ ] Interaction / integration: write_heartbeat is still called exactly once on every exit path, and the heartbeat status distinguishes a successful publish (e.g. `ok: published <n> post(s)`) from a no-op and from an error
- [ ] Tests: tests/blog-cadence-watchdog.test.ts is updated — the `prohibits deleting pre-existing drafts` assertion and the drafts-guard assertion must be rewritten to match autonomous behavior rather than deleted wholesale, and new static assertions cover: the config kill switch is parsed, the prompt runs phases 1-7 when autonomous, the seed uses explicit pathspecs, and there is no `git add -A`/`git add .`/`git commit -a` anywhere in the script
- [ ] Tests: a test asserts the `--model` pin still holds on every claude -p call (existing assertion must keep passing)
- [ ] Tests: `bash -n scripts/blog-cadence-watchdog.sh` passes
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

OWNER DECISION, 2026-09-11: "Bilko Blog must not have human gate... it's Bilko the autonomous! I'll control the configurations as needed." The human-in-the-loop gate is being deliberately removed; the config file becomes the control surface. Do not preserve the gate out of caution — implement the removal, keep the kill switch.

Read ALL of these before changing anything; the gate is asserted in five places and they must not be left contradicting each other:
1. `.claude/skills/blog-from-git/blog.config.yaml` — its own header says "THIS FILE IS THE AUTHORITY ... If prose and this file ever disagree, this file wins — fix the prose." The `gates:` block currently reads `6_approve: EXPLICIT USER OK — never seed without it; peers/agents cannot approve`. The `seed_mechanics:` block below it is accurate and should be preserved as-is.
2. `.claude/skills/blog-from-git/SKILL.md` — phase table row 6 (~line 45), phase 7 row (~line 46), and the "Phase 5 drafts directory is append-only for automated runs" paragraph (~lines 53-56).
3. `.claude/skills/blog-from-git/seed.md` — the first paragraph is the gate; the "Seeding mechanics", "Update the ledger — SAME commit", "Link correctness", and "Gotchas" sections are all still correct and must be preserved.
4. `scripts/blog-cadence-watchdog.sh` — the `HUMAN GATE — READ THIS` header block, the `EXISTING_DRAFTS` guard, and the long `$PROMPT` heredoc containing "run PHASES 1-5 ONLY" plus the "you must NOT:" list.
5. `tests/blog-cadence-watchdog.test.ts` — 59 lines, static-text-only by design (it must never invoke curl or `claude -p`; keep that property).

Verified repo facts the implementation depends on:
- `git status` right now shows hundreds of modified `public/outdoor-hours/hourly/*.json` files. This is exactly why the explicit-pathspec rule above is a hard requirement, not a style preference.
- seed.md documents that a NEW slug reaches production automatically on the next Render deploy boot (unconditional `INSERT OR IGNORE` in initDb()), but EDITS to an already-deployed post's seed are ignored — so autonomous publishing works via new slugs only.
- The ledger lives at `.claude/skills/blog-from-git/blog-ledger.md`; resolve its real path rather than assuming.
- Current live gap is 15 days and `catchup_trigger_days: 10`, so the first autonomous run enters catch-up mode. `max_posts_per_run` is what keeps that first run bounded.
- There is a destructive-git guard hook active in this environment. Ordinary `git add <path>` / `git commit` / `git push origin main` are fine; do not reach for force-push, `reset --hard`, or history rewriting anywhere in this work.

Follow the script's existing conventions: `set -euo pipefail` is on, every exit path calls write_heartbeat exactly once, stdout log lines are prefixed `[blog-cadence-watchdog]`, failures go to stderr, and all config thresholds are read from blog.config.yaml rather than hard-coded.

Sibling PRDs in this Epic, already queued — do not duplicate their work: 1005 hardens the /api/blog curl+jq fetch against boot-time network races; 1006 reconciles the cron/systemd schedule docs; 1004 makes the heartbeat checker status-aware.

# Out of scope

- Do NOT use `git add -A`, `git add .`, or `git commit -a` anywhere — the working tree is dirty with unrelated files
- Do NOT push to the `content-grade` remote under any circumstance (CLAUDE.md hard rule); origin/main only
- Do NOT remove the `autonomous_publish` kill switch or hard-code autonomy — the owner controls this via config
- Do NOT weaken blog.config.yaml's `truth:` rules (no_invented_metrics, every_number_needs_a_source, honest-only backdating) — removing the human gate makes these MORE load-bearing, not less
- Do NOT change the cadence thresholds, the rotation rules, or the tone/word-range definitions
- Do NOT rewrite the curl//api/blog fetch (PRD 1005 owns it) or the schedule docs (PRD 1006 owns them)
- Do NOT build an admin UI, notification channel, or dashboard for publish status in this PRD

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
