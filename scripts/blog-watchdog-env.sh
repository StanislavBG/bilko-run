#!/usr/bin/env bash
# Sourced by blog-cadence-watchdog.sh — do not execute, and do not `set -e` here.
#
# Postmortem (2026-10-03 to 2026-10-12): the watchdog failed every scheduled run
# with rc=127. systemd's user-unit PATH is
# /home/bilko/.local/bin:/usr/local/sbin:...:/bin:... and has no
# /home/bilko/.npm-global/bin, so `timeout 180 pnpm tsx scripts/blog-cadence-gate.ts
# next-slot` exited 127 ("command not found"). The heartbeat only said
# "error: cadence gate unavailable", which hid the cause for nine days.
# Fix: put the npm-global and local bin dirs on PATH here, and preflight every
# required binary so a missing one fails fast with a distinct heartbeat.

export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"

WATCHDOG_REQUIRED_BINARIES=(awk claude curl flock git jq node npx pnpm timeout)

# Echoes the space-separated names of required binaries not resolvable via
# `command -v`. Empty output means everything resolves.
watchdog_missing_binaries() {
  local bin missing=()
  for bin in "${WATCHDOG_REQUIRED_BINARIES[@]}"; do
    command -v "$bin" >/dev/null 2>&1 || missing+=("$bin")
  done
  echo "${missing[*]:-}"
}
