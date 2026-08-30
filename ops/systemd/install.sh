#!/usr/bin/env bash
# Installs the blog-cadence-watchdog systemd USER units from this repo into
# ~/.config/systemd/user/, then enables+starts the timers. Idempotent: `cp`
# + `systemctl enable` are both safe to re-run and never duplicate a unit or
# clobber an already-enabled timer's state.
#
# Requires `loginctl enable-linger $USER` so the timers fire without an
# active login session (confirmed already set on this machine).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
UNITS=(
  blog-cadence-watchdog.service
  blog-cadence-watchdog.timer
  blog-watchdog-heartbeat-check.service
  blog-watchdog-heartbeat-check.timer
)

mkdir -p "$UNIT_DIR"

for unit in "${UNITS[@]}"; do
  cp "$SCRIPT_DIR/$unit" "$UNIT_DIR/$unit"
  echo "installed $unit"
done

systemctl --user daemon-reload

systemctl --user enable --now blog-cadence-watchdog.timer
systemctl --user enable --now blog-watchdog-heartbeat-check.timer

echo
echo "--- verification ---"
systemctl --user is-enabled blog-cadence-watchdog.timer blog-watchdog-heartbeat-check.timer
systemctl --user list-timers blog-cadence-watchdog.timer blog-watchdog-heartbeat-check.timer --no-pager
