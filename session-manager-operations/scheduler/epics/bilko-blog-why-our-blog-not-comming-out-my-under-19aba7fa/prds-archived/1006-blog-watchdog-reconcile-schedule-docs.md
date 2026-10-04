---
title: Blog watchdog: reconcile duplicate cron and systemd schedules, fix stale schedule docs
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-09-11T17:47:49.373Z
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: bug
agentType: dev-lead
---
# Goal

scripts/blog-cadence-watchdog.sh is currently triggered by TWO independent schedulers that nobody reconciled: a crontab entry (`0 12 * * * .../blog-cadence-watchdog.sh >> ~/.claude/logs/blog-cadence-watchdog.log`) and a systemd user timer (blog-cadence-watchdog.timer, OnCalendar=daily, Persistent=true) whose service appends to a DIFFERENT log at .claude/skills/blog-from-git/drafts/.watchdog.log. The two logs contain different, partially overlapping histories, which made diagnosing the 15-day publishing stall harder than it should have been. Worse, the script's own header comment claims it "runs daily at 09:00 PT on a systemd user timer" — a third version that matches neither trigger. Document the real, intended schedule in one place and make the script self-describe it accurately, so the next person debugging a missed post reads one truth instead of three.

# Acceptance criteria

- [ ] Core: the header comment block in scripts/blog-cadence-watchdog.sh no longer claims 09:00 PT and instead states the actual intended trigger(s) and the log path(s) each one writes to, matching what is really installed on the machine
- [ ] Core: a short blog-watchdog section is added to the repo docs (docs/host-contract.md is NOT the right home — create docs/blog-watchdog.md or add to blogs.md, whichever fits the repo's existing doc conventions) recording: the two trigger mechanisms, the two log paths, whether publishing is autonomous or gated (read `autonomy.autonomous_publish` in `.claude/skills/blog-from-git/blog.config.yaml` at execution time and document what is ACTUALLY true then — sibling PRD 1007 removes the human approval gate and may or may not have landed yet), and where drafts land
- [ ] Core: the doc explicitly names which trigger is authoritative and states that the other is redundant, so a future reader knows whether removing one is safe — do not silently leave both undocumented
- [ ] Edge cases: the doc notes that both triggers are LOCAL to this machine and only fire while it is powered on, and that the systemd timer's Persistent=true replays a run missed during downtime whereas the crontab entry does not
- [ ] Edge cases: the doc records that the concurrency lock is /tmp/bilko.blog-cadence-watchdog.lock (flock -n) so overlapping triggers are a safe no-op, and that .watchdog-state makes a second same-day run idempotent — i.e. the duplication is currently harmless, not dangerous
- [ ] Interaction / integration: no change to the script's behavior, exit codes, heartbeat format, or thresholds — this PRD is comments and docs only on the script side
- [ ] Interaction / integration: if a shell change is needed to make the logging destinations consistent, it must not break scripts/check-blog-watchdog-heartbeat.sh's heartbeat path or the existing assertions in tests/blog-cadence-watchdog.test.ts
- [ ] Tests: `bash -n scripts/blog-cadence-watchdog.sh` passes
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

Verified current state on this machine (2026-09-11), for the doc to record accurately:

- crontab: `0 12 * * * /home/bilko/Projects/Bilko/scripts/blog-cadence-watchdog.sh >> /home/bilko/.claude/logs/blog-cadence-watchdog.log 2>&1 # bilko blog-cadence-watchdog`
- systemd user timer `blog-cadence-watchdog.timer`: `OnCalendar=daily`, `Persistent=true`, `AccuracySec=15min` (so it fires ~00:00-00:15 PT)
- systemd service `blog-cadence-watchdog.service`: `WorkingDirectory=%h/Projects/Bilko`, StandardOutput/StandardError `append:%h/Projects/Bilko/.claude/skills/blog-from-git/drafts/.watchdog.log`
- a sibling timer `blog-watchdog-heartbeat-check.timer` runs scripts/check-blog-watchdog-heartbeat.sh roughly twice daily
- the script's current header comment says "runs daily at 09:00 PT on a systemd user timer" — that is stale and is the line to correct

Both logs are real and both matter: ~/.claude/logs/blog-cadence-watchdog.log (cron) and .claude/skills/blog-from-git/drafts/.watchdog.log (systemd). Read both before writing the doc.

Do NOT edit the crontab or the systemd unit files from this PRD — they are machine state outside this repo, and changing a live schedule is the human's call. Recommend in the doc, don't execute. If the doc's recommendation is "drop the crontab entry and keep the Persistent=true timer", say so as a recommendation with its reasoning (Persistent=true survives the laptop being closed; plain cron does not) and leave the change to the human.

Check blogs.md and docs/ for the repo's existing doc conventions before deciding where this section lives.

# Out of scope

- Do NOT modify the user's crontab or any file under ~/.config/systemd/user/ — recommend only
- Do NOT change the watchdog's thresholds, guards, retry logic, or heartbeat semantics — those belong to the two sibling PRDs in this Epic
- Do NOT consolidate the two log files by rewriting history or deleting either one
- Do NOT touch docs/host-contract.md — the blog watchdog is not part of the host/static-path contract

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
