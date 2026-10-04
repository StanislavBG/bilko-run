---
title: Blog watchdog: a rotation-blocked draft must trigger a re-draft, and a no-op run must not report ok
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 20
createdVia: scheduler-api
issuedAt: 2026-09-13T00:19:23.892Z
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: bug
agentType: dev-lead
---
# Goal

The 2026-09-12 12:00 PT run of scripts/blog-cadence-watchdog.sh got all the way through the pipeline for the first time, then published nothing and exited 0 with heartbeat `ok: noop note="pending draft fails phase-5 rotation gate: ledger requires next post on-/projects, draft's primary subject (blog watchdog) is off-list, same as previous post"`. The rotation gate was RIGHT to reject that draft. The defect is what happened next: the run treated an unpublishable pending draft as a reason to do nothing at all, instead of drafting a rotation-compliant post — and then recorded that dead run as `ok:`, so the status-aware dead-man's-switch from PRD 1004 stays green while the publishing gap keeps growing. This is the ORIGINAL stall bug in a new costume: ten days of `ok: ... skipping` became `ok: noop ...`. Make a rotation-blocked draft cause a re-draft, and make a no-op run that leaves the cadence gap unclosed escalate instead of reporting healthy.

# Acceptance criteria

- [ ] Core: when the pipeline rejects a pending draft at the phase-5 rotation gate in autonomous mode, the run RE-DRAFTS — it selects a rotation-compliant subject (honoring blog-ledger.md's recorded rotation debt, rotation.md's never_repeat_previous_project and max_consecutive_untiled_posts) and produces a publishable post for this run, rather than stopping at a no-op
- [ ] Core: the claude -p prompt in scripts/blog-cadence-watchdog.sh no longer instructs the executor in a way that leaves 'I was told not to re-draft' as the correct reading when the pending draft is unusable — the run's 2026-09-12 transcript shows the executor explicitly citing that constraint as its reason for stopping
- [ ] Core: a run that ends with nothing seeded while the live gap still exceeds cadence.target_gap_days writes a `warn:` (not `ok:`) heartbeat naming why nothing published, so scripts/check-blog-watchdog-heartbeat.sh escalates it per PRD 1004's status-aware rules
- [ ] Core: a genuinely healthy no-op — the gap is WITHIN cadence and there is simply nothing to publish — still writes `ok:` and still exits 0; do not turn ordinary quiet days into alerts
- [ ] Edge cases: a pending draft that fails the rotation gate is moved out of the `*.md` glob (e.g. renamed with a suffix, or moved to a rejected/ subdirectory) rather than deleted or silently left in place to block every future run — preserve the content, unblock the pipeline
- [ ] Edge cases: if NO rotation-compliant subject exists (every candidate project would violate the ledger's rules), the run writes a `warn:` heartbeat saying exactly that and exits without inventing a post — blog.config.yaml's truth rules (no_invented_metrics, every_number_needs_a_source) still bind absolutely
- [ ] Edge cases: re-drafting must still respect max_posts_per_run and must not produce more drafts than it seeds, so the drafts/ directory cannot accumulate a backlog of unpublishable files again
- [ ] Edge cases: the re-draft path must not loop — one re-draft attempt per run, not a retry cycle that could burn the claude -p timeout budget
- [ ] Interaction / integration: no rail from PRDs 1007/1009/1010 changes — the StanislavBG/bilko-run remote assertion, explicit-pathspec staging, the ban on blanket `git add -A`/`git add .`/`git commit -a`, max_posts_per_run, the push-race rebase recovery, and the allowed_commit_paths parser all stay exactly as they are
- [ ] Interaction / integration: write_heartbeat is still called exactly once per run on every path and the heartbeat format stays `<ISO-8601 timestamp> <status text>`
- [ ] Tests: tests/blog-cadence-watchdog.test.ts gains assertions that the prompt instructs a re-draft when the pending draft fails rotation, that a rotation-blocked draft is moved out of the *.md glob, and that a nothing-published-while-over-cadence outcome maps to a `warn:` heartbeat rather than `ok:`
- [ ] Tests: a behavioral test (pure-local, no network, no claude -p) covers the heartbeat-status selection logic: over-cadence + nothing seeded => `warn:`, within-cadence + nothing to publish => `ok:`, seeded => `ok:`
- [ ] Tests: `bash -n scripts/blog-cadence-watchdog.sh` passes
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

VERIFIED EVIDENCE from the 2026-09-12 12:00 PT run — read this before changing anything.

Heartbeat written by that run (.claude/skills/blog-from-git/drafts/.watchdog-heartbeat):

    2026-09-12T12:01:01-07:00 ok: noop note="pending draft fails phase-5 rotation gate: ledger requires next post on-/projects, draft's primary subject (blog watchdog) is off-list, same as previous post"

The executor's own reasoning, from ~/.claude/logs/blog-cadence-watchdog.log, is correct on the rotation call and explicit about why it stopped:

    "Since phases 1-5 are marked done and I was told not to re-draft, and the self-check explicitly
     says 'If any is NO, the post is not ready. Rewrite, don't ship,' I'm not proceeding to phase
     6/7 approval or seeding. I left the draft file untouched in drafts/ ... No commit, no push,
     nothing seeded."

It cross-checked against blog-ledger.md's "Current rotation state" (lines 38-46), which records: last project covered = starry-night-ships (off-list, no tile), 2026-08-27, and "Rotation debt: the last post was off-/projects — the next post MUST be an on-/projects project." The draft's subject is the blog watchdog itself (internal tooling, not a slug in src/data/standalone-projects.json), so it would be the second consecutive off-list post. The gate is working; the stopping behavior is the bug.

ALREADY DONE MANUALLY, do not redo: the blocking draft has been moved aside to
`.claude/skills/blog-from-git/drafts/2026-09-01-the-blog-watchdog-raced-itself-on-its-first-run.md.rejected-rotation-gate`
(renamed out of the `*.md` glob, content preserved, still gitignored). The drafts/ *.md glob is now empty, so the next run drafts fresh. This PRD must make that move AUTOMATIC for the next occurrence rather than relying on a human noticing.

Key files: scripts/blog-cadence-watchdog.sh (the `$PROMPT` heredoc's autonomous branch, the `EXISTING_DRAFTS` handling around line 223 and 258, the SEED_RESULT parsing and heartbeat selection near the end), .claude/skills/blog-from-git/rotation.md (rule 2, max_consecutive_untiled_posts), .claude/skills/blog-from-git/blog-ledger.md (rotation state block, lines 38-50), .claude/skills/blog-from-git/blog.config.yaml (cadence.target_gap_days, rotation.*, truth.*), scripts/check-blog-watchdog-heartbeat.sh (PRD 1004's ok/warn/error semantics — reuse them, do not fork).

Note the drafts/ directory is gitignored (.gitignore:35 `.claude/skills/*/drafts/`), so draft files are NOT recoverable from git — any automated move must preserve the file, never delete it.

Follow the script's existing conventions: `set -euo pipefail`, exactly one write_heartbeat per exit path, `[blog-cadence-watchdog]`-prefixed stdout, failures to stderr, all policy read from blog.config.yaml rather than hard-coded.

Sibling PRD 1008-blog-watchdog-verify-live-pickup is still pending; do not duplicate its /api/blog verification poll.

# Out of scope

- Do NOT weaken or bypass the rotation gate — it made the correct call; the fix is what happens after it fires
- Do NOT delete a rejected draft — drafts/ is gitignored and the content is unrecoverable; move/rename only
- Do NOT invent a post to satisfy cadence when no compliant subject exists — blog.config.yaml's truth rules bind absolutely
- Do NOT weaken any rail from PRDs 1007/1009/1010 (remote assertion, explicit pathspecs, blanket-add ban, max_posts_per_run, push-race recovery, allowed_commit_paths parser)
- Do NOT turn within-cadence quiet days into warnings — only an over-cadence run that published nothing escalates
- Do NOT add the /api/blog live-pickup poll — PRD 1008 owns that
- Do NOT make any test call the network or invoke claude -p

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
