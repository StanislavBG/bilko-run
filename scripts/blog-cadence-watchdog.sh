#!/usr/bin/env bash
# Daily watchdog for the bilko.run blog's declared 3-4 day cadence
# (.claude/skills/blog-from-git/blog.config.yaml cadence.target_gap_days).
# Nothing else enforces that cadence — before this script existed a
# publishing gap could grow indefinitely and silently (see PRD: gap reached
# 36 days on 2026-08-29, then 15 days again on 2026-09-11 because the
# original version of this script hard-stopped at a human approval gate).
#
# SCAN vs PUBLISH: scanning (phases 1-2 of blog-from-git) runs every day,
# unconditionally (cadence.scan_every_days). Publishing is gated on the LOWER
# bound of cadence.target_gap_days (3) — a post is "due" once the live gap
# reaches 3 days, not 4. The upper bound (4) stays reserved for the
# over-cadence/stall heartbeat classification. A due post's subject is also
# gated by rotation.project_cooldown_posts: a project covered in any of the
# last 3 ledger rows is ineligible, per blog-ledger.md's recorded rows.
#
# HARD MINIMUM GAP (code-enforced, no override): the live-gap check above
# reads /api/blog, which is BLIND to a post that is seeded but scheduled for
# the future — a future published_at never shows up in that endpoint's
# result set. That blind spot let this script compute a live gap that still
# read "due" on the same day a previously-rescheduled post was about to go
# live, and publish a second post that day (see PRD: 2026-10-07 00:00 PDT
# collision with the rescheduled OutdoorHours post). scripts/blog-cadence-
# gate.ts next-slot reads the actual seeded rows (not /api/blog) and returns
# the true next-allowed-slot; this script checks it on every run, BEFORE the
# existing live-gap PUBLISH_DUE decision gets to invoke anything, and fails
# CLOSED (scan-only, no publish) if the gate is unavailable.
#
# TRIGGER — this script runs from exactly ONE scheduler on this machine
# (full detail and log contents: docs/blog-watchdog.md): the systemd user
# timer `blog-cadence-watchdog.timer` (OnCalendar=daily, Persistent=true,
# fires ~00:00-00:15 PT) — Persistent=true replays a run missed while the
# machine was off/asleep. Its service appends to
# .claude/skills/blog-from-git/drafts/.watchdog.log. A previously-installed
# crontab entry was removed 2026-10-03 at the owner's request; do not re-add
# a crontab trigger for this script — one trigger only.
# This timer is LOCAL to this machine only and only fires while it is
# powered on. The /tmp/bilko.blog-cadence-watchdog.lock flock below still
# serializes any concurrent runs (e.g. a manual rerun overlapping the timer),
# and the same-day .watchdog-state check makes a second run on one day
# idempotent.
#
# AUTONOMOUS FLOW — Bilko is an autonomous agent, not a human-supervised
# publishing workflow. There is exactly ONE implementation of drafting and
# seeding (until Burrow's blog_publish cutover): scripts/blog-draft.sh (the
# pinned `claude -p` phases 1-5d drafter, writes a bundle into a temp dir) and
# scripts/blog-seed.sh (deterministic seed + cadence gate + one commit + push
# to origin main + live-pickup poll). This script only decides WHEN to run
# them and maps their exit codes to the heartbeat. How far it runs is
# controlled by .claude/skills/blog-from-git/blog.config.yaml's
# `autonomy.autonomous_publish` — the OWNER'S CONTROL SURFACE and master kill
# switch:
#   - autonomous_publish: true  (default) — blog-draft.sh --out <tmp> --slot
#     <NEXT_SLOT>, then blog-seed.sh --bundle <tmp>. Pending drafts/*.md files
#     are converted to bundles and seeded instead (up to max_posts_per_run).
#   - autonomous_publish: false — blog-draft.sh runs, but the bundle's post.md
#     is copied to .claude/skills/blog-from-git/drafts/ for human review and
#     nothing is ever seeded. Seeding stays manual.
# Exit mapping (draft): skipped -> heartbeat ok/warn by gap, error -> error.
# Exit mapping (seed): 0 -> ok + same-day lock kept; 3 (cadence gate refused,
# nothing committed) -> hold heartbeat, lock cleared; anything else -> error
# heartbeat naming the script and rc, lock cleared.
# Tests only: BLOG_DRAFT_CMD / BLOG_SEED_CMD replace the two entrypoints.
#
# Mirrors the cron-script conventions in
# ~/Projects/social-signals-trader/scripts/analyst-tick.sh: lockfile in
# /tmp, PATH fix for cron's bare env, bounded timeout, log via cron redirect.
#
# POST-PUBLISH VERIFICATION — blog-seed.sh itself polls /api/blog until the
# slug is live (exit 5 if it never shows up); this script only records that
# outcome in the heartbeat, and re-runs the DAG pipeline check as a report-only
# audit. WORST-CASE RUNTIME: blog-draft.sh (2400s) + blog-seed.sh (<=1440s).
set -euo pipefail
cd "$(dirname "$0")/.."

