---
title: Blog watchdog: make the heartbeat dead-man's-switch status-aware, not just age-aware
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 16
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: bug
agentType: dev-lead
createdVia: scheduler-api
issuedAt: 2026-09-11T17:46:23.932Z
---
# Goal

The heartbeat dead-man's-switch `scripts/check-blog-watchdog-heartbeat.sh` only checks how OLD the heartbeat is, never what it SAYS. That is how a 10-day total deadlock of the blog pipeline reported as perfectly healthy: `scripts/blog-cadence-watchdog.sh` refreshed the heartbeat every single day with `ok: 1 unreviewed draft(s) already pending review — skipping`, and the checker saw a fresh file and exited 0. Make the checker parse the heartbeat's STATUS and escalate `error:` and `warn:` states, so a watchdog that is running but not achieving anything is distinguishable from a watchdog that is genuinely healthy.

SCOPE NOTE (owner decision, 2026-09-11): the human approval gate is being REMOVED by sibling PRD `1007-blog-watchdog-autonomous-publish` — Bilko publishes autonomously, controlled via `.claude/skills/blog-from-git/blog.config.yaml`. This PRD is therefore no longer about alerting a human that a draft awaits review. Its core — a status-aware dead-man's-switch — is valuable in BOTH modes and is what this PRD now delivers. The pending-draft warning survives only as the behavior when the `autonomous_publish` kill switch is set to `false`.

# Acceptance criteria

## Core functionality

- [ ] `scripts/check-blog-watchdog-heartbeat.sh` reads the heartbeat STATUS — everything after the leading ISO-8601 timestamp field — in addition to its age
- [ ] a status starting `error:` prints a CRITICAL line to stderr and exits 1
- [ ] a status starting `warn:` prints a WARNING line to stderr quoting the status text and exits 1
- [ ] a status starting `ok:` keeps today's behavior and exits 0
- [ ] the existing staleness check still runs FIRST and still wins — a heartbeat older than `MAX_AGE_HOURS` is CRITICAL regardless of whether its status text says `ok:`

## Edge cases

- [ ] an empty heartbeat file, or one with no status field after the timestamp, is treated as CRITICAL and exits 1 rather than crashing under `set -u`
- [ ] an unrecognized status prefix (neither `ok:`, `warn:`, nor `error:`) is treated as CRITICAL and exits 1 — fail closed, not open
- [ ] a missing heartbeat file keeps its current CRITICAL/exit-1 behavior unchanged

## Interaction / integration

- [ ] the heartbeat file format stays `<ISO-8601 timestamp> <status text>` with the timestamp as the first space-delimited field, so `cut -d' ' -f1` still yields a parseable date and `scripts/blog-cadence-watchdog.sh` needs no format change
- [ ] `scripts/check-blog-watchdog-heartbeat.sh` accepts a heartbeat path override via env var so tests never touch the real drafts dir, defaulting to the current hardcoded path when unset: `HEARTBEAT_FILE="${BLOG_WATCHDOG_HEARTBEAT_FILE:-.claude/skills/blog-from-git/drafts/.watchdog-heartbeat}"` (note the script starts with `cd "$(dirname "$0")/.."`, so the test must pass an absolute path)
- [ ] this PRD does not change `scripts/blog-cadence-watchdog.sh`'s own logic; it only consumes the statuses that script already writes, plus the richer statuses sibling PRDs 1005/1007/1008 add (`error:` on fetch failure, `ok: published <n> post(s)`, etc.)

## Gated-mode-only behavior

- [ ] `.claude/skills/blog-from-git/blog.config.yaml` gains `pending_draft_alert_days: 2` under the existing `cadence:` block, commented as applying ONLY when `autonomy.autonomous_publish` is `false`
- [ ] when `autonomous_publish` is false and the `EXISTING_DRAFTS` guard fires, `scripts/blog-cadence-watchdog.sh` computes the oldest pending draft's age in whole days from its file mtime (`date -r <file> +%s`), logs the oldest draft's path and age, and calls `write_heartbeat` with a `warn:` status once that age reaches the threshold — below the threshold it still writes `ok:`
- [ ] if sibling PRD 1007 has already landed and removed the gated path entirely, implement only the `ok:`/`warn:`/`error:` checker semantics above and state plainly in the completion report that the gated-mode branch no longer exists — do NOT re-introduce a human gate to satisfy this section

## Tests

- [ ] a new `tests/blog-watchdog-heartbeat.test.ts` spawns `scripts/check-blog-watchdog-heartbeat.sh` (via `node:child_process`, bounded) against fixture heartbeat files written to a temp dir, asserting: exit 0 for a fresh `ok:`, exit 1 for a fresh `warn:`, exit 1 for a fresh `error:`, exit 1 for a stale `ok:`, exit 1 for a malformed file, and exit 1 for an unrecognized prefix
- [ ] `bash -n scripts/check-blog-watchdog-heartbeat.sh` and `bash -n scripts/blog-cadence-watchdog.sh` both pass
- [ ] `timeout 300 pnpm test` passes
- [ ] `timeout 300 pnpm typecheck` passes

# Implementation notes

Read first: `scripts/check-blog-watchdog-heartbeat.sh` (59 lines, static — this is the main file), `scripts/blog-cadence-watchdog.sh` (note `write_heartbeat()` near the top and that EVERY exit path calls it exactly once — preserve that invariant), `.claude/skills/blog-from-git/blog.config.yaml` (its header declares itself THE AUTHORITY for editorial policy — never hard-code a threshold in a script), and `tests/blog-cadence-watchdog.test.ts` (static-text-only by deliberate design per PRD 1002's postmortem: it must never invoke `curl` or `claude -p` — keep that property in any new test too, except for spawning the pure-local heartbeat checker).

Real observed state that motivated this PRD: the heartbeat read `2026-09-10T12:00:02-07:00 ok: 1 unreviewed draft(s) already pending review — skipping` for ten consecutive days while the blog's live publishing gap grew to 15 days, and `blog-watchdog-heartbeat-check.timer` reported green throughout. That exact string is the failure this PRD makes visible.

`set -euo pipefail` is on in both scripts, so any new command substitution that can fail must be guarded (`|| true`) or routed through an explicit failure path. Parse the status with parameter expansion or `cut -d' ' -f2-` rather than an array index, and handle the empty case before dereferencing under `set -u`.

Sibling PRDs in this Epic — do not duplicate their work: 1005 hardens the `/api/blog` curl+jq fetch; 1006 reconciles the cron/systemd schedule docs; 1007 removes the human gate and makes publishing autonomous; 1008 adds post-publish live-pickup verification. This PRD may land before or after 1007; write the checker so it is correct either way.

# Out of scope

- Do NOT re-introduce, strengthen, or work around the human approval gate — the owner has explicitly decided Bilko publishes autonomously, with `.claude/skills/blog-from-git/blog.config.yaml` as the control surface
- Do NOT change `scripts/blog-cadence-watchdog.sh`'s publishing logic, thresholds, guards, or prompt — PRD 1007 owns those
- Do NOT change the `/api/blog` fetch logic — PRD 1005 owns it
- Do NOT change the heartbeat line format — several consumers depend on `<timestamp> <status>`
- Do NOT add a desktop/email/webhook notification channel — heartbeat status plus a non-zero exit is the escalation surface here
- Do NOT edit the crontab or any systemd unit file — those are machine state outside this repo

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).