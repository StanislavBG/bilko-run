---
title: Blog watchdog: live recovery run and one real escalation check on this machine
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:05:14.711Z
sourcePromptId: blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964
agentType: dev-lead
dependsOn: [blog-watchdog-path-preflight, blog-heartbeat-escalate-to-human]
planId: pl-mv5x50j1-471a98
---
# Goal

validate (operational). After the PATH/preflight fix and the heartbeat escalation land on main, start the real systemd watchdog service once and confirm it gets past the cadence gate, and fire the escalation path once for real against a throwaway heartbeat so a desktop notification is actually shown. Record the evidence in a committed review file. No product code changes.

# Acceptance criteria

- [ ] Confirm `git -C /home/bilko/Projects/Bilko log --oneline -20` on main contains the commits for blog-watchdog-path-preflight and blog-heartbeat-escalate-to-human and that /home/bilko/Projects/Bilko/scripts/blog-watchdog-env.sh exists; if not, write that in the record and stop.
- [ ] Note the current byte size of /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/.watchdog.log, run `systemctl --user start --no-block blog-cadence-watchdog.service`, then poll at most 20 times x 15s for a new `[blog-cadence-watchdog] next_slot=<ISO>` line after that offset. Record the line, or the new FATAL line if one appears instead.
- [ ] Within the same bounded poll (extend to at most 40 x 15s total), record any `SEED_RESULT` line and the current .watchdog-heartbeat contents. If the run is still in flight when the cap is hit, record `still running` with `systemctl --user is-active blog-cadence-watchdog.service` output. The heartbeat must not read `error: cadence gate unavailable`.
- [ ] Run the real escalation once: `BLOG_WATCHDOG_HEARTBEAT_FILE=<tmp>/hb BLOG_WATCHDOG_ALERT_STATE_FILE=<tmp>/alert BLOG_WATCHDOG_RETRY_MARKER_FILE=<tmp>/retry SYSTEMCTL=/bin/true GH=/bin/false bash scripts/check-blog-watchdog-heartbeat.sh` with <tmp>/hb containing `<now ISO> error: missing binary simulated-check`; real notify-send stays enabled, GH is disabled so no real issue is created. Record exit code, stderr, and that <tmp>/alert now has a last_alert line.
- [ ] Write and commit session-manager-operations/reviews/ops/blog-watchdog-recovery-2026-10-12.md containing all of the above evidence (git add that exact path only).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/ops/blog-watchdog-recovery-2026-10-12.md

# Implementation notes

Run everything against the MAIN checkout /home/bilko/Projects/Bilko (the systemd unit uses WorkingDirectory=%h/Projects/Bilko), not your job worktree, except the commit of the record file which happens in your worktree as usual.

Read first: /home/bilko/.config/systemd/user/blog-cadence-watchdog.service; /home/bilko/Projects/Bilko/docs/blog-watchdog.md (sections on fail-closed next-slot and the new escalation section); /home/bilko/Projects/Bilko/scripts/check-blog-watchdog-heartbeat.sh (main, send_alert).

Steps:
1. Precondition check (AC 1).
2. `stat -c %s` the log, start the service with --no-block, then a `for i in $(seq 1 40)` loop with `sleep 15` that `tail -c +<offset+1>` the log and breaks on SEED_RESULT; check for next_slot= / FATAL each iteration. Never wait unbounded. A seeded run can take ~70 min; that is fine — record in-flight state and stop.
3. Never stop, restart, or kill the watchdog service, never edit systemd units, never push a blog post yourself. If the service ends in FATAL, record it verbatim; do not attempt a fix (the planner queues fixes).
4. Escalation simulation in a mktemp -d directory as in AC 4.
5. Write the record, commit only that path.

# Out of scope

- Any code change to scripts/ or tests/
- Creating a real GitHub issue
- Publishing or seeding a blog post by hand

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
