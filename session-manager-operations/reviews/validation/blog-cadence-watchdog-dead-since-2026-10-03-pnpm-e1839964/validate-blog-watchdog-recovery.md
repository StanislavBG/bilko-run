# Validation — blog watchdog recovery (2026-10-12)

Base: 71bc8190050c33d83f277b1c99d722f5ec2f29d1. Commits: 82d4030 (path-preflight), ef58d3f (escalation, merge 2631da8), 7846c7a (live-recovery record).
Gates re-run (vitest via main checkout's node_modules, since the job worktree has none): `tests/blog-watchdog-env.test.ts`, `tests/blog-cadence-watchdog.test.ts`, `tests/blog-watchdog-heartbeat.test.ts` → 3 files, 131 tests passed. `bash -n` on all three scripts → ok.

## blog-watchdog-path-preflight — VERIFIED
- Env file exports PATH with `~/.npm-global/bin:~/.local/bin`, array `WATCHDOG_REQUIRED_BINARIES=(awk claude curl flock git jq node npx pnpm timeout)`, `watchdog_missing_binaries`, postmortem header: scripts/blog-watchdog-env.sh:1-27.
- Old `export PATH=...` line removed; env file sourced after `cd`: scripts/blog-cadence-watchdog.sh:83-86 (diff).
- Preflight after `trap on_exit EXIT`, before LOCKFILE; stderr FATAL, `write_heartbeat "error: missing binary ..."`, exit 1: scripts/blog-cadence-watchdog.sh:~327-335.
- Bare-env stub tests (present/absent) and the skipIf real next-slot test: tests/blog-watchdog-env.test.ts (3 tests passed, incl. "runs the cadence gate under a bare PATH").
- tests/blog-cadence-watchdog.test.ts unchanged and passing (108 tests).

## blog-heartbeat-escalate-to-human — VERIFIED
- Pure `should_alert` with stale/malformed → alert, `error: missing binary` → alert, other error/warn → alert after 12h, 24h cooldown, ok → none: scripts/check-blog-watchdog-heartbeat.sh:123-163.
- `send_alert` uses `$NOTIFY_SEND` and `$GH`, searches open issue "Blog watchdog unhealthy in:title", comments or creates (no --label), sources ~/.env.cron, per-channel failure logged, non-zero only if all fail: :165-209.
- `record_unhealthy` writes first_bad, writes last_alert only if send_alert succeeded; main() calls it on every non-ok branch; `rm -f` state on ok; exit codes and `maybe_retry` unchanged: :211-320.
- Tests: should_alert block and end-to-end stubbed run (exit 1, one notify, one `issue create`, second run silent) pass; test output shows ALERT only once per scenario and no real notification.
- docs/blog-watchdog.md section "systemd PATH and human escalation" added; header comment mentions escalation (script :25-29).

## blog-watchdog-live-recovery — VERIFIED
- Live heartbeat `.claude/skills/blog-from-git/drafts/.watchdog-heartbeat` = `2026-10-12T17:09:33-07:00 ok: gap=5d scan complete no publish action` (not `error: cadence gate unavailable`).
- `.watchdog.log` tail: older `FATAL ... rc=127 ... failed to run command 'pnpm'` lines, then post-fix `[blog-cadence-watchdog] next_slot=2026-10-13T00:07:43.853Z` followed by `done — daily scan complete, no action`.
- Record committed at session-manager-operations/reviews/ops/blog-watchdog-recovery-2026-10-12.md: precondition, service run, no SEED_RESULT (gap 5d < catch-up trigger, justified), escalation run (exit 1, last_alert written, GH disabled so no real issue).
- No product-code changes in that PRD's commit.

## Findings
### Critical
- none
### Important
- none
### Minor
- Desktop toast display is inferred, not observed (record says so: no notify-send failure logged; screen not visible). Live-recovery AC "notification actually shown" is only partially evidenced.
- `tests/blog-watchdog-env.test.ts` real-gate test is skipped on machines without `~/.npm-global/bin/pnpm` (by design per PRD).
- `.watchdog.log` contains an unrelated Claude Code permission-rule wildcard warning (`Bash(cp -R ... *)` in .claude/settings.local.json); out of scope.
- Review of the combined diff (self-review; no injection/path-traversal issues: all state paths are env/default constants, variables quoted, gh/notify via env-overridable commands, no secrets written).
