#!/usr/bin/env bash
# Independent dead-man's-switch for blog-cadence-watchdog.sh: checks that the
# watchdog itself is still alive AND actually achieving something by reading
# both the AGE and the STATUS of the heartbeat it writes on EVERY run (see
# write_heartbeat() in blog-cadence-watchdog.sh).
#
# A stale heartbeat means the watchdog is dead/uninstalled/disabled. A fresh
# heartbeat whose status is `error:` or `warn:` means the watchdog is running
# but NOT achieving anything — e.g. it refreshed daily for 10 days straight
# with "ok: 1 unreviewed draft(s) already pending review — skipping" while the
# blog's live publishing gap grew to 15 days. Distinguishing "running" from
# "healthy" is the entire point of this script.
#
# Run on its own systemd timer (blog-watchdog-heartbeat-check.timer), deliberately
# separate from the watchdog's own timer, so a bug that kills the watchdog
# can't also silence the thing that's supposed to notice.
set -euo pipefail
cd "$(dirname "$0")/.."

HEARTBEAT_FILE="${BLOG_WATCHDOG_HEARTBEAT_FILE:-.claude/skills/blog-from-git/drafts/.watchdog-heartbeat}"
# Watchdog runs daily (OnCalendar=daily); 30h gives a generous grace window
# for a slow/late run before flagging staleness.
MAX_AGE_HOURS=30

if [[ ! -f "$HEARTBEAT_FILE" ]]; then
  echo "[blog-watchdog-heartbeat-check] CRITICAL: no heartbeat file at $HEARTBEAT_FILE — blog-cadence-watchdog.sh has never run" >&2
  exit 1
fi

HEARTBEAT_LINE="$(cat "$HEARTBEAT_FILE")"
HEARTBEAT_TS="$(cut -d' ' -f1 <<<"$HEARTBEAT_LINE")"

if [[ -z "$HEARTBEAT_TS" ]]; then
  echo "[blog-watchdog-heartbeat-check] CRITICAL: heartbeat file at $HEARTBEAT_FILE is empty or malformed" >&2
  exit 1
fi

if ! HEARTBEAT_EPOCH="$(date -d "$HEARTBEAT_TS" +%s 2>/dev/null)"; then
  echo "[blog-watchdog-heartbeat-check] CRITICAL: heartbeat timestamp '$HEARTBEAT_TS' is not a valid date — heartbeat file: $HEARTBEAT_LINE" >&2
  exit 1
fi
NOW_EPOCH="$(date +%s)"
AGE_HOURS=$(( (NOW_EPOCH - HEARTBEAT_EPOCH) / 3600 ))

# Staleness wins regardless of what the status text says — a heartbeat that
# stopped updating 40 hours ago is CRITICAL even if its last-written status
# was "ok:".
if (( AGE_HOURS > MAX_AGE_HOURS )); then
  echo "[blog-watchdog-heartbeat-check] CRITICAL: blog-cadence-watchdog heartbeat is ${AGE_HOURS}h old (max ${MAX_AGE_HOURS}h) — last: $HEARTBEAT_LINE — the watchdog itself appears dead" >&2
  exit 1
fi

if [[ "$HEARTBEAT_LINE" != *" "* ]]; then
  echo "[blog-watchdog-heartbeat-check] CRITICAL: heartbeat has no status field after the timestamp — $HEARTBEAT_LINE" >&2
  exit 1
fi

STATUS="${HEARTBEAT_LINE#* }"
if [[ -z "$STATUS" ]]; then
  echo "[blog-watchdog-heartbeat-check] CRITICAL: heartbeat has no status field after the timestamp — $HEARTBEAT_LINE" >&2
  exit 1
fi

case "$STATUS" in
  error:*)
    echo "[blog-watchdog-heartbeat-check] CRITICAL: blog-cadence-watchdog reported an error — $HEARTBEAT_LINE" >&2
    exit 1
    ;;
  warn:*)
    echo "[blog-watchdog-heartbeat-check] WARNING: blog-cadence-watchdog reported a warning — \"$STATUS\"" >&2
    exit 1
    ;;
  ok:*)
    echo "[blog-watchdog-heartbeat-check] OK: heartbeat ${AGE_HOURS}h old — $HEARTBEAT_LINE"
    ;;
  *)
    # fail closed — an unrecognized status could be a future status this
    # checker doesn't know how to interpret as healthy yet
    echo "[blog-watchdog-heartbeat-check] CRITICAL: unrecognized heartbeat status — $HEARTBEAT_LINE" >&2
    exit 1
    ;;
esac
