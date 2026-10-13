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
#
# SELF-HEALING: an error:/warn: heartbeat used to only print and exit 1 —
# nobody acted on it, so a Claude-usage-limit failure on 2026-09-29/09-30
# stayed broken until a human noticed. Now this script also kicks off one
# extra watchdog run via `systemctl --user start --no-block
# blog-cadence-watchdog.service`, rate-limited by should_retry() below, and
# still exits 1 so the underlying failure stays visible.
#
# ESCALATION: retrying alone let the watchdog fail 36 times over 9 days
# (2026-10-03..12) with nobody told. should_alert() decides when a human must
# hear about it (unhealthy 12h+, or immediately for a stale heartbeat / missing
# binary; at most once per 24h) and send_alert() fires a desktop notification
# plus a GitHub issue on StanislavBG/bilko-run. State: ALERT_STATE_FILE.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

HEARTBEAT_FILE="${BLOG_WATCHDOG_HEARTBEAT_FILE:-.claude/skills/blog-from-git/drafts/.watchdog-heartbeat}"
RETRY_MARKER_FILE="${BLOG_WATCHDOG_RETRY_MARKER_FILE:-.claude/skills/blog-from-git/drafts/.watchdog-retry}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
# Watchdog runs daily (OnCalendar=daily); 30h gives a generous grace window
# for a slow/late run before flagging staleness.
MAX_AGE_HOURS=30
RETRY_COOLDOWN_SECONDS=$((6 * 3600))
MAX_RETRIES_PER_DAY=3
ALERT_STATE_FILE="${BLOG_WATCHDOG_ALERT_STATE_FILE:-.claude/skills/blog-from-git/drafts/.watchdog-alert}"
NOTIFY_SEND="${NOTIFY_SEND:-notify-send}"
GH="${GH:-gh}"
ALERT_REPO="StanislavBG/bilko-run"
ALERT_AFTER_SECONDS=$((12 * 3600))
ALERT_COOLDOWN_SECONDS=$((24 * 3600))

# should_retry <status> <now_epoch> <marker_contents> <service_active>
# Pure decision, no side effects, so tests can call it directly by sourcing
# this file. <marker_contents> is the retry marker file's contents: one
# retry epoch per line. <service_active> is whatever `systemctl --user
# is-active blog-cadence-watchdog.service` printed ("active" when a run is
# already in flight). Echoes "retry" or "none".
should_retry() {
  local status="$1" now_epoch="$2" marker_contents="$3" service_active="$4"

  case "$status" in
    error:* | warn:*) ;;
    *)
      echo "none"
      return
      ;;
  esac

  if [[ "$service_active" == "active" ]]; then
    echo "none"
    return
  fi

  local today_date
  today_date="$(TZ=America/Los_Angeles date -d "@$now_epoch" +%Y-%m-%d)"

  local last_epoch=0 today_count=0 line line_date
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    if (( line > last_epoch )); then
      last_epoch="$line"
    fi
    line_date="$(TZ=America/Los_Angeles date -d "@$line" +%Y-%m-%d)"
    if [[ "$line_date" == "$today_date" ]]; then
      today_count=$((today_count + 1))
    fi
  done <<<"$marker_contents"

  if (( last_epoch > 0 )) && (( now_epoch - last_epoch < RETRY_COOLDOWN_SECONDS )); then
    echo "none"
    return
  fi

  if (( today_count >= MAX_RETRIES_PER_DAY )); then
    echo "none"
    return
  fi

  echo "retry"
}

# maybe_retry <status> — the side-effecting wrapper around should_retry():
# reads real state (clock, retry marker, systemctl), and when should_retry
# says "retry", starts the watchdog service and appends this retry's epoch
# to the marker file.
maybe_retry() {
  local status="$1" now_epoch service_active marker_contents decision

  now_epoch="$(date +%s)"
  service_active="$("$SYSTEMCTL" --user is-active blog-cadence-watchdog.service 2>/dev/null || true)"
  marker_contents=""
  if [[ -f "$RETRY_MARKER_FILE" ]]; then
    marker_contents="$(cat "$RETRY_MARKER_FILE")"
  fi

  decision="$(should_retry "$status" "$now_epoch" "$marker_contents" "$service_active")"
  if [[ "$decision" == "retry" ]]; then
    echo "[blog-watchdog-heartbeat-check] RETRY: starting blog-cadence-watchdog.service (status: $status)" >&2
    "$SYSTEMCTL" --user start --no-block blog-cadence-watchdog.service
    mkdir -p "$(dirname "$RETRY_MARKER_FILE")"
    printf '%s\n' "$now_epoch" >>"$RETRY_MARKER_FILE"
  else
    echo "[blog-watchdog-heartbeat-check] retry rate-limited, not starting blog-cadence-watchdog.service (status: $status)" >&2
  fi
}

