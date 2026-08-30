#!/usr/bin/env bash
# Daily watchdog for the bilko.run blog's declared 3-5 day cadence
# (.claude/skills/blog-from-git/blog.config.yaml cadence.target_gap_days).
# Nothing else enforces that cadence — /blog-from-git only ever runs when a
# human types it — so before this script existed a publishing gap could grow
# indefinitely and silently (see PRD: gap reached 36 days on 2026-08-29).
#
# What this script does when the live gap blows the target:
#   shells out to `claude -p` (model pinned, see shared/core.md's hard rule)
#   to run ONLY phases 1-5 of the blog-from-git skill (Rotation, Scan,
#   Research, Ground, Draft) and write draft markdown file(s) to
#   .claude/skills/blog-from-git/drafts/. It STOPS there.
#
# HUMAN GATE — READ THIS: this script never seeds, never publishes, never
# touches server/db.ts or blog-ledger.md, never commits, never pushes. Phase
# 6 (Approve) and phase 7 (Seed) in .claude/skills/blog-from-git/SKILL.md
# require an explicit human OK and stay entirely manual. To publish a draft
# this watchdog produced:
#   1. Read the draft(s) under .claude/skills/blog-from-git/drafts/
#   2. If it reads right, tell Claude (interactively) to seed it — e.g.
#      "seed the draft at .claude/skills/blog-from-git/drafts/<file>.md"
#      so a human-driven session runs phase 6 (approve) then phase 7 (seed:
#      db.ts + ledger + push), per seed.md.
#   3. If it doesn't read right, edit the draft or delete it — nothing
#      downstream depends on it until a human seeds it.
#
# Mirrors the cron-script conventions in
# ~/Projects/social-signals-trader/scripts/analyst-tick.sh: lockfile in
# /tmp, PATH fix for cron's bare env, bounded timeout, log via cron redirect.
set -euo pipefail
cd "$(dirname "$0")/.."

# cron runs with a bare PATH; the claude CLI lives in ~/.local/bin.
export PATH="$HOME/.local/bin:$PATH"

LOCKFILE="/tmp/bilko.blog-cadence-watchdog.lock"
exec 9>"$LOCKFILE"
if ! flock -n 9; then
  echo "[blog-cadence-watchdog] another instance running — skipping" >&2
  exit 0
fi

CONFIG_FILE=".claude/skills/blog-from-git/blog.config.yaml"
DRAFTS_DIR=".claude/skills/blog-from-git/drafts"
STATE_FILE="$DRAFTS_DIR/.watchdog-state"

# --- read cadence policy from the config file — never hard-code it here ---
UPPER_BOUND="$(grep -m1 'target_gap_days:' "$CONFIG_FILE" | grep -oP '\[\d+,\s*\K\d+')"
CATCHUP_TRIGGER="$(grep -m1 'catchup_trigger_days:' "$CONFIG_FILE" | grep -oP 'catchup_trigger_days:\s*\K\d+')"
if [[ -z "$UPPER_BOUND" || -z "$CATCHUP_TRIGGER" ]]; then
  echo "[blog-cadence-watchdog] FATAL: could not parse cadence thresholds from $CONFIG_FILE" >&2
  exit 1
fi

# --- measure the LIVE gap, not server/db.ts's seed data ---
BLOG_JSON="$(curl -s --max-time 20 https://bilko.run/api/blog)"
NEWEST_PUBLISHED_AT="$(echo "$BLOG_JSON" | jq -r '[.[].published_at] | max')"
if [[ -z "$NEWEST_PUBLISHED_AT" || "$NEWEST_PUBLISHED_AT" == "null" ]]; then
  echo "[blog-cadence-watchdog] FATAL: could not read published_at from https://bilko.run/api/blog" >&2
  exit 1
fi

TODAY="$(TZ=America/Los_Angeles date +%F)"
NOW_EPOCH="$(TZ=America/Los_Angeles date +%s)"
PUB_EPOCH="$(date -d "$NEWEST_PUBLISHED_AT" +%s)"
GAP_DAYS=$(( (NOW_EPOCH - PUB_EPOCH) / 86400 ))

