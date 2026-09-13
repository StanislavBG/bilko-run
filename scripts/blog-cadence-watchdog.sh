#!/usr/bin/env bash
# Daily watchdog for the bilko.run blog's declared 3-5 day cadence
# (.claude/skills/blog-from-git/blog.config.yaml cadence.target_gap_days).
# Nothing else enforces that cadence — before this script existed a
# publishing gap could grow indefinitely and silently (see PRD: gap reached
# 36 days on 2026-08-29, then 15 days again on 2026-09-11 because the
# original version of this script hard-stopped at a human approval gate).
#
# TRIGGERS — this script is currently wired to run from TWO independent
# schedulers on this machine (full detail, recommendation, and log contents:
# docs/blog-watchdog.md):
#   1. crontab: `0 12 * * * .../blog-cadence-watchdog.sh` (daily, 12:00 PT)
#      appends to ~/.claude/logs/blog-cadence-watchdog.log — REDUNDANT.
#   2. systemd user timer `blog-cadence-watchdog.timer` (OnCalendar=daily,
#      Persistent=true, fires ~00:00-00:15 PT) — AUTHORITATIVE, since
#      Persistent=true replays a run missed while the machine was off/asleep,
#      which plain cron cannot do. Its service appends to
#      .claude/skills/blog-from-git/drafts/.watchdog.log.
# Both are LOCAL to this machine only and only fire while it is powered on.
# Overlapping/duplicate firings are a safe no-op: the /tmp/bilko.blog-cadence-
# watchdog.lock flock below serializes concurrent runs, and the same-day
# .watchdog-state check makes a second run on one day idempotent.
#
# AUTONOMOUS FLOW — Bilko is an autonomous agent, not a human-supervised
# publishing workflow. When the live gap blows the target, this script shells
# out to `claude -p` (model pinned, see shared/core.md's hard rule) to run
# the blog-from-git skill. How far it runs is controlled entirely by
# .claude/skills/blog-from-git/blog.config.yaml's `autonomy.autonomous_publish`
# — the OWNER'S CONTROL SURFACE and master kill switch:
#   - autonomous_publish: true  (default) — runs the FULL pipeline through
#     phase 7: draft, then seed (server/db.ts + blog-ledger.md, in the same
#     commit), then push to origin main. Safety rails are mechanical, not a
#     human in the loop: explicit commit pathspecs only, never a
#     wildcard/blanket stage of the whole working tree, a `max_posts_per_run`
#     cap even in catch-up mode, a remote-name assertion before pushing, and
#     no push if tsc/db-tests fail.
#   - autonomous_publish: false — restores the original human-gated
#     behavior verbatim: only phases 1-5 (Rotation, Scan, Research, Ground,
#     Draft) run, draft markdown file(s) land in
#     .claude/skills/blog-from-git/drafts/, and the run stops there. Phase 6
#     (Approve) and phase 7 (Seed) require an explicit human OK and stay
#     entirely manual — the flow described in seed.md's non-autonomous path.
# Flip that one line in blog.config.yaml to restore the gated behavior.
#
# Mirrors the cron-script conventions in
# ~/Projects/social-signals-trader/scripts/analyst-tick.sh: lockfile in
# /tmp, PATH fix for cron's bare env, bounded timeout, log via cron redirect.
#
# POST-PUBLISH VERIFICATION — blog.config.yaml gates.7_seed requires "live
# pickup verified at /api/blog after Render deploys", but nothing previously
# enforced that: a push that lands but a deploy that never boots (or crashes)
# was invisible until the next cadence-gap heartbeat, weeks later. After a
# successful autonomous seed+push this script polls https://bilko.run/api/blog
# (reusing fetch_blog_json below — one fetch implementation, not two) until
# every slug it just seeded appears, or autonomy.verify_deploy_timeout_seconds
# expires. WORST-CASE RUNTIME: CLAUDE_TIMEOUT (3300s in autonomous mode) +
# verify_deploy_timeout_seconds (900s default) = ~4200s (~70 min) for a single
# run — the push already happened before this poll starts, so a verification
# timeout only ever reports (no revert, no re-seed, no re-push); the next
# scheduled run is the retry path.
set -euo pipefail
cd "$(dirname "$0")/.."

