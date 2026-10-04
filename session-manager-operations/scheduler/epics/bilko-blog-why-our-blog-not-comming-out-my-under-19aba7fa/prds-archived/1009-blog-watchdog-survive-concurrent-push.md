---
title: Blog watchdog: survive a concurrent push to origin main instead of losing the publishing day
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 20
createdVia: scheduler-api
issuedAt: 2026-09-12T03:47:23.080Z
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: bug
agentType: dev-lead
---
# Goal

With PRD 1007 landed, scripts/blog-cadence-watchdog.sh now commits and pushes to origin/main autonomously — but it is no longer the only cron writer to that branch. ~/Projects/social-signals-trader/scripts/publish-to-bilko.sh pushes a dashboard snapshot to the SAME repo every hour at :47, and it already loses races: its log (~/.claude/logs/publish-to-bilko.log) contains 16 `rejected` and 8 `non-fast-forward / fetch first` events. Neither script pulls or rebases before pushing. The watchdog's systemd timer fires ~00:00-00:15 PT and its `claude -p` budget runs up to 40 minutes, so it overlaps the 00:47 snapshot push routinely. On a collision the push is rejected, the post-push check in blog-cadence-watchdog.sh sees `LOCAL_HEAD != origin/main`, writes an `error:` heartbeat and exits 1 — the seed commit is stranded locally and that day's post never publishes. Make the autonomous seed survive a concurrent push so a routine race does not silently cost a publishing day.

# Acceptance criteria