echo "[blog-cadence-watchdog] $TODAY (PT): newest live post=$NEWEST_PUBLISHED_AT gap_days=$GAP_DAYS target_upper=$UPPER_BOUND catchup_trigger=$CATCHUP_TRIGGER"

if (( GAP_DAYS < UPPER_BOUND )); then
  echo "[blog-cadence-watchdog] within cadence — no action"
  exit 0
fi

# --- idempotent per day: a second run on the same day is a no-op ---
mkdir -p "$DRAFTS_DIR"
if [[ -f "$STATE_FILE" ]]; then
  LAST_RUN_DATE="$(cut -d' ' -f1 "$STATE_FILE" 2>/dev/null || true)"
  if [[ "$LAST_RUN_DATE" == "$TODAY" ]]; then
    echo "[blog-cadence-watchdog] already drafted today per $STATE_FILE — skipping"
    exit 0
  fi
fi

if (( GAP_DAYS >= CATCHUP_TRIGGER )); then
  MODE="catchup"
  MODE_INSTRUCTIONS="Catch-up mode (gap ${GAP_DAYS}d >= catchup_trigger_days ${CATCHUP_TRIGGER}d): scan the WHOLE portfolio's activity since the last live post ($NEWEST_PUBLISHED_AT) via GitHub (per scan.md — gh, not local working trees, for pushed repos; local reconciliation for unpushed/no-remote repos per the ledger's watchlist) and produce a QUEUE of separate, normal-sized backdated posts at 3-5 day cadence, each honestly dated to when its work actually shipped (blog.config.yaml backdating: honest-only), per rotation.md Part 0.5. Write one draft file per queued post."
else
  MODE="portfolio"
  MODE_INSTRUCTIONS="Portfolio mode (gap ${GAP_DAYS}d, no project named): scan the whole portfolio's activity since the last live post ($NEWEST_PUBLISHED_AT) via GitHub (per scan.md) and draft ONE arc post spanning the repos that moved."
fi

PROMPT="You are running unattended, triggered by a cron watchdog (scripts/blog-cadence-watchdog.sh) because the bilko.run blog's live publishing gap is ${GAP_DAYS} days, past its ${UPPER_BOUND}-day cadence target. There is NO human present in this session.

Follow the blog-from-git skill (.claude/skills/blog-from-git/SKILL.md) but run PHASES 1-5 ONLY: 1 Rotation (read rotation.md + blog-ledger.md — respect never_repeat_previous_project and max_consecutive_untiled_posts), 2 Scan, 3 Research, 4 Ground, 5 Draft (voice.md).

$MODE_INSTRUCTIONS

STOP AFTER PHASE 5. Do not run phase 6 (Approve) or phase 7 (Seed) — this repo's editorial gate requires an EXPLICIT human OK before any post is seeded or published, and no human is present to give it. Concretely, in this run you must NOT:
- edit server/db.ts
- edit or append to blog-ledger.md
- run git add, git commit, or git push
- seed or publish anything

Instead, write each finished draft as a standalone markdown file (front matter: title, slug, category, published_at, tone) under .claude/skills/blog-from-git/drafts/<published-date-YYYY-MM-DD>-<slug>.md, creating the directory if needed. When done, print a one-line list of the draft file path(s) you wrote and nothing else."

echo "[blog-cadence-watchdog] mode=$MODE — invoking claude -p to draft (phases 1-5 only, stopping before approve/seed)"

set +e
timeout 2400 claude -p "$PROMPT" \
  --model claude-sonnet-5 \
  --dangerously-skip-permissions \
  --output-format text
CLAUDE_RC=$?
set -e

if [[ $CLAUDE_RC -ne 0 ]]; then
  echo "[blog-cadence-watchdog] claude -p exited $CLAUDE_RC (timed out or errored) — will retry next scheduled run" >&2
  exit "$CLAUDE_RC"
fi

echo "$TODAY $MODE $GAP_DAYS" > "$STATE_FILE"
echo "[blog-cadence-watchdog] done — drafts (if any) are in $DRAFTS_DIR, awaiting human review/seed"