# cron runs with a bare PATH; the claude CLI lives in ~/.local/bin.
export PATH="$HOME/.local/bin:$PATH"

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

# Backstop for any future `set -e` abort we didn't anticipate: if the script
# exits without having written a heartbeat via the normal call sites above,
# the dead-man's-switch (check-blog-watchdog-heartbeat.sh) must still see a
# fresh, error-flavored line rather than silently going stale (see PRD:
# 2026-09-11 boot-race crash left the heartbeat frozen with no error recorded).
on_exit() {
  local rc=$?
  if [[ "$HEARTBEAT_WRITTEN" -eq 0 ]]; then
    write_heartbeat "error: unexpected exit (rc=$rc)"
  fi
}
trap on_exit EXIT

LOCKFILE="/tmp/bilko.blog-cadence-watchdog.lock"
exec 9>"$LOCKFILE"
if ! flock -n 9; then
  echo "[blog-cadence-watchdog] another instance running — skipping" >&2
  write_heartbeat "ok: skipped, another instance running"
  exit 0
fi

# --- read cadence policy from the config file — never hard-code it here ---
UPPER_BOUND="$(grep -m1 'target_gap_days:' "$CONFIG_FILE" | grep -oP '\[\d+,\s*\K\d+')"
CATCHUP_TRIGGER="$(grep -m1 'catchup_trigger_days:' "$CONFIG_FILE" | grep -oP 'catchup_trigger_days:\s*\K\d+')"
if [[ -z "$UPPER_BOUND" || -z "$CATCHUP_TRIGGER" ]]; then
  echo "[blog-cadence-watchdog] FATAL: could not parse cadence thresholds from $CONFIG_FILE" >&2
  write_heartbeat "error: could not parse cadence thresholds"
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

  # --- load the mechanical rail from config, don't just leave it as prose ---
  # autonomy.allowed_commit_paths in blog.config.yaml is documented as "the
  # ONLY paths an autonomous seed commit may stage", but nothing previously
  # read that key — the prompt below hard-codes the same two paths instead.
  # Parse it here and cross-check it against the hard-coded pathspec so a
  # future edit to one without the other fails loudly instead of silently
  # doing nothing, and so ALLOWED_COMMIT_PATHS is available below to verify
  # what the claude -p subprocess actually committed.
  # ALLOWED_PATHS_AWK is a named variable (not inlined) so the test suite can
  # execute this exact program against the real config file instead of only
  # matching script text — a comment-only continuation line under the key
  # (blog.config.yaml wraps the key's trailing comment onto its own line)
  # must be skipped, not treated as the end of the block.
  ALLOWED_COMMIT_PATHS=()
  ALLOWED_PATHS_AWK='
    /allowed_commit_paths:/ { flag=1; next }
    flag && /^[[:space:]]*$/ { next }
    flag && /^[[:space:]]*#/ { next }
    flag && /^[[:space:]]*-[[:space:]]*/ { print; next }
    flag { exit }
  '
  ALLOWED_PATHS_RAW="$(awk "$ALLOWED_PATHS_AWK" "$CONFIG_FILE")"
  while IFS= read -r raw_line; do
    path="$(echo "$raw_line" | sed -E 's/^[[:space:]]*-[[:space:]]*//; s/[[:space:]]*#.*$//')"
    [[ -n "$path" ]] && ALLOWED_COMMIT_PATHS+=("$path")
  done <<< "$ALLOWED_PATHS_RAW"
  EXPECTED_COMMIT_PATHS=("server/db.ts" ".claude/skills/blog-from-git/blog-ledger.md")
  if [[ "${#ALLOWED_COMMIT_PATHS[@]}" -eq 0 || "${ALLOWED_COMMIT_PATHS[*]}" != "${EXPECTED_COMMIT_PATHS[*]}" ]]; then
    echo "[blog-cadence-watchdog] FATAL: autonomy.allowed_commit_paths in $CONFIG_FILE (got: '${ALLOWED_COMMIT_PATHS[*]}') no longer matches the seed pathspec this script commits (server/db.ts, .claude/skills/blog-from-git/blog-ledger.md) — update both together" >&2
    write_heartbeat "error: allowed_commit_paths does not match hard-coded seed pathspec"
    exit 1
  fi
fi