# should_alert <kind> <status> <now_epoch> <state_contents>
# Pure decision, no side effects. <kind> is stale|malformed|status.
# <state_contents> is two lines: first_bad=<epoch> and last_alert=<epoch>
# (either may be absent). Echoes "alert" or "none".
should_alert() {
  local kind="$1" status="$2" now_epoch="$3" state_contents="$4"
  local first_bad=0 last_alert=0 line

  while IFS= read -r line; do
    case "$line" in
      first_bad=*) first_bad="${line#first_bad=}" ;;
      last_alert=*) last_alert="${line#last_alert=}" ;;
    esac
  done <<<"$state_contents"
  [[ "$first_bad" =~ ^[0-9]+$ ]] || first_bad=0
  [[ "$last_alert" =~ ^[0-9]+$ ]] || last_alert=0

  if (( last_alert > 0 )) && (( now_epoch - last_alert < ALERT_COOLDOWN_SECONDS )); then
    echo "none"
    return
  fi

  case "$kind" in
    stale | malformed)
      echo "alert"
      return
      ;;
  esac

  case "$status" in
    "error: missing binary"*)
      echo "alert"
      return
      ;;
    error:* | warn:*)
      if (( first_bad > 0 )) && (( now_epoch - first_bad >= ALERT_AFTER_SECONDS )); then
        echo "alert"
        return
      fi
      ;;
  esac

  echo "none"
}