# cron/systemd run with a bare PATH; the env file adds ~/.npm-global/bin and
# ~/.local/bin and defines the watchdog_missing_binaries preflight.
# shellcheck source=scripts/blog-watchdog-env.sh
source "scripts/blog-watchdog-env.sh"
# shellcheck source=scripts/blog-pipeline-lib.sh
source "scripts/blog-pipeline-lib.sh"

CONFIG_FILE=".claude/skills/blog-from-git/blog.config.yaml"
DRAFTS_DIR=".claude/skills/blog-from-git/drafts"
STATE_FILE="$DRAFTS_DIR/.watchdog-state"
HEARTBEAT_FILE="$DRAFTS_DIR/.watchdog-heartbeat"

# Written on EVERY exit path, including lock contention and "within cadence,
# no action" — so a stale heartbeat means the watchdog itself is dead, not
# "nothing to do" or "a normal overlapping run got skipped". See
# check-blog-watchdog-heartbeat.sh, the independent dead-man's-switch that
# reads this file.
HEARTBEAT_WRITTEN=0
write_heartbeat() {
  mkdir -p "$DRAFTS_DIR"
  echo "$(TZ=America/Los_Angeles date -Iseconds) $1" > "$HEARTBEAT_FILE"
  HEARTBEAT_WRITTEN=1
}

# Pure decision, single source of truth for "was this a healthy quiet day or
# a stall that should escalate": the ORIGINAL stall bug was ten straight days
# of "ok: ... skipping" while the publishing gap grew unbounded; a later
# incarnation was "ok: noop ..." for a rotation-blocked draft (see PRD). A
# run that seeds nothing while already over cadence is a stall (warn); within
# cadence, "nothing to publish" is just an ordinary quiet day (ok); actually
# seeding something is always ok regardless of gap.
heartbeat_status_for_outcome() {
  local gap_days="$1" upper_bound="$2" seeded="$3"
  if [[ "$seeded" -eq 1 ]]; then
    echo "ok"
    return
  fi
  if (( gap_days >= upper_bound )); then
    echo "warn"
  else
    echo "ok"
  fi
}

# Pure decision: is a post due for PUBLISHING? Gated on the LOWER bound of
# cadence.target_gap_days ([3, 5] -> 3), never the upper bound — the upper
# bound stays reserved for heartbeat_status_for_outcome's stall
# classification above. Scanning (phases 1-2) always happens regardless of
# this result; only phases 6-7 (Approve, Seed) are gated on it.
publish_due_status() {
  local gap_days="$1" lower_bound="$2"
  if (( gap_days >= lower_bound )); then
    echo "due"
  else
    echo "not_due"
  fi
}

# Pure decision: does this run's blog-seed.sh exit code justify KEEPING the
# same-day "ran today" lock ($STATE_FILE)? The lock's only job is to stop a
# second PUBLISH on a day that already published one — so it is kept ONLY when
# blog-seed.sh returned 0. A cadence hold (3), skip, or any failure clears it,
# so a same-day retry can still publish.
keep_state_lock_for_seed_rc() {
  if [[ "${1:-}" == "0" ]]; then
    echo "keep"
  else
    echo "clear"
  fi
}

# Backstop for any future `set -e` abort we didn't anticipate: if the script
# exits without having written a heartbeat via the normal call sites above,
# the dead-man's-switch (check-blog-watchdog-heartbeat.sh) must still see a
# fresh, error-flavored line rather than silently going stale (see PRD:
# 2026-09-11 boot-race crash left the heartbeat frozen with no error recorded).
on_exit() {
  local rc=$?
  [[ -n "${WORK_DIR:-}" ]] && rm -rf "$WORK_DIR"
  if [[ "$HEARTBEAT_WRITTEN" -eq 0 ]]; then
    write_heartbeat "error: unexpected exit (rc=$rc)"
  fi
}
trap on_exit EXIT

# Fail fast and distinctly when a required binary is unresolvable (the
# 2026-10-03 rc=127 outage reported only "cadence gate unavailable").
missing_bins="$(watchdog_missing_binaries)"
if [[ -n "$missing_bins" ]]; then
  echo "[blog-cadence-watchdog] FATAL: required binaries not on PATH: $missing_bins (PATH=$PATH)" >&2
  write_heartbeat "error: missing binary $missing_bins"
  exit 1
