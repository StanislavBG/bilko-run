---
title: Blog watchdog: survive boot-time network races on the /api/blog fetch
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-09-11T17:47:00.141Z
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: bug
agentType: dev-lead
---
# Goal

The 2026-09-11 00:02 PT run of scripts/blog-cadence-watchdog.sh, fired by blog-cadence-watchdog.timer shortly after boot, died with `jq: error (at <stdin>:1): Cannot index number with string "published_at"` and exit 5 (`status=5/NOTINSTALLED` in journalctl). The `curl -s --max-time 20 https://bilko.run/api/blog` ran before the network was ready and returned a body that was not the expected JSON array, so the very next `jq -r '[.[].published_at] | max'` aborted the script under `set -euo pipefail` — BEFORE the script's own friendly `FATAL: could not read published_at` branch and, critically, before write_heartbeat. The dead-man's-switch therefore saw no new heartbeat at all rather than a recorded error. Make the fetch retry through a boot-time network race, validate the response shape before indexing it, and guarantee a heartbeat is written on every exit path including an unexpected abort.

# Acceptance criteria

- [ ] Core: the single `BLOG_JSON="$(curl ...)"` line in scripts/blog-cadence-watchdog.sh is replaced by a retry loop of 3 attempts with a backoff sleep (e.g. 10s) between attempts, each attempt keeping `curl -s --max-time 20`
- [ ] Core: before any jq field access, the response is validated with `jq -e 'type == "array" and length > 0'` (exit status checked, not crashed on) — a body that is not a non-empty JSON array counts as a failed attempt and triggers the next retry
- [ ] Core: after all retries are exhausted the script takes its EXISTING FATAL branch — prints the `could not read published_at` style message to stderr, calls write_heartbeat with an `error:` status naming the fetch failure, and exits 1 — rather than aborting mid-pipeline under set -e
- [ ] Core: an `trap` on EXIT (or equivalent guard) guarantees write_heartbeat runs with an `error:` status if the script exits non-zero without having already written a heartbeat, so no future `set -e` abort can leave the heartbeat silently stale; a run that already wrote a heartbeat must NOT have it overwritten by the trap
- [ ] Edge cases: curl exiting non-zero (DNS failure, connection refused, --max-time timeout) is handled identically to a bad body — retried, then FATAL with a heartbeat, never an unguarded abort
- [ ] Edge cases: a body of `0`, `null`, `[]`, an HTML error page, or a JSON object (not array) each fail the shape gate; reproduce the original failure by asserting the `0` case specifically, since that is what produced `Cannot index number with string`
- [ ] Edge cases: retries do not multiply the overall runtime unreasonably — worst case fetch phase stays under ~90s so the run still fits comfortably inside the systemd/cron window
- [ ] Interaction / integration: the retry+validate block sits before the GAP_DAYS computation and leaves the downstream logic (GAP_DAYS, UPPER_BOUND comparison, STATE_FILE, EXISTING_DRAFTS guard, claude -p invocation) untouched
- [ ] Interaction / integration: write_heartbeat is still called exactly once per run on every path, and the heartbeat line format stays `<ISO-8601 timestamp> <status text>` so scripts/check-blog-watchdog-heartbeat.sh keeps parsing it
- [ ] Tests: tests/blog-cadence-watchdog.test.ts gains static-text assertions that the fetch is retried, that a `jq -e 'type == "array"'`-style shape gate exists textually before the first `.published_at` access, and that an EXIT trap guaranteeing a heartbeat is present
- [ ] Tests: a new test (or a new case in the heartbeat suite) exercises the shape gate itself as a real bounded subprocess — pipe the bodies `0`, `null`, `[]`, `{}` and a valid array into the same `jq -e` expression the script uses and assert the exit statuses — so the gate is verified behaviorally, not only by text match
- [ ] Tests: `bash -n scripts/blog-cadence-watchdog.sh` passes
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

Read scripts/blog-cadence-watchdog.sh in full first. The relevant block today is:

    BLOG_JSON="$(curl -s --max-time 20 https://bilko.run/api/blog)"
    NEWEST_PUBLISHED_AT="$(echo "$BLOG_JSON" | jq -r '[.[].published_at] | max')"
    if [[ -z "$NEWEST_PUBLISHED_AT" || "$NEWEST_PUBLISHED_AT" == "null" ]]; then
      echo "[blog-cadence-watchdog] FATAL: could not read published_at from https://bilko.run/api/blog" >&2
      write_heartbeat "error: could not read published_at from /api/blog"
      exit 1
    fi

That `if` guard was written to catch exactly this failure but can never fire, because the `jq` on the line above it aborts the script first under `set -euo pipefail`. The fix is to make the jq call non-fatal (check its status explicitly) and to gate on the body's TYPE before indexing it. Keep the existing FATAL message and heartbeat string so no log/alert consumer has to change.

The trap must not double-write: set a flag inside write_heartbeat (e.g. `HEARTBEAT_WRITTEN=1`) and have the EXIT trap check it before writing a fallback `error: unexpected exit (rc=$?)` heartbeat. Note `set -u` is on — initialize the flag before the trap is installed.

Verified real failure evidence to reproduce against: `journalctl --user -u blog-cadence-watchdog.service` shows `Sep 11 00:02:33 ... Main process exited, code=exited, status=5/NOTINSTALLED`, and `.claude/skills/blog-from-git/drafts/.watchdog.log` ends with the bare `jq: error (at <stdin>:1): Cannot index number with string "published_at"` line with no `[blog-cadence-watchdog]` prefix and no heartbeat update — the heartbeat still reads 2026-09-10T12:00:02-07:00.

The systemd unit (~/.config/systemd/user/blog-cadence-watchdog.service) already declares `After=network-online.target` / `Wants=network-online.target`, but user units do not reliably get a real network-online gate; fix this in the script with retries rather than by editing the unit — unit files live outside this repo and are not version-controlled here.

Follow the same conventions the rest of the script uses: bounded commands, stdout log lines prefixed `[blog-cadence-watchdog]`, stderr for failures.

# Out of scope

- Do NOT edit ~/.config/systemd/user/blog-cadence-watchdog.{service,timer} in this PRD — the schedule/unit reconciliation is a separate queued PRD, and unit files are not tracked in this repo
- Do NOT add caching or a local fallback copy of /api/blog — a failed fetch must fail loudly with a heartbeat, not proceed on stale data
- Do NOT change the cadence thresholds, the drafts guard, or the claude -p prompt
- Do NOT let any test make a real network call to bilko.run — the existing suite is deliberately offline/static

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
