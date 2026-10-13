# Blog watchdog recovery — live validation, 2026-10-12

## 1. Precondition
Main (`/home/bilko/Projects/Bilko`) log contains `82d4030 fix(blog-watchdog): add npm-global to PATH and fail fast on missing binaries` and `ef58d3f feat(blog-watchdog): escalate unhealthy heartbeat to desktop + GitHub issue` (merge `2631da8`). `scripts/blog-watchdog-env.sh` exists (1146 bytes). Service state before the run: `failed` (stale from earlier rc=127 runs).

## 2. Real service run
- `.watchdog.log` offset before: 43316 bytes.
- `systemctl --user start --no-block blog-cadence-watchdog.service` → rc=0.
- Ended after poll iteration 8 (~2 min); `is-active` → `inactive`.
- New log lines:
```
[blog-cadence-watchdog] 2026-10-12 (PT): newest live post=2026-10-07T16:00:00.000Z gap_days=5 target_lower=3 target_upper=4 catchup_trigger=10
[blog-cadence-watchdog] next_slot=2026-10-13T00:07:43.853Z
SCAN_RESULT: Scanned StanislavBG repos since last post (2026-10-07, outdoor-hours): ... (truncated)
[blog-cadence-watchdog] done — daily scan complete, no action
```
- No FATAL. Gate passed (`next_slot=` emitted). No `SEED_RESULT` line: gap 5d is below the catch-up trigger, so no seeding occurred.
- Heartbeat: `2026-10-12T17:09:33-07:00 ok: gap=5d scan complete no publish action` (not `error: cadence gate unavailable`).
- Log also had an unrelated Claude Code permission-rule warning about a wildcard `cp -R` allow rule in `.claude/settings.local.json`.

## 3. Escalation, run for real
Heartbeat file contained `<now> error: missing binary simulated-check`; env: temp heartbeat/alert/retry files, `SYSTEMCTL=/bin/true GH=/bin/false`, real notify-send.
- Exit code: 1
- stderr:
```
[blog-watchdog-heartbeat-check] CRITICAL: blog-cadence-watchdog reported an error — 2026-10-12T17:09:44-07:00 error: missing binary simulated-check
[blog-watchdog-heartbeat-check] ALERT: escalating to a human (Blog watchdog reported: error: missing binary simulated-check)
[blog-watchdog-heartbeat-check] alert channel gh issue list failed
[blog-watchdog-heartbeat-check] alert channel gh issue create failed
[blog-watchdog-heartbeat-check] RETRY: starting blog-cadence-watchdog.service (status: error: missing binary simulated-check)
```
- Alert state file: `first_bad=1791850184` / `last_alert=1791850184` (last_alert present).
- gh failures are the intended `GH=/bin/false`; no real issue created. No "notify-send failed" line was logged, so the desktop channel did not report failure; I cannot see the screen, so the toast being displayed is inferred, not observed.
