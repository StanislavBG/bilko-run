---
title: Blog heartbeat checker: escalate a persistent or unfixable watchdog failure to a human
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-13T00:04:20.191Z
sourcePromptId: blog-cadence-watchdog-dead-since-2026-10-03-pnpm-e1839964
agentType: dev-lead
disposition: new-head
planId: pl-mv5x54rj-d2f154
---
# Goal

behavior. scripts/check-blog-watchdog-heartbeat.sh (the dead-man's switch, run every ~6h by blog-watchdog-heartbeat-check.timer) detected the watchdog failing 36 times from 2026-10-03 to 2026-10-12 but only re-started the same failing service and exited 1, so nobody found out for 9 days. Add escalation: a pure should_alert decision plus a side-effecting send_alert that fires a desktop notification and opens (or comments on) one GitHub issue on StanislavBG/bilko-run when the heartbeat has been unhealthy for 12h+, immediately when it is stale or reports a missing binary, rate-limited to once per 24h and reset when health returns. Retry behavior stays as is.

# Acceptance criteria

- [ ] scripts/check-blog-watchdog-heartbeat.sh defines a pure function `should_alert <kind> <status> <now_epoch> <state_contents>` (kind is `stale`, `malformed` or `status`) that echoes exactly one line: `alert` or `none`. Rules: kind stale or malformed -> alert; status starting `error: missing binary` -> alert; any other error:/warn: status -> alert only when first_bad_epoch in state is >= 12h before now; ok: -> none. Regardless of the above, return none if last_alert_epoch in state is < 24h before now. State format is two lines `first_bad=<epoch>` and `last_alert=<epoch>` (either may be absent; empty state = never bad, never alerted).
- [ ] main() keeps a state file at ${BLOG_WATCHDOG_ALERT_STATE_FILE:-.claude/skills/blog-from-git/drafts/.watchdog-alert}: on ok: it deletes the file; on any non-ok outcome (stale, malformed, missing file, error:, warn:, unrecognized) it records first_bad=<now> if absent, calls should_alert, and on `alert` calls send_alert and writes last_alert=<now> ONLY if send_alert succeeded on at least one channel. Existing exit codes and the existing maybe_retry calls are unchanged.
- [ ] send_alert <summary> runs "${NOTIFY_SEND:-notify-send}" --urgency=critical 'Bilko blog watchdog' <summary> and, when "${GH:-gh}" is on PATH, looks for an open issue on StanislavBG/bilko-run whose title starts with `Blog watchdog unhealthy` (`issue list --state open --search 'Blog watchdog unhealthy in:title' --json number --jq '.[0].number'`); if one exists it adds a comment with the summary and heartbeat line, else it creates an issue titled `Blog watchdog unhealthy — <YYYY-MM-DD PT>` (no --label). It sources $HOME/.env.cron if present (same as scripts/sanity-qa-cron.sh) for GITHUB_TOKEN. Each channel's failure is logged to stderr and does not abort the script; send_alert returns non-zero only if every channel failed.
- [ ] tests/blog-watchdog-heartbeat.test.ts adds a `should_alert` describe block (sourcing the script like the existing should_retry block) covering: stale -> alert; `error: missing binary pnpm` with empty state -> alert; `error: cadence gate unavailable` with first_bad 1h ago -> none and 13h ago -> alert; any kind with last_alert 2h ago -> none; ok: -> none.
- [ ] tests/blog-watchdog-heartbeat.test.ts adds an end-to-end test that runs the checker against a fresh `error: missing binary pnpm` heartbeat with SYSTEMCTL, NOTIFY_SEND and GH pointed at stub scripts in the tmp dir that append their argv to a log file, and BLOG_WATCHDOG_ALERT_STATE_FILE in the tmp dir; asserts exit 1, the notify stub was called once, the GH stub received an `issue create` call, and a second immediate run does NOT call either stub again (24h rate limit). Existing runChecker env must also point NOTIFY_SEND/GH/BLOG_WATCHDOG_ALERT_STATE_FILE at tmp stubs so no test ever sends a real notification or creates a real issue.
- [ ] docs/blog-watchdog.md gains a short section describing: the systemd PATH requirement (pnpm in ~/.npm-global/bin, claude in ~/.local/bin, set in scripts/blog-watchdog-env.sh, `error: missing binary` heartbeat), and the escalation rules + channels + state file above. The heartbeat checker's header comment is updated to mention escalation.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/check-blog-watchdog-heartbeat.sh
- tests/blog-watchdog-heartbeat.test.ts
- docs/blog-watchdog.md

# Implementation notes

Read first: scripts/check-blog-watchdog-heartbeat.sh (whole file, ~180 lines: should_retry, maybe_retry, main, source guard); tests/blog-watchdog-heartbeat.test.ts (whole file, ~185 lines: runChecker env injection, should_retry sourcing pattern at ~line 126-150); scripts/sanity-qa-cron.sh lines 56-70 (gh issue create precedent); docs/blog-watchdog.md lines 15-30.

Steps:
1. In scripts/check-blog-watchdog-heartbeat.sh add ALERT_STATE_FILE, ALERT_AFTER_SECONDS=$((12*3600)), ALERT_COOLDOWN_SECONDS=$((24*3600)), should_alert (pure, no I/O, like should_retry), send_alert, and a small `record_unhealthy <kind> <status> <summary>` helper that main() calls on every non-ok exit path before `exit 1` (the missing-file, empty, malformed-timestamp, stale, no-status, error:, warn:, unrecognized branches). Missing/empty/malformed map to kind malformed; stale to kind stale; error:/warn:/unrecognized to kind status. On ok: `rm -f` the state file.
2. All side effects must go through $SYSTEMCTL, $NOTIFY_SEND, $GH so tests can stub them. Keep `set -euo pipefail` safe: wrap each channel call in `if ! ...; then echo ... >&2; fi`.
3. notify-send under the systemd user manager reaches the desktop session bus; if it fails, gh still runs. gh is authenticated via keyring on this machine; ~/.env.cron supplies GITHUB_TOKEN as a fallback.
4. Extend tests as in the criteria; never let any test reach real gh, notify-send, or systemctl.
5. Update docs/blog-watchdog.md.

Status-string contract with the sibling PRD blog-watchdog-path-preflight: the watchdog writes heartbeats of the form `<ISO ts> error: missing binary <space-separated names>`. This PRD only matches the `error: missing binary` prefix; it does not need that PRD's code.

Do not touch: scripts/blog-cadence-watchdog.sh, scripts/blog-watchdog-env.sh, tests/blog-watchdog-env.test.ts (sibling PRD owns them).

# Out of scope

- Changing retry cadence (should_retry) or the timer schedule
- Adding new notification services (email, push APIs) beyond notify-send and gh
- Editing systemd unit files

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-watchdog-heartbeat.test.ts
timeout 60 bash -n scripts/check-blog-watchdog-heartbeat.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