# --- measure the LIVE gap, not server/db.ts's seed data ---
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

echo "[blog-cadence-watchdog] $TODAY (PT): newest live post=$NEWEST_PUBLISHED_AT gap_days=$GAP_DAYS target_upper=$UPPER_BOUND catchup_trigger=$CATCHUP_TRIGGER"

if (( GAP_DAYS < UPPER_BOUND )); then
  echo "[blog-cadence-watchdog] within cadence — no action"
  write_heartbeat "ok: within cadence gap=${GAP_DAYS}d no action"
  exit 0
fi

# --- idempotent per day: a second run on the same day is a no-op ---
mkdir -p "$DRAFTS_DIR"
if [[ -f "$STATE_FILE" ]]; then
  LAST_RUN_DATE="$(cut -d' ' -f1 "$STATE_FILE" 2>/dev/null || true)"
  if [[ "$LAST_RUN_DATE" == "$TODAY" ]]; then
    echo "[blog-cadence-watchdog] already drafted today per $STATE_FILE — skipping"
    write_heartbeat "ok: already drafted today gap=${GAP_DAYS}d"
    exit 0
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
  MODE_INSTRUCTIONS="Catch-up mode (gap ${GAP_DAYS}d >= catchup_trigger_days ${CATCHUP_TRIGGER}d): scan the WHOLE portfolio's activity since the last live post ($NEWEST_PUBLISHED_AT) via GitHub (per scan.md — gh, not local working trees, for pushed repos; local reconciliation for unpushed/no-remote repos per the ledger's watchlist) and produce a QUEUE of separate, normal-sized backdated posts at 3-5 day cadence, each honestly dated to when its work actually shipped (blog.config.yaml backdating: honest-only), per rotation.md Part 0.5. Write one draft file per queued post."
else
  MODE="portfolio"
  MODE_INSTRUCTIONS="Portfolio mode (gap ${GAP_DAYS}d, no project named): scan the whole portfolio's activity since the last live post ($NEWEST_PUBLISHED_AT) via GitHub (per scan.md) and draft ONE arc post spanning the repos that moved."
fi

# stamped into every draft's front matter below — from the script's own
# clock, not the model's guess at the current time.
AUTHORED_AT="$(TZ=America/Los_Angeles date -Iseconds)"

if [[ "$AUTONOMOUS_PUBLISH" != "true" ]]; then
  # --- non-autonomous path: the original human-gated behavior, verbatim ---
  PROMPT="You are running unattended, triggered by a cron watchdog (scripts/blog-cadence-watchdog.sh) because the bilko.run blog's live publishing gap is ${GAP_DAYS} days, past its ${UPPER_BOUND}-day cadence target. There is NO human present in this session.

Follow the blog-from-git skill (.claude/skills/blog-from-git/SKILL.md) but run PHASES 1-5 ONLY: 1 Rotation (read rotation.md + blog-ledger.md — respect never_repeat_previous_project and max_consecutive_untiled_posts), 2 Scan, 3 Research, 4 Ground, 5 Draft (voice.md).

$MODE_INSTRUCTIONS

STOP AFTER PHASE 5. Do not run phase 6 (Approve) or phase 7 (Seed) — this repo's editorial gate requires an EXPLICIT human OK before any post is seeded or published, and no human is present to give it. Concretely, in this run you must NOT:
- edit server/db.ts
- edit or append to blog-ledger.md
- run git add, git commit, or git push
- seed or publish anything
- delete, move, or overwrite any pre-existing file in .claude/skills/blog-from-git/drafts/ — that directory is append-only for automated runs; only a human (or an explicitly human-approved seed step) removes drafts from it
- describe a file you did not create in this run as your own output — if you find drafts already present, report them as pre-existing and leave them untouched

Instead, write each finished draft as a standalone markdown file under .claude/skills/blog-from-git/drafts/<published-date-YYYY-MM-DD>-<slug>.md, creating the directory if needed. Each draft's front matter MUST include: title, slug, category, published_at, tone, authored_by: blog-cadence-watchdog, authored_at: $AUTHORED_AT (use this exact timestamp — it is this run's actual start time, not a guess). When done, print a one-line list of the draft file path(s) you wrote and nothing else."
  CLAUDE_TIMEOUT=2400