fi

LOCKFILE="/tmp/bilko.blog-cadence-watchdog.lock"
exec 9>"$LOCKFILE"
if ! flock -n 9; then
  echo "[blog-cadence-watchdog] another instance running — skipping" >&2
  write_heartbeat "ok: skipped, another instance running"
  exit 0
fi

# --- read cadence policy from the config file — never hard-code it here ---
# LOWER_BOUND (the first number in target_gap_days: [3, 5]) is what gates "a
# post is due" for publishing. UPPER_BOUND (the second number) stays reserved
# for the over-cadence/stall classification heartbeat_status_for_outcome
# already uses — it is NOT the publish trigger.
LOWER_BOUND="$(grep -m1 'target_gap_days:' "$CONFIG_FILE" | grep -oP '\[\K\d+')"
UPPER_BOUND="$(grep -m1 'target_gap_days:' "$CONFIG_FILE" | grep -oP '\[\d+,\s*\K\d+')"
CATCHUP_TRIGGER="$(grep -m1 'catchup_trigger_days:' "$CONFIG_FILE" | grep -oP 'catchup_trigger_days:\s*\K\d+')"
if [[ -z "$LOWER_BOUND" || -z "$UPPER_BOUND" || -z "$CATCHUP_TRIGGER" ]]; then
  echo "[blog-cadence-watchdog] FATAL: could not parse cadence thresholds from $CONFIG_FILE" >&2
  write_heartbeat "error: could not parse cadence thresholds"
  exit 1
fi

# scan_every_days declares that scanning is daily and independent of whether a
# post is due — this script's own scan cadence is hard-wired to whatever
# triggers it (the daily systemd timer, docs/blog-watchdog.md), not to a
# value read here. Parse it anyway and FATAL if it ever drifts from 1, so a
# future edit to this key does not silently stop meaning what it says.
SCAN_EVERY_DAYS="$(grep -m1 'scan_every_days:' "$CONFIG_FILE" | grep -oP 'scan_every_days:\s*\K\d+')"
if [[ -z "$SCAN_EVERY_DAYS" ]]; then
  echo "[blog-cadence-watchdog] FATAL: could not parse scan_every_days from $CONFIG_FILE" >&2
  write_heartbeat "error: could not parse scan_every_days"
  exit 1
fi
if [[ "$SCAN_EVERY_DAYS" != "1" ]]; then
  echo "[blog-cadence-watchdog] FATAL: scan_every_days=$SCAN_EVERY_DAYS in $CONFIG_FILE, but this script's daily scan is driven by the daily systemd/cron triggers (docs/blog-watchdog.md), not by this value — a value other than 1 would silently misrepresent the real cadence" >&2
  write_heartbeat "error: scan_every_days is not 1, but the scan trigger is hard-wired to daily"
  exit 1
fi

# --- read the owner's autonomy control surface from the config file ---
# autonomous_publish is the master kill switch (blog.config.yaml autonomy
# block): true runs the full pipeline through phase 7 (seed + push); false
# restores the original human-gated phases-1-5-only behavior verbatim.
AUTONOMOUS_PUBLISH="$(grep -m1 'autonomous_publish:' "$CONFIG_FILE" | grep -oP 'autonomous_publish:\s*\K(true|false)')"
MAX_POSTS_PER_RUN="$(grep -m1 'max_posts_per_run:' "$CONFIG_FILE" | grep -oP 'max_posts_per_run:\s*\K\d+')"
if [[ -z "$AUTONOMOUS_PUBLISH" || -z "$MAX_POSTS_PER_RUN" ]]; then
  echo "[blog-cadence-watchdog] FATAL: could not parse autonomy settings from $CONFIG_FILE" >&2
  write_heartbeat "error: could not parse autonomy settings"
  exit 1
fi