# send_alert <summary> [heartbeat_line] — notify-send plus a GitHub issue
# (comment on the open one if it exists). Each channel failing is logged and
# non-fatal; returns non-zero only when every channel failed.
send_alert() {
  local summary="$1" heartbeat_line="${2:-}" ok=0 issue_number title body

  if [[ -f "$HOME/.env.cron" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$HOME/.env.cron"
    set +a
  fi

  if "$NOTIFY_SEND" --urgency=critical 'Bilko blog watchdog' "$summary"; then
    ok=1
  else
    echo "[blog-watchdog-heartbeat-check] alert channel notify-send failed" >&2
  fi

  if command -v "$GH" >/dev/null 2>&1; then
    body="$summary"$'\n\n'"Heartbeat: ${heartbeat_line:-n/a}"
    issue_number=""
    if ! issue_number="$("$GH" issue list --repo "$ALERT_REPO" --state open --search 'Blog watchdog unhealthy in:title' --json number --jq '.[0].number')"; then
      echo "[blog-watchdog-heartbeat-check] alert channel gh issue list failed" >&2
      issue_number=""
    fi
    if [[ -n "$issue_number" && "$issue_number" != "null" ]]; then
      if "$GH" issue comment "$issue_number" --repo "$ALERT_REPO" --body "$body"; then
        ok=1
      else
        echo "[blog-watchdog-heartbeat-check] alert channel gh issue comment failed" >&2
      fi
    else
      title="Blog watchdog unhealthy — $(TZ=America/Los_Angeles date +%Y-%m-%d)"
      if "$GH" issue create --repo "$ALERT_REPO" --title "$title" --body "$body"; then
        ok=1
      else
        echo "[blog-watchdog-heartbeat-check] alert channel gh issue create failed" >&2
      fi
    fi
  else
    echo "[blog-watchdog-heartbeat-check] alert channel gh unavailable ($GH not on PATH)" >&2
  fi

  (( ok == 1 ))
}

# record_unhealthy <kind> <status> <summary> — maintains the alert state file
# (first_bad / last_alert) and escalates via send_alert when should_alert says so.
record_unhealthy() {
  local kind="$1" status="$2" summary="$3" now_epoch state_contents first_bad last_alert decision

  now_epoch="$(date +%s)"
  state_contents=""
  if [[ -f "$ALERT_STATE_FILE" ]]; then
    state_contents="$(cat "$ALERT_STATE_FILE")"
  fi
  first_bad="$(grep -m1 '^first_bad=' <<<"$state_contents" || true)"
  last_alert="$(grep -m1 '^last_alert=' <<<"$state_contents" || true)"
  if [[ -z "$first_bad" ]]; then
    first_bad="first_bad=$now_epoch"
  fi
  state_contents="$first_bad"
  [[ -n "$last_alert" ]] && state_contents+=$'\n'"$last_alert"
  mkdir -p "$(dirname "$ALERT_STATE_FILE")"
  printf '%s\n' "$state_contents" >"$ALERT_STATE_FILE"

  decision="$(should_alert "$kind" "$status" "$now_epoch" "$state_contents")"
  if [[ "$decision" == "alert" ]]; then
    echo "[blog-watchdog-heartbeat-check] ALERT: escalating to a human ($summary)" >&2
    if send_alert "$summary" "${HEARTBEAT_LINE:-}"; then
      printf '%s\nlast_alert=%s\n' "$first_bad" "$now_epoch" >"$ALERT_STATE_FILE"
    else
      echo "[blog-watchdog-heartbeat-check] ALERT: every channel failed; will retry next run" >&2
    fi
  fi
}

main() {
  if [[ ! -f "$HEARTBEAT_FILE" ]]; then
    echo "[blog-watchdog-heartbeat-check] CRITICAL: no heartbeat file at $HEARTBEAT_FILE — blog-cadence-watchdog.sh has never run" >&2
    record_unhealthy malformed "" "Blog watchdog heartbeat file missing at $HEARTBEAT_FILE"
    exit 1
  fi

  local heartbeat_line heartbeat_ts heartbeat_epoch now_epoch age_hours status
  heartbeat_line="$(cat "$HEARTBEAT_FILE")"
  HEARTBEAT_LINE="$heartbeat_line"
  heartbeat_ts="$(cut -d' ' -f1 <<<"$heartbeat_line")"

  if [[ -z "$heartbeat_ts" ]]; then
    echo "[blog-watchdog-heartbeat-check] CRITICAL: heartbeat file at $HEARTBEAT_FILE is empty or malformed" >&2
    record_unhealthy malformed "" "Blog watchdog heartbeat file is empty or malformed"
    exit 1
  fi

  if ! heartbeat_epoch="$(date -d "$heartbeat_ts" +%s 2>/dev/null)"; then
    echo "[blog-watchdog-heartbeat-check] CRITICAL: heartbeat timestamp '$heartbeat_ts' is not a valid date — heartbeat file: $heartbeat_line" >&2
    record_unhealthy malformed "" "Blog watchdog heartbeat timestamp is invalid"
    exit 1
  fi
  now_epoch="$(date +%s)"
  age_hours=$(( (now_epoch - heartbeat_epoch) / 3600 ))

  # Staleness wins regardless of what the status text says — a heartbeat that
  # stopped updating 40 hours ago is CRITICAL even if its last-written status
  # was "ok:". No retry here: a dead watchdog is the thing blog-cadence-
  # watchdog.timer itself needs to be re-enabled for, not a retry-able blip.
  if (( age_hours > MAX_AGE_HOURS )); then
    echo "[blog-watchdog-heartbeat-check] CRITICAL: blog-cadence-watchdog heartbeat is ${age_hours}h old (max ${MAX_AGE_HOURS}h) — last: $heartbeat_line — the watchdog itself appears dead" >&2
    record_unhealthy stale "" "Blog watchdog heartbeat is ${age_hours}h old (max ${MAX_AGE_HOURS}h); the watchdog appears dead"
    exit 1
  fi

  if [[ "$heartbeat_line" != *" "* ]]; then
    echo "[blog-watchdog-heartbeat-check] CRITICAL: heartbeat has no status field after the timestamp — $heartbeat_line" >&2
    record_unhealthy malformed "" "Blog watchdog heartbeat has no status field"
    exit 1
  fi

  status="${heartbeat_line#* }"
  if [[ -z "$status" ]]; then
    echo "[blog-watchdog-heartbeat-check] CRITICAL: heartbeat has no status field after the timestamp — $heartbeat_line" >&2
    record_unhealthy malformed "" "Blog watchdog heartbeat has no status field"
    exit 1
  fi

  case "$status" in
    error:*)
      echo "[blog-watchdog-heartbeat-check] CRITICAL: blog-cadence-watchdog reported an error — $heartbeat_line" >&2
      record_unhealthy status "$status" "Blog watchdog reported: $status"
      maybe_retry "$status"
      exit 1
      ;;
    warn:*)
      echo "[blog-watchdog-heartbeat-check] WARNING: blog-cadence-watchdog reported a warning — \"$status\"" >&2
      record_unhealthy status "$status" "Blog watchdog reported: $status"
      maybe_retry "$status"
      exit 1
      ;;
    ok:*)
      rm -f "$ALERT_STATE_FILE"
      echo "[blog-watchdog-heartbeat-check] OK: heartbeat ${age_hours}h old — $heartbeat_line"
      ;;
    *)
      # fail closed — an unrecognized status could be a future status this
      # checker doesn't know how to interpret as healthy yet
      echo "[blog-watchdog-heartbeat-check] CRITICAL: unrecognized heartbeat status — $heartbeat_line" >&2
      record_unhealthy status "$status" "Blog watchdog heartbeat status unrecognized: $status"
      exit 1
      ;;
  esac
}

# Allow tests to `source` this file for should_retry() without running the
# file-reading main logic above.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