else
  # --- autonomous path: mechanical rails replace the human OK ---
  REQUIREMENTS="Autonomy: blog.config.yaml's autonomy.autonomous_publish is true (the owner's master kill switch) — that plus the phase-4/5 quality self-check in SKILL.md passing IS your phase-6 approval; do not wait for a human. Run phase 7 (seed.md) yourself, honoring every rail below:
- Seed by editing server/db.ts (INSERT OR IGNORE per seed.md) and, in the SAME commit, append/update .claude/skills/blog-from-git/blog-ledger.md (a row per post + the rewritten \"Current rotation state\" block).
- Before committing, run \`npx tsc --noEmit -p tsconfig.json\` and \`pnpm test tests/db.test.ts\`. If either fails, do NOT commit or push anything — abort and finish by printing exactly one line, \`SEED_RESULT: error note=\"<the failing check>\"\`, and nothing else.
- Stage ONLY server/db.ts and .claude/skills/blog-from-git/blog-ledger.md via explicit pathspecs: \`git add server/db.ts .claude/skills/blog-from-git/blog-ledger.md\`. NEVER stage the whole working tree with a wildcard/blanket git-add, and never commit with an all-tracked-files shortcut flag — this working tree carries hundreds of unrelated modified files (e.g. public/outdoor-hours/hourly/*.json) that must never be swept into this commit.
- Push with \`git push origin main\` only — never any other remote (never content-grade) and never any other branch.
- Cap how many posts you seed in this run at ${MAX_POSTS_PER_RUN} (blog.config.yaml autonomy.max_posts_per_run), even in catch-up mode. If more publishable posts exist than the cap, seed only the first ${MAX_POSTS_PER_RUN} (oldest-dated, honest backdating per blog.config.yaml truth rules) in one commit, and leave the rest queued in blog-ledger.md's \"Planned backfill queue\" block for a later run. Log how many you seeded vs deferred.
- If there is genuinely no publishable material in this window, do NOT invent a post to satisfy cadence (blog.config.yaml truth.no_invented_metrics / every_number_needs_a_source still bind) — finish by printing exactly one line, \`SEED_RESULT: noop note=\"<why nothing was publishable>\"\`, and nothing else.
- On success, finish by printing exactly one line, \`SEED_RESULT: published=<n> deferred=<m> slugs=\"<comma-separated-slugs-you-just-seeded>\" note=\"<short summary>\"\`, and nothing else after it. The slugs list is how the watchdog verifies live pickup afterward — list every slug you seeded this run, not the ones you deferred."

  if [[ "$CONSUME_EXISTING_DRAFTS" -eq 1 ]]; then
    PROMPT="You are running unattended, triggered by a cron watchdog (scripts/blog-cadence-watchdog.sh). blog.config.yaml's autonomy.autonomous_publish is true.

${#EXISTING_DRAFTS[@]} draft(s) are already pending in .claude/skills/blog-from-git/drafts/ from a prior run: ${EXISTING_DRAFTS[*]}. Phases 1-5 (Rotation, Scan, Research, Ground, Draft) are marked done for these, but you must RE-VERIFY each one against the CURRENT blog-ledger.md 'Current rotation state' block and rotation.md's rules (never_repeat_previous_project, max_consecutive_untiled_posts) before doing anything else — a draft passing its phase-5 self-check at draft time does not guarantee it still clears the phase-6 rotation gate now.

For each pending draft, exactly one of these two things happens — pick per-draft, do not skip this check:
- STILL CLEARS the rotation gate and the SKILL.md phase-5 self-check: do not re-draft it — go straight to phase 6/7 per the requirements below.
- FAILS the rotation gate (e.g. its subject would repeat the previous post's project, or would make a second consecutive off-/projects post): you must NOT leave it sitting in drafts/ blocking every future run, and you must NOT just stop here and report a no-op — a rejected gate is not a reason to do nothing. Move the rejected file out of the drafts/*.md glob by renaming it in place with a literal '.rejected-rotation-gate' suffix (e.g. \`mv \"\$draft\" \"\${draft}.rejected-rotation-gate\"\`) — NEVER delete it, its content is not recoverable once gone (drafts/ is gitignored).

Across ALL rejected drafts combined, you get ONE re-draft attempt for this entire run, not one per rejected draft: after rejecting (and renaming) every draft that fails the gate, draft exactly ONE replacement post on a rotation-compliant subject — read blog-ledger.md's 'Current rotation state' block for any recorded rotation debt and pick a subject that satisfies it and rotation.md's rules. If that single replacement subject also fails a check, do not loop, retry, or draft a second replacement; fall through to the 'no publishable material' case in the requirements below rather than inventing a post to fill the cadence.

The total number of drafts you seed this run (original or replacement) must never exceed max_posts_per_run=${MAX_POSTS_PER_RUN}, and you must not end the run having added a fresh unreviewed *.md file to drafts/ that you neither seeded nor rejected-and-renamed — every draft you touch this run leaves drafts/ either seeded-and-deleted, rejected-and-renamed, or (only for one you deferred under the cap) untouched exactly as you found it.

$REQUIREMENTS

For each draft you seed, delete its file from .claude/skills/blog-from-git/drafts/ as part of the same operation that commits its seed — a consumed draft must not linger. Any draft you defer under the cap must be LEFT UNTOUCHED in drafts/ for a later run — never delete, move, or overwrite a draft you are not seeding in this run, except a draft you are rejecting for failing the rotation gate, which you rename with the '.rejected-rotation-gate' suffix as described above."
  else
    PROMPT="You are running unattended, triggered by a cron watchdog (scripts/blog-cadence-watchdog.sh) because the bilko.run blog's live publishing gap is ${GAP_DAYS} days, past its ${UPPER_BOUND}-day cadence target. There is NO human present in this session. blog.config.yaml's autonomy.autonomous_publish is true — run the FULL pipeline, PHASES 1-7.

Follow the blog-from-git skill (.claude/skills/blog-from-git/SKILL.md), running PHASES 1-7: 1 Rotation (read rotation.md + blog-ledger.md — respect never_repeat_previous_project and max_consecutive_untiled_posts), 2 Scan, 3 Research, 4 Ground, 5 Draft (voice.md), 6 Approve (autonomous gate, see below), 7 Seed (seed.md).

$MODE_INSTRUCTIONS

$REQUIREMENTS

While drafting, write each finished draft as a standalone markdown file under .claude/skills/blog-from-git/drafts/<published-date-YYYY-MM-DD>-<slug>.md (front matter: title, slug, category, published_at, tone, authored_by: blog-cadence-watchdog, authored_at: $AUTHORED_AT) so there is a durable record before you seed it — then seed the ones within this run's cap and delete their draft files as part of that same operation; leave any deferred draft's file in place for a later run."
  fi
  CLAUDE_TIMEOUT=3300
fi

echo "[blog-cadence-watchdog] mode=$MODE autonomous=$AUTONOMOUS_PUBLISH consume_existing=$CONSUME_EXISTING_DRAFTS — invoking claude -p"

# Record intent to run BEFORE invoking claude -p, not after. Writing this
# after the call (the original ordering) let a timeout mid-draft strand
# partial drafts on disk with no state recorded — the exact condition that
# produced seven unattributed "orphan" files during PRD 1002's postmortem.
echo "$TODAY $MODE $GAP_DAYS" > "$STATE_FILE"

set +e
CLAUDE_OUTPUT="$(timeout "$CLAUDE_TIMEOUT" claude -p "$PROMPT" \
  --model claude-sonnet-5 \
  --dangerously-skip-permissions \
  --output-format text 2>&1)"
CLAUDE_RC=$?
set -e
echo "$CLAUDE_OUTPUT"

if [[ $CLAUDE_RC -ne 0 ]]; then
  # Undo the "ran today" marker: nothing was actually drafted/seeded (or the
  # EXISTING_DRAFTS guard on the next invocation will catch any partial
  # orphan files from a mid-run timeout), so a same-day retry — whether
  # from the next cron trigger or a human rerunning by hand after fixing
  # the underlying error — must not be blocked by the idempotent-per-day
  # check above thinking today's run already happened.
  rm -f "$STATE_FILE"
  echo "[blog-cadence-watchdog] claude -p exited $CLAUDE_RC (timed out or errored) — will retry next scheduled run" >&2
  write_heartbeat "error: claude -p exited $CLAUDE_RC mode=$MODE gap=${GAP_DAYS}d"
  exit "$CLAUDE_RC"
fi

if [[ "$AUTONOMOUS_PUBLISH" != "true" ]]; then
  write_heartbeat "ok: drafted mode=$MODE gap=${GAP_DAYS}d"
  echo "[blog-cadence-watchdog] done — drafts (if any) are in $DRAFTS_DIR, awaiting human review/seed"
  exit 0
fi

# --- autonomous mode: the claude -p session reports its outcome via a single
# SEED_RESULT line so this heartbeat can distinguish a real publish from a
# no-op from an error, instead of assuming success from a zero exit code. ---
SEED_LINE="$(echo "$CLAUDE_OUTPUT" | grep -o 'SEED_RESULT:.*' | tail -1)"
if [[ "$SEED_LINE" == SEED_RESULT:\ error* ]]; then
  echo "[blog-cadence-watchdog] $SEED_LINE" >&2
  write_heartbeat "error: ${SEED_LINE#SEED_RESULT: }"
  exit 1
elif [[ "$SEED_LINE" == SEED_RESULT:\ noop* ]]; then
  echo "[blog-cadence-watchdog] $SEED_LINE"
  # Reaching this branch means nothing was seeded; GAP_DAYS is always already
  # >= UPPER_BOUND here (the earlier `if (( GAP_DAYS < UPPER_BOUND ))` block
  # above already exited on the within-cadence case), so this is the exact
  # stall this function exists to catch: a rotation-blocked (or otherwise
  # unpublishable) draft must not report as healthy while the publishing gap
  # keeps growing.
  NOOP_STATUS="$(heartbeat_status_for_outcome "$GAP_DAYS" "$UPPER_BOUND" 0)"
  write_heartbeat "${NOOP_STATUS}: ${SEED_LINE#SEED_RESULT: }"
elif [[ "$SEED_LINE" == SEED_RESULT:\ published=* ]]; then
  # Mechanical check, not just trusting the subprocess's self-report: confirm
  # the commit it claims to have made only touched the allowed paths, and
  # that it actually reached origin/main — the prompt's rails (pathspec-only
  # staging, push to origin main only) are instructions to a `claude -p`
  # session running with --dangerously-skip-permissions, not something this
  # script enforced before now.
  #
  # This repo has a SECOND independent cron writer to origin/main: the
  # social-signals-trader hourly `:47` snapshot push, which never pulls or
  # rebases before pushing and has recorded 16 rejected / 8 non-fast-forward
  # events. This watchdog's own `claude -p` push can lose that race — the
  # seed commit lands locally but the subprocess's push is rejected. Recover
  # by rebasing OUR seed commit onto the freshly fetched origin/main and
  # retrying, bounded, instead of immediately declaring an error. Never a
  # forced/destructive rewrite of history and never touching a commit already
  # on origin — only our own not-yet-pushed seed commit gets replayed.
  SEED_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown-local)"
  git fetch origin main --quiet 2>/dev/null || true

  if git merge-base --is-ancestor "$SEED_COMMIT" origin/main 2>/dev/null; then
    # Edge case: the push may have actually landed even though the earlier
    # status read was ambiguous — detect that instead of re-pushing or
    # double-seeding. Fast-forward local HEAD to match if origin moved past
    # our commit (e.g. a snapshot push landed right after ours); this is a
    # fast-forward-only merge, never a rewrite.
    echo "[blog-cadence-watchdog] seed commit $SEED_COMMIT already present on origin/main — publish had actually landed"
    if [[ "$(git rev-parse HEAD 2>/dev/null)" != "$(git rev-parse origin/main 2>/dev/null)" ]]; then
      git merge --ff-only origin/main --quiet 2>/dev/null || true
    fi
  else
    RECOVERY_MAX_ATTEMPTS=3
    RECOVERY_BACKOFF_SECONDS=10
    RECOVERED=0
    for attempt in $(seq 1 "$RECOVERY_MAX_ATTEMPTS"); do
      PRE_REBASE_STATUS="$(git status --porcelain)"
      if ! REBASE_OUTPUT="$(git rebase origin/main 2>&1)"; then
        echo "[blog-cadence-watchdog] rebase of seed commit onto origin/main hit a conflict on attempt $attempt/$RECOVERY_MAX_ATTEMPTS — aborting, not auto-resolving" >&2
        echo "$REBASE_OUTPUT" >&2
        git rebase --abort 2>/dev/null || true
        write_heartbeat "error: rebase conflict recovering seed commit onto origin/main (attempt $attempt): $(echo "$REBASE_OUTPUT" | tail -1)"
        exit 1
      fi
      POST_REBASE_STATUS="$(git status --porcelain)"
      if [[ "$PRE_REBASE_STATUS" != "$POST_REBASE_STATUS" ]]; then
        echo "[blog-cadence-watchdog] FATAL: unstaged working tree state changed during push-race recovery — aborting" >&2
        write_heartbeat "error: unstaged working tree changed during push-race recovery"
        exit 1
      fi

      if PUSH_OUTPUT="$(git push origin main 2>&1)"; then
        RECOVERED=1
        break
      fi
      if echo "$PUSH_OUTPUT" | grep -qiE 'non-fast-forward|fetch first|\[rejected\]'; then
        echo "[blog-cadence-watchdog] push rejected (non-fast-forward race) on attempt $attempt/$RECOVERY_MAX_ATTEMPTS — refetching origin/main and retrying" >&2
        echo "$PUSH_OUTPUT" >&2
        git fetch origin main --quiet 2>/dev/null || true
        if [[ "$attempt" -lt "$RECOVERY_MAX_ATTEMPTS" ]]; then
          sleep "$RECOVERY_BACKOFF_SECONDS"
        fi
        continue
      fi
      # Rejected for a reason other than a fast-forward race (auth failure,
      # network loss, remote refusing) — not a rebase-able race, straight to
      # the error heartbeat with the actual git stderr recorded.
      echo "[blog-cadence-watchdog] git push origin main failed for a reason other than a fast-forward race — not retrying as a push race" >&2
      echo "$PUSH_OUTPUT" >&2
      write_heartbeat "error: git push origin main failed: $(echo "$PUSH_OUTPUT" | tail -1)"
      exit 1
    done

    if [[ "$RECOVERED" -ne 1 ]]; then
      echo "[blog-cadence-watchdog] FATAL: exhausted $RECOVERY_MAX_ATTEMPTS push-race recovery attempts, seed commit did not reach origin/main" >&2
      write_heartbeat "error: exhausted push-race recovery attempts, local HEAD does not match origin/main"
      exit 1
    fi
  fi

  # The existing post-push safety audit still runs AFTER recovery: the
  # disallowed-path check is against SEED_COMMIT's own diff (stable whether
  # or not a rebase replayed it onto a new parent — the object itself still
  # exists locally), then the final HEAD-matches-origin assertion.
  CHANGED_FILES="$(git diff --name-only "$SEED_COMMIT"~1 "$SEED_COMMIT" 2>/dev/null || true)"
  BAD_PATH=""
  while IFS= read -r changed_file; do
    [[ -z "$changed_file" ]] && continue
    is_allowed=0
    for allowed in "${ALLOWED_COMMIT_PATHS[@]}"; do
      [[ "$changed_file" == "$allowed" ]] && is_allowed=1 && break
    done
    if [[ "$is_allowed" -eq 0 ]]; then
      BAD_PATH="$changed_file"
      break
    fi
  done <<< "$CHANGED_FILES"
  if [[ -n "$BAD_PATH" ]]; then
    echo "[blog-cadence-watchdog] $SEED_LINE — but the last commit touched disallowed path '$BAD_PATH', treating as error" >&2
    write_heartbeat "error: seed commit touched disallowed path $BAD_PATH"
    exit 1
  fi

  git fetch origin main --quiet 2>/dev/null || true
  LOCAL_HEAD="$(git rev-parse HEAD 2>/dev/null || echo unknown-local)"
  REMOTE_HEAD="$(git rev-parse origin/main 2>/dev/null || echo unknown-remote)"
  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "[blog-cadence-watchdog] $SEED_LINE — but local HEAD ($LOCAL_HEAD) does not match origin/main ($REMOTE_HEAD), push did not land" >&2
    write_heartbeat "error: local HEAD does not match origin/main after claimed publish"
    exit 1
  fi
  echo "[blog-cadence-watchdog] $SEED_LINE"

  # --- verify live pickup at /api/blog (gates.7_seed) — the push above is
  # already done and does NOT get reverted/re-pushed on a failure here; this
  # step only reports whether Render's auto-deploy actually surfaced the
  # slug(s) we just seeded, or times out reporting that it didn't. ---
  SEEDED_SLUGS_RAW="$(echo "$SEED_LINE" | grep -oP 'slugs="\K[^"]*' || true)"
  if [[ -z "$SEEDED_SLUGS_RAW" ]]; then
    echo "[blog-cadence-watchdog] $SEED_LINE reported no slugs= field — cannot verify live pickup, recording success as-is" >&2
    write_heartbeat "ok: ${SEED_LINE#SEED_RESULT: }"
  else
    IFS=',' read -r -a SEEDED_SLUGS <<< "$SEEDED_SLUGS_RAW"

    VERIFY_DEPLOY_TIMEOUT_SECONDS="$(grep -m1 'verify_deploy_timeout_seconds:' "$CONFIG_FILE" | grep -oP 'verify_deploy_timeout_seconds:\s*\K\d+')"
    VERIFY_DEPLOY_INTERVAL_SECONDS="$(grep -m1 'verify_deploy_interval_seconds:' "$CONFIG_FILE" | grep -oP 'verify_deploy_interval_seconds:\s*\K\d+')"
    if [[ -z "$VERIFY_DEPLOY_TIMEOUT_SECONDS" || -z "$VERIFY_DEPLOY_INTERVAL_SECONDS" ]]; then
      echo "[blog-cadence-watchdog] FATAL: could not parse verify_deploy_timeout_seconds/verify_deploy_interval_seconds from $CONFIG_FILE" >&2
      write_heartbeat "error: could not parse verify_deploy settings"
      exit 1
    fi

    VERIFY_DEADLINE_EPOCH=$(( $(date +%s) + VERIFY_DEPLOY_TIMEOUT_SECONDS ))
    VERIFY_LIVE=0
    while [[ "$(date +%s)" -lt "$VERIFY_DEADLINE_EPOCH" ]]; do
      # A transient non-array body or curl failure mid-poll counts as "not yet
      # live" — the poll continues to its deadline rather than aborting.
      if POLL_JSON="$(fetch_blog_json 1 0)"; then
        MISSING_SLUGS=()
        for slug in "${SEEDED_SLUGS[@]}"; do
          if ! echo "$POLL_JSON" | jq -e --arg s "$slug" '[.[].slug] | index($s) != null' >/dev/null 2>&1; then
            MISSING_SLUGS+=("$slug")
          fi
        done
        if [[ "${#MISSING_SLUGS[@]}" -eq 0 ]]; then
          VERIFY_LIVE=1
          break
        fi
      fi
      sleep "$VERIFY_DEPLOY_INTERVAL_SECONDS"
    done

    if [[ "$VERIFY_LIVE" -eq 1 ]]; then
      VERIFY_OBSERVED_AT="$(TZ=America/Los_Angeles date -Iseconds)"
      echo "[blog-cadence-watchdog] live pickup verified at https://bilko.run/api/blog for slug(s): ${SEEDED_SLUGS[*]} (observed $VERIFY_OBSERVED_AT) — https://bilko.run/blog/${SEEDED_SLUGS[0]}"
      write_heartbeat "ok: ${SEED_LINE#SEED_RESULT: } live_at=$VERIFY_OBSERVED_AT slugs=${SEEDED_SLUGS[*]}"
    else
      echo "[blog-cadence-watchdog] FATAL: seeded slug(s) not live at https://bilko.run/api/blog after ${VERIFY_DEPLOY_TIMEOUT_SECONDS}s: ${SEEDED_SLUGS[*]}" >&2
      write_heartbeat "error: seeded slug(s) not live after ${VERIFY_DEPLOY_TIMEOUT_SECONDS}s: ${SEEDED_SLUGS[*]}"
      exit 1
    fi
  fi
else
  echo "[blog-cadence-watchdog] claude -p exited 0 but printed no SEED_RESULT line — cannot confirm outcome" >&2
  write_heartbeat "error: no SEED_RESULT line from claude -p mode=$MODE gap=${GAP_DAYS}d"
  exit 1
fi

echo "[blog-cadence-watchdog] done"