- [ ] Core: after the claude -p seed step reports a published result, scripts/blog-cadence-watchdog.sh detects a rejected/non-fast-forward push (or a local HEAD ahead of origin/main) and recovers by rebasing the seed commit onto the freshly fetched origin/main and re-pushing, rather than immediately declaring an error
- [ ] Core: the recovery retries a bounded number of times (e.g. 3 attempts) with a short backoff, and gives up with the existing `error:` heartbeat + non-zero exit only after the retries are exhausted
- [ ] Core: recovery uses `git pull --rebase origin main` (or `git fetch origin main` + `git rebase origin/main`) — never `git reset --hard`, never `git push --force` or `--force-with-lease`, and never any history rewrite of commits already on origin
- [ ] Core: the existing post-push safety audit still runs AFTER a successful recovery — the disallowed-path check over the seed commit and the final `LOCAL_HEAD == origin/main` assertion must both pass before the run reports `ok:`
- [ ] Edge cases: if the rebase hits a conflict, the run does NOT attempt to resolve it — it runs `git rebase --abort`, leaves the working tree exactly as it found it, writes an `error:` heartbeat naming the conflict, and exits non-zero for a human to inspect
- [ ] Edge cases: the rebase must not pick up the hundreds of unrelated modified files in this working tree (public/outdoor-hours/hourly/*.json are modified but UNSTAGED and must stay that way) — assert the working tree's unstaged state is unchanged across the recovery
- [ ] Edge cases: a push rejected for a reason OTHER than non-fast-forward (auth failure, network loss, remote refusing) is not retried as a rebase race — it goes straight to the `error:` heartbeat path with the actual git stderr recorded
- [ ] Edge cases: if the seed commit turns out to be already present on origin/main (the push actually succeeded but the status read was ambiguous), the run must detect that and report success rather than re-pushing or double-seeding
- [ ] Interaction / integration: none of this may weaken the rails PRD 1007 installed — the origin/StanislavBG/bilko-run remote assertion, explicit-pathspec staging, the ban on blanket `git add -A`/`git add .`/`git commit -a`, and max_posts_per_run all stay exactly as they are
- [ ] Interaction / integration: write_heartbeat is still called exactly once per run on every path, and the heartbeat format stays `<ISO-8601 timestamp> <status text>` so scripts/check-blog-watchdog-heartbeat.sh keeps parsing it
- [ ] Tests: tests/blog-cadence-watchdog.test.ts gains static assertions that a bounded rebase-and-retry recovery exists, that `git rebase --abort` appears on the conflict path, and that NO `push --force`, `push --force-with-lease`, `reset --hard`, `git add -A`, `git add .`, or `git commit -a` appears anywhere in the script
- [ ] Tests: `bash -n scripts/blog-cadence-watchdog.sh` passes
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

Read scripts/blog-cadence-watchdog.sh in full first, especially the autonomous branch added by commit 7e33190 (PRD 1007): the `AUTONOMOUS_PUBLISH` config parse (~line 105), the remote assertion (~lines 114-130), the `ALLOWED_COMMIT_PATHS` load (~line 140), the `$PROMPT` heredoc's seed rails (~lines 296-298), and the post-push audit block (~lines 370-405) which currently does:

    git fetch origin main --quiet 2>/dev/null || true
    LOCAL_HEAD="$(git rev-parse HEAD ...)"
    REMOTE_HEAD="$(git rev-parse origin/main ...)"
    ... disallowed-path check over git diff --name-only HEAD~1 HEAD ...
    if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
      ... write_heartbeat "error: local HEAD does not match origin/main after claimed publish"; exit 1

That final branch is exactly where a routine snapshot-cron race currently terminates the run. It should first try to recover, and only then fail.

Verified evidence for the race (gathered 2026-09-11):
- crontab: `47 * * * * /home/bilko/Projects/social-signals-trader/scripts/publish-to-bilko.sh` — hourly, pushes `HEAD:main` to origin (bilko-run) with no pull/rebase; see its lines ~153-182.
- `grep -c` over ~/.claude/logs/publish-to-bilko.log: 99 `push to ... failed`, 16 `rejected`, 8 `non-fast-forward / fetch first`.
- blog-cadence-watchdog.timer: `OnCalendar=daily`, `Persistent=true`, `AccuracySec=15min` → fires ~00:00-00:15 PT; the `timeout ... claude -p` budget in the script can run ~40 min, straddling 00:47.

NOTE: the actual push in autonomous mode is performed BY the `claude -p` subprocess following the prompt's rails, not by a `git push` line in this script. So the recovery logic added here operates on the aftermath (a local seed commit that did not reach origin). Consider whether it is cleaner to add the rebase-and-retry to the script's post-push block (it owns the verification already) rather than asking the subprocess to handle it — the script is deterministic, the subprocess is not. Prefer the script.

A destructive-git guard hook is active in this environment. Ordinary `git fetch` / `git rebase` / `git push origin main` are fine; do not reach for force-push, `reset --hard`, or history rewriting anywhere in this work — and note the AC explicitly forbids them regardless.

Follow the script's existing conventions: `set -euo pipefail`, exactly one write_heartbeat per exit path, `[blog-cadence-watchdog]`-prefixed stdout, failures to stderr, thresholds read from .claude/skills/blog-from-git/blog.config.yaml rather than hard-coded.

Sibling PRD 1008-blog-watchdog-verify-live-pickup is still pending and adds a post-publish /api/blog slug check; it may land before or after this one. Do not duplicate its verification poll — this PRD is only about surviving the push race.

# Out of scope

- Do NOT use push --force, push --force-with-lease, reset --hard, or any history rewrite — a rejected push is recovered by rebase-and-retry or it fails loudly
- Do NOT auto-resolve a rebase conflict — abort and report
- Do NOT modify ~/Projects/social-signals-trader (a sibling repo, not Bilko's to edit) — the fix belongs in the Bilko watchdog
- Do NOT edit the crontab or any systemd unit file — machine state outside this repo
- Do NOT weaken any rail from PRD 1007 (remote assertion, explicit pathspecs, blanket-add ban, max_posts_per_run)
- Do NOT add the /api/blog live-pickup poll — PRD 1008 owns that
- Do NOT commit or stage the unrelated modified files in the working tree under any circumstance

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