# --- autonomous mode pushes; refuse to even attempt it against the wrong remote ---
# CLAUDE.md hard rule: never push Bilko to the content-grade remote. Assert the
# configured push remote actually resolves to this repo before any claude -p
# session gets a chance to seed or push anything.
if [[ "$AUTONOMOUS_PUBLISH" == "true" ]]; then
  PUSH_REMOTE_NAME="$(grep -m1 'push_remote:' "$CONFIG_FILE" | grep -oP 'push_remote:\s*\K\S+')"
  if [[ -z "$PUSH_REMOTE_NAME" ]]; then
    echo "[blog-cadence-watchdog] FATAL: could not parse push_remote from $CONFIG_FILE" >&2
    write_heartbeat "error: could not parse push_remote"
    exit 1
  fi
  REMOTE_URL="$(git remote get-url "$PUSH_REMOTE_NAME" 2>/dev/null || true)"
  if [[ "$REMOTE_URL" != *"StanislavBG/bilko-run"* ]]; then
    echo "[blog-cadence-watchdog] FATAL: remote '$PUSH_REMOTE_NAME' does not resolve to StanislavBG/bilko-run (got: '$REMOTE_URL') — refusing to run autonomous seed/push" >&2
    write_heartbeat "error: push remote does not resolve to StanislavBG/bilko-run"
    exit 1
  fi

fi

# --- measure the LIVE gap, not the seeded post files ---
# Retry through a boot-time network race (see PRD: the 2026-09-11 00:02 PT
# run fired before the network was up, curl returned a non-JSON-array body,
# and `jq -r '[.[].published_at] | max'` aborted the whole script under
# set -euo pipefail — before write_heartbeat ever ran). The fetch is now
# non-fatal per attempt: validate the body's TYPE with `jq -e` (status
# checked, not indexed blind) before ever touching .published_at.
#
# This is the ONE fetch implementation in the script — the post-publish
# verification poll (below) calls it too, rather than a second raw
# curl+jq path (PRD: single hardened fetch helper).
fetch_blog_json() {
  local max_attempts="$1"
  local backoff_seconds="$2"
  local candidate
  for attempt in $(seq 1 "$max_attempts"); do
    if candidate="$(curl -s --max-time 20 https://bilko.run/api/blog)" \
      && echo "$candidate" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
    echo "[blog-cadence-watchdog] fetch attempt $attempt/$max_attempts of /api/blog failed or returned a non-array body — retrying" >&2
    if [[ "$attempt" -lt "$max_attempts" ]]; then
      sleep "$backoff_seconds"
    fi
  done
  return 1
}

BLOG_JSON=""
FETCH_OK=0
if candidate_json="$(fetch_blog_json 3 10)"; then
  BLOG_JSON="$candidate_json"
  FETCH_OK=1
fi

if [[ "$FETCH_OK" -ne 1 ]]; then
  echo "[blog-cadence-watchdog] FATAL: could not read published_at from https://bilko.run/api/blog" >&2
  write_heartbeat "error: could not read published_at from /api/blog"
  exit 1
fi

NEWEST_PUBLISHED_AT="$(echo "$BLOG_JSON" | jq -r '[.[].published_at] | max')"
if [[ -z "$NEWEST_PUBLISHED_AT" || "$NEWEST_PUBLISHED_AT" == "null" ]]; then
  echo "[blog-cadence-watchdog] FATAL: could not read published_at from https://bilko.run/api/blog" >&2
  write_heartbeat "error: could not read published_at from /api/blog"
  exit 1
fi

TODAY="$(TZ=America/Los_Angeles date +%F)"
NOW_EPOCH="$(TZ=America/Los_Angeles date +%s)"
PUB_EPOCH="$(date -d "$NEWEST_PUBLISHED_AT" +%s)"
GAP_DAYS=$(( (NOW_EPOCH - PUB_EPOCH) / 86400 ))

echo "[blog-cadence-watchdog] $TODAY (PT): newest live post=$NEWEST_PUBLISHED_AT gap_days=$GAP_DAYS target_lower=$LOWER_BOUND target_upper=$UPPER_BOUND catchup_trigger=$CATCHUP_TRIGGER"

