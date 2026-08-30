#!/usr/bin/env bash
# Independent dead-man's-switch for blog-cadence-watchdog.sh: checks that the
# watchdog itself is still alive by reading the heartbeat it writes on EVERY
# run (see write_heartbeat() in blog-cadence-watchdog.sh). A stale heartbeat
# means the watchdog is dead/uninstalled/disabled, NOT that the blog is
# within cadence — that distinction is the entire point of this script.
#
# Run on its own systemd timer (blog-watchdog-heartbeat-check.timer), deliberately
# separate from the watchdog's own timer, so a bug that kills the watchdog
# can't also silence the thing that's supposed to notice.
set -euo pipefail
cd "$(dirname "$0")/.."

HEARTBEAT_FILE=".claude/skills/blog-from-git/drafts/.watchdog-heartbeat"
# Watchdog runs daily (OnCalendar=daily); 30h gives a generous grace window
# for a slow/late run before flagging staleness.
MAX_AGE_HOURS=30

if [[ ! -f "$HEARTBEAT_FILE" ]]; then
  echo "[blog-watchdog-heartbeat-check] CRITICAL: no heartbeat file at $HEARTBEAT_FILE — blog-cadence-watchdog.sh has never run" >&2
  exit 1
fi

HEARTBEAT_TS="$(cut -d' ' -f1 "$HEARTBEAT_FILE")"
HEARTBEAT_EPOCH="$(date -d "$HEARTBEAT_TS" +%s)"
NOW_EPOCH="$(date +%s)"
AGE_HOURS=$(( (NOW_EPOCH - HEARTBEAT_EPOCH) / 3600 ))

if (( AGE_HOURS > MAX_AGE_HOURS )); then
  echo "[blog-watchdog-heartbeat-check] CRITICAL: blog-cadence-watchdog heartbeat is ${AGE_HOURS}h old (max ${MAX_AGE_HOURS}h) — last: $(cat "$HEARTBEAT_FILE") — the watchdog itself appears dead" >&2
  exit 1
fi

echo "[blog-watchdog-heartbeat-check] OK: heartbeat ${AGE_HOURS}h old — $(cat "$HEARTBEAT_FILE")"