# --- hard minimum gap floor, from the code-enforced cadence gate, never
# /api/blog (see header comment: future-scheduled seeded posts are invisible
# there). Fail CLOSED: any failure here stops before any publish claude -p
# call gets a chance to run — not even a scan-only decision is based on a
# value this script could not validate. ---
NEXT_SLOT_ERR="$(mktemp)"
set +e
NEXT_SLOT="$(timeout 180 pnpm tsx scripts/blog-cadence-gate.ts next-slot 2>"$NEXT_SLOT_ERR")"
NEXT_SLOT_RC=$?
set -e
NEXT_SLOT_STDERR="$(cat "$NEXT_SLOT_ERR")"
rm -f "$NEXT_SLOT_ERR"
if [[ $NEXT_SLOT_RC -ne 0 || ! "$NEXT_SLOT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]; then
  echo "[blog-cadence-watchdog] FATAL: cadence gate next-slot unavailable or returned a non-ISO value (rc=$NEXT_SLOT_RC): stdout=$NEXT_SLOT stderr=$NEXT_SLOT_STDERR" >&2
  write_heartbeat "error: cadence gate unavailable"
  exit 1
fi
echo "[blog-cadence-watchdog] next_slot=$NEXT_SLOT"

# Scanning (phases 1-2 of the blog-from-git skill) runs every day, independent
# of whether a post is due to publish — cadence.scan_every_days in
# blog.config.yaml. Only the PUBLISH decision below is gated on the gap.
run_scan_only() {
  local reason="$1"
  local scan_prompt="You are running unattended, triggered by a daily cadence watchdog (scripts/blog-cadence-watchdog.sh). $reason blog.config.yaml's cadence.scan_every_days requires a scan every day, independent of whether a post is due to publish.

Follow the blog-from-git skill (.claude/skills/blog-from-git/SKILL.md) but run PHASES 1-2 ONLY: 1 Rotation (read rotation.md + blog-ledger.md) and 2 Scan (scan.md — gh, not local working trees, for pushed repos; local reconciliation for unpushed/no-remote repos per the ledger's watchlist).

Do NOT draft, seed, or publish anything this run. Do NOT create any file under .claude/skills/blog-from-git/drafts/. Do NOT create or edit any file under content/blog/ or blog-ledger.md. Do NOT run git add, git commit, or git push.

When done, print exactly one line summarizing what changed since the last scan (repos touched, notable commits), prefixed with 'SCAN_RESULT: ', and nothing else after it."

  set +e
  local scan_output
  scan_output="$(timeout 600 claude -p "$scan_prompt" \
    --model claude-sonnet-5 \
    --dangerously-skip-permissions \
    --output-format text 2>&1)"
  local scan_rc=$?
  set -e
  echo "$scan_output"

  if [[ $scan_rc -ne 0 ]]; then
    echo "[blog-cadence-watchdog] daily scan claude -p exited $scan_rc (timed out or errored)" >&2
    write_heartbeat "error: daily scan claude -p exited $scan_rc gap=${GAP_DAYS}d"
    exit "$scan_rc"
  fi

  write_heartbeat "ok: gap=${GAP_DAYS}d scan complete no publish action"
  echo "[blog-cadence-watchdog] done — daily scan complete, no action"
  exit 0
}

PUBLISH_DUE="$(publish_due_status "$GAP_DAYS" "$LOWER_BOUND")"
if [[ "$PUBLISH_DUE" != "due" ]]; then
  run_scan_only "The bilko.run blog's live publishing gap is ${GAP_DAYS} day(s), within the ${LOWER_BOUND}-day cadence target (not yet due to publish)."
fi

# --- hard minimum gap floor: even when the live /api/blog gap says a post is
# due, a post already seeded for a future date can push the true next-allowed
# slot later than today — scan only until NEXT_SLOT actually arrives. This
# check runs even though PUBLISH_DUE said "due" above; that live gap cannot
# see a future-scheduled seeded post, so it is not authoritative on its own. ---
NEXT_SLOT_EPOCH="$(date -d "$NEXT_SLOT" +%s)"
if (( NOW_EPOCH < NEXT_SLOT_EPOCH )); then
  run_scan_only "The cadence gate's hard minimum gap (scripts/blog-cadence-gate.ts) puts the next allowed publish slot at ${NEXT_SLOT}, which is still in the future."
fi

# --- idempotent per day: a second run on the same day never seeds a second
# post (guards against double-PUBLISHING), but it must NOT short-circuit the
# whole run — a post is due, so today's scan still runs via run_scan_only. ---
mkdir -p "$DRAFTS_DIR"
if [[ -f "$STATE_FILE" ]]; then
  LAST_RUN_DATE="$(cut -d' ' -f1 "$STATE_FILE" 2>/dev/null || true)"
  if [[ "$LAST_RUN_DATE" == "$TODAY" ]]; then
    echo "[blog-cadence-watchdog] already drafted/published today per $STATE_FILE — scanning only"
    run_scan_only "The bilko.run blog's live publishing gap is ${GAP_DAYS} day(s) and a post is due, but this machine already ran today's publish attempt ($STATE_FILE)."
  fi
fi

# --- drafts already pending: in non-autonomous mode, don't pile more on top ---
# Unreviewed drafts are awaiting phase-6 human approval; drafting more while
# they sit there is what produced an ambiguous pile of "whose is this?" files
# (see PRD 1002's postmortem). A run that finds *.md drafts already present
# stops here instead of invoking claude -p — but ONLY when autonomous_publish
# is false. In autonomous mode a pending draft must not deadlock the pipeline
# forever: it is consumed (seeded, then removed from drafts/) instead.
shopt -s nullglob
EXISTING_DRAFTS=("$DRAFTS_DIR"/*.md)
shopt -u nullglob
# drafts/<slug>/ pipeline-artifact folders are directories, never pending
# drafts — keep only regular files.
_FILTERED_DRAFTS=()
for _d in "${EXISTING_DRAFTS[@]}"; do
  [[ -f "$_d" ]] && _FILTERED_DRAFTS+=("$_d")
done
EXISTING_DRAFTS=("${_FILTERED_DRAFTS[@]}")
CONSUME_EXISTING_DRAFTS=0
if (( ${#EXISTING_DRAFTS[@]} > 0 )) && [[ "$AUTONOMOUS_PUBLISH" != "true" ]]; then
  PENDING_ALERT_DAYS="$(grep -m1 'pending_draft_alert_days:' "$CONFIG_FILE" | grep -oP 'pending_draft_alert_days:\s*\K\d+')"
  if [[ -z "$PENDING_ALERT_DAYS" ]]; then
    echo "[blog-cadence-watchdog] FATAL: could not parse pending_draft_alert_days from $CONFIG_FILE" >&2
    write_heartbeat "error: could not parse pending_draft_alert_days"
    exit 1
  fi

  OLDEST_DRAFT=""
  OLDEST_DRAFT_EPOCH=""
  for draft in "${EXISTING_DRAFTS[@]}"; do
    draft_epoch="$(date -r "$draft" +%s)"
    if [[ -z "$OLDEST_DRAFT_EPOCH" || "$draft_epoch" -lt "$OLDEST_DRAFT_EPOCH" ]]; then
      OLDEST_DRAFT_EPOCH="$draft_epoch"
      OLDEST_DRAFT="$draft"
    fi
  done
  OLDEST_DRAFT_AGE_DAYS=$(( (NOW_EPOCH - OLDEST_DRAFT_EPOCH) / 86400 ))

  echo "[blog-cadence-watchdog] ${#EXISTING_DRAFTS[@]} unreviewed draft(s) already pending review — skipping: ${EXISTING_DRAFTS[*]} — oldest: $OLDEST_DRAFT (${OLDEST_DRAFT_AGE_DAYS}d)"

  if (( OLDEST_DRAFT_AGE_DAYS >= PENDING_ALERT_DAYS )); then
    write_heartbeat "warn: ${#EXISTING_DRAFTS[@]} unreviewed draft(s) pending review, oldest ${OLDEST_DRAFT_AGE_DAYS}d ($OLDEST_DRAFT) >= ${PENDING_ALERT_DAYS}d threshold"
  else
    write_heartbeat "ok: ${#EXISTING_DRAFTS[@]} unreviewed draft(s) already pending review — skipping"
  fi
  exit 0
fi

# Autonomous mode never hits the skip branch above — a pending draft (left
# over from a prior run, or from a run made while autonomous_publish was
# false) must not deadlock the pipeline forever. It is consumed: seeded, then
# removed from drafts/, instead of piling up unreviewed.
if (( ${#EXISTING_DRAFTS[@]} > 0 )); then
  CONSUME_EXISTING_DRAFTS=1
  echo "[blog-cadence-watchdog] autonomous mode — ${#EXISTING_DRAFTS[@]} pending draft(s) found: ${EXISTING_DRAFTS[*]} — will seed (up to max_posts_per_run=$MAX_POSTS_PER_RUN) instead of skipping"
fi

if (( GAP_DAYS >= CATCHUP_TRIGGER )); then
  MODE="catchup"
else
  MODE="portfolio"
fi

# stamped into every draft's front matter — from the script's own clock.
AUTHORED_AT="$(TZ=America/Los_Angeles date -Iseconds)"

# The two entrypoints. Tests (only) may override them with BLOG_DRAFT_CMD /
# BLOG_SEED_CMD; a value is split on whitespace into argv.
DRAFT_CMD=(bash scripts/blog-draft.sh)
SEED_CMD=(bash scripts/blog-seed.sh)
[[ -n "${BLOG_DRAFT_CMD:-}" ]] && read -r -a DRAFT_CMD <<< "$BLOG_DRAFT_CMD"
[[ -n "${BLOG_SEED_CMD:-}" ]] && read -r -a SEED_CMD <<< "$BLOG_SEED_CMD"

WORK_DIR="$(mktemp -d)"

# Post-publish audit of the content DAG: re-runs the pipeline checker for each
# seeded slug that has artifacts. Report-only — never reverts, rewrites, or
# re-pushes anything. Args: <bundle_dir> <slug>... ; sets PIPELINE_FAILED_SLUGS.
run_pipeline_audit() {
  local bundle="$1" slug rc dir failed=()
  shift
  for slug in "$@"; do
    dir="$bundle/artifacts/$slug"
    [[ -d "$dir" ]] || dir="$DRAFTS_DIR/$slug"
    [[ -d "$dir" ]] || continue
    set +e
    timeout 120 npx tsx scripts/blog-pipeline-check.ts "$dir" "content/blog/$slug.md" >&2
    rc=$?
    set -e
    if [[ $rc -ne 0 ]]; then
      failed+=("$slug")
    fi
  done
  PIPELINE_FAILED_SLUGS="$(IFS=','; echo "${failed[*]:-}")"
}

# Runs blog-seed.sh on one bundle. Sets SEED_RC and SEED_STDOUT (its final JSON line;
# its stderr logs pass straight through).
run_seed() {
  local bundle="$1"
  set +e
  SEED_STDOUT="$("${SEED_CMD[@]}" --bundle "$bundle")"
  SEED_RC=$?
  set -e
  [[ -n "$SEED_STDOUT" ]] && echo "$SEED_STDOUT"
  return 0
}

# Maps a blog-seed.sh failure/hold to the lock + heartbeat and exits. Not used for rc 0.
finish_seed_failure() {
  local rc="$1"
  if [[ "$(keep_state_lock_for_seed_rc "$rc")" != "keep" ]]; then
    rm -f "$STATE_FILE"
  fi
  if [[ "$rc" -eq 3 ]]; then
    local hold_status
    hold_status="$(heartbeat_status_for_outcome "$GAP_DAYS" "$UPPER_BOUND" 0)"
    echo "[blog-cadence-watchdog] blog-seed.sh rc=3: cadence gate refused — nothing committed, retry next run"
    write_heartbeat "${hold_status}: cadence hold (blog-seed.sh rc=3), nothing committed gap=${GAP_DAYS}d"
    exit 0
  fi
  echo "[blog-cadence-watchdog] blog-seed.sh exited $rc" >&2
  write_heartbeat "error: blog-seed.sh rc=$rc mode=$MODE gap=${GAP_DAYS}d"
  exit 1
}

# Records a successful blog-seed.sh run (rc 0) for <slug>... and exits 0.
finish_seeded() {
  local bundle="$1" last_url
  shift
  last_url="$(echo "$SEED_STDOUT" | tail -1 | jq -r '.url // empty' 2>/dev/null || true)"
  run_pipeline_audit "$bundle" "$@"
  if [[ -n "$PIPELINE_FAILED_SLUGS" ]]; then
    echo "[blog-cadence-watchdog] pipeline-check failed for: $PIPELINE_FAILED_SLUGS — post stays published, flagging only" >&2
    write_heartbeat "warn: published slugs=$* url=${last_url:-unknown} pipeline-check failed slugs=$PIPELINE_FAILED_SLUGS"
  else
    write_heartbeat "ok: published slugs=$* url=${last_url:-unknown}"
  fi
  echo "[blog-cadence-watchdog] done — published: $*"
  exit 0
}

echo "[blog-cadence-watchdog] mode=$MODE autonomous=$AUTONOMOUS_PUBLISH consume_existing=$CONSUME_EXISTING_DRAFTS next_slot=$NEXT_SLOT"

# Record intent to run BEFORE invoking anything, not after (PRD 1002 postmortem:
# a timeout mid-draft must not leave an unrecorded run behind).
echo "$TODAY $MODE $GAP_DAYS" > "$STATE_FILE"

# --- autonomous: seed pending drafts instead of drafting new ones ---
if [[ "$CONSUME_EXISTING_DRAFTS" -eq 1 ]]; then
  SEEDED_SLUGS=()
  for draft in "${EXISTING_DRAFTS[@]}"; do
    (( ${#SEEDED_SLUGS[@]} >= MAX_POSTS_PER_RUN )) && break
    PENDING_BUNDLE="$WORK_DIR/pending-$(basename "$draft" .md)"
    if ! CONVERT_ERR="$(bp_pending_draft_to_bundle "$draft" "$PENDING_BUNDLE")"; then
      echo "[blog-cadence-watchdog] pending draft $draft cannot be converted ($CONVERT_ERR) — renaming to .rejected-invalid" >&2
      mv "$draft" "${draft}.rejected-invalid"
      continue
    fi
    run_seed "$PENDING_BUNDLE"
    if [[ "$SEED_RC" -eq 0 ]]; then
      SEEDED_SLUGS+=("$(bp_fm_get "$PENDING_BUNDLE/post.md" slug)")
      rm -f "$draft"
    elif [[ "$SEED_RC" -eq 2 ]]; then
      # bad bundle, nothing committed: must not block every future run
      echo "[blog-cadence-watchdog] blog-seed.sh rejected pending draft $draft (rc=2) — renaming to .rejected-invalid" >&2
      mv "$draft" "${draft}.rejected-invalid"
    else
      if (( ${#SEEDED_SLUGS[@]} > 0 )); then
        # an earlier draft already landed this run; keep the lock and report it
        finish_seeded "$PENDING_BUNDLE" "${SEEDED_SLUGS[@]}"
      fi
      finish_seed_failure "$SEED_RC"
    fi
  done
  if (( ${#SEEDED_SLUGS[@]} > 0 )); then
    finish_seeded "$WORK_DIR" "${SEEDED_SLUGS[@]}"
  fi
  # every pending draft was rejected: fall through and draft a fresh one
  echo "[blog-cadence-watchdog] no pending draft could be seeded — drafting a new post"
fi

# --- draft: blog-draft.sh writes a bundle into a temp dir ---
BUNDLE_DIR="$WORK_DIR/bundle"
set +e
"${DRAFT_CMD[@]}" --out "$BUNDLE_DIR" --slot "$NEXT_SLOT"
DRAFT_RC=$?
set -e

if [[ $DRAFT_RC -ne 0 ]]; then
  rm -f "$STATE_FILE"
  DRAFT_ERR="$(jq -r '.error // empty' "$BUNDLE_DIR/result.json" 2>/dev/null || true)"
  echo "[blog-cadence-watchdog] blog-draft.sh exited $DRAFT_RC ${DRAFT_ERR}" >&2
  write_heartbeat "error: blog-draft.sh rc=$DRAFT_RC${DRAFT_ERR:+ ($DRAFT_ERR)} mode=$MODE gap=${GAP_DAYS}d"
  exit 1
fi

DRAFT_STATUS="$(jq -r '.status // empty' "$BUNDLE_DIR/result.json" 2>/dev/null || true)"
if [[ "$DRAFT_STATUS" == "skipped" ]]; then
  rm -f "$STATE_FILE"
  SKIP_REASON="$(jq -r '.reason // "nothing worth writing"' "$BUNDLE_DIR/result.json")"
  echo "[blog-cadence-watchdog] blog-draft.sh skipped: $SKIP_REASON"
  SKIP_STATUS="$(heartbeat_status_for_outcome "$GAP_DAYS" "$UPPER_BOUND" 0)"
  write_heartbeat "${SKIP_STATUS}: draft skipped ($SKIP_REASON) gap=${GAP_DAYS}d"
  exit 0
fi
if [[ "$DRAFT_STATUS" != "drafted" || ! -f "$BUNDLE_DIR/post.md" ]]; then
  rm -f "$STATE_FILE"
  echo "[blog-cadence-watchdog] blog-draft.sh rc=0 but result.json status='$DRAFT_STATUS' / no post.md" >&2
  write_heartbeat "error: blog-draft.sh rc=0 but no usable bundle (status=${DRAFT_STATUS:-none}) mode=$MODE gap=${GAP_DAYS}d"
  exit 1
fi
DRAFT_SLUG="$(bp_fm_get "$BUNDLE_DIR/post.md" slug)"

# --- non-autonomous: leave a reviewable draft, never seed ---
if [[ "$AUTONOMOUS_PUBLISH" != "true" ]]; then
  DRAFT_FILE="$DRAFTS_DIR/$(TZ=America/Los_Angeles date +%F)-$DRAFT_SLUG.md"
  if ! bp_bundle_to_draft "$BUNDLE_DIR" "$DRAFT_FILE" "$NEXT_SLOT" "$AUTHORED_AT"; then
    rm -f "$STATE_FILE"
    write_heartbeat "error: could not write draft $DRAFT_FILE mode=$MODE gap=${GAP_DAYS}d"
    exit 1
  fi
  write_heartbeat "ok: drafted mode=$MODE gap=${GAP_DAYS}d"
  echo "[blog-cadence-watchdog] done — draft is $DRAFT_FILE, awaiting human review/seed"
  exit 0
fi

# --- autonomous: seed the bundle ---
run_seed "$BUNDLE_DIR"
if [[ "$SEED_RC" -ne 0 ]]; then
  finish_seed_failure "$SEED_RC"
fi
finish_seeded "$BUNDLE_DIR" "$DRAFT_SLUG"
