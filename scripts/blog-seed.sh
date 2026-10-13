#!/usr/bin/env bash
# Usage: bash scripts/blog-seed.sh --bundle <abs_dir>
#
# Entrypoint for Burrow's blog publisher (blog-from-git phase 7, "seed"). <abs_dir> holds a
# human-reviewed post.md (frontmatter slug,title,excerpt,category; optional published_at,
# project, tone) and an optional images/ dir. No claude -p is used: the file writes are
# deterministic (scripts/blog-seed-apply.ts).
#
# Writes content/blog/<slug>.md (body verbatim), public/blog-images/<slug>/, and the
# blog-ledger.md row + rotation state; runs the cadence + readability gates; makes ONE commit
# with explicit pathspecs; pushes to origin main; polls /api/blog until the slug is live.
#
# stdout: only the final JSON line {"slug","url","commit","published_at"}. Logs go to stderr.
# Exit: 0 live | 1 error | 2 bad bundle/arguments (nothing committed) | 3 cadence gate refused
#       (tree and HEAD unchanged; Burrow retries next hour) | 4 readability gate failed
#       (nothing written) | 5 pushed but not live before the poll timeout.
# Test-only env overrides: BLOG_SEED_REPO_ROOT, BLOG_SEED_API_URL, BLOG_SEED_VERIFY_TIMEOUT,
# BLOG_SEED_VERIFY_INTERVAL, BLOG_SEED_PUSH_BACKOFF.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${BLOG_SEED_REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
# shellcheck source=blog-pipeline-lib.sh
source "$SCRIPT_DIR/blog-pipeline-lib.sh"

START_EPOCH="$(date +%s)"
TOTAL_BUDGET_SECONDS=1440            # Burrow kills at 1500s
GATE_TIMEOUT=180
READABILITY_TIMEOUT=120
API_URL="${BLOG_SEED_API_URL:-https://bilko.run/api/blog}"
PUSH_BACKOFF="${BLOG_SEED_PUSH_BACKOFF:-10}"
CONFIG_REL=".claude/skills/blog-from-git/blog.config.yaml"
LEDGER_REL=".claude/skills/blog-from-git/blog-ledger.md"

log() { echo "[blog-seed] $*" >&2; }
usage() { echo "usage: bash scripts/blog-seed.sh --bundle <abs_dir>" >&2; }
die() { log "error: $1"; exit "${2:-1}"; }

BUNDLE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle) BUNDLE="${2:-}"; shift 2 || { usage; exit 2; } ;;
    *) usage; exit 2 ;;
  esac
done
[[ -n "$BUNDLE" && "$BUNDLE" == /* ]] || { usage; die "--bundle must be an absolute directory path" 2; }
BUNDLE="${BUNDLE%/}"
[[ -d "$BUNDLE" ]] || die "bundle $BUNDLE is not a directory" 2
[[ -f "$BUNDLE/post.md" ]] || die "bundle $BUNDLE has no post.md" 2
VALIDATION="$(bp_validate_post "$BUNDLE/post.md" "$BUNDLE")" || die "$VALIDATION" 2
SLUG="$(bp_fm_get "$BUNDLE/post.md" slug)"
TITLE="$(bp_fm_get "$BUNDLE/post.md" title)"

MISSING="$(bp_missing_seed_binaries)"
[[ -z "$MISSING" ]] || die "required binaries not on PATH: $MISSING"

cd "$REPO_ROOT" || die "cannot cd to $REPO_ROOT"
CONFIG_FILE="$REPO_ROOT/$CONFIG_REL"
[[ -f "$CONFIG_FILE" ]] || die "missing $CONFIG_REL"

# --- rails: right repo, right branch, one run at a time ---
REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
[[ "$REMOTE_URL" == *"StanislavBG/bilko-run"* ]] \
  || die "origin does not resolve to StanislavBG/bilko-run (got: '$REMOTE_URL') — refusing to seed/push"
[[ "$(git symbolic-ref --short HEAD 2>/dev/null || true)" == "main" ]] || die "HEAD is not on branch main"
exec 9>"$(git rev-parse --git-dir)/blog-seed.lock"
flock -n 9 || die "another blog-seed run holds the lock"

ALLOWED_PATHS_AWK='
  /allowed_commit_paths:/ { flag=1; next }
  flag && /^[[:space:]]*$/ { next }
  flag && /^[[:space:]]*#/ { next }
  flag && /^[[:space:]]*-[[:space:]]*/ { print; next }
  flag { exit }
'
ALLOWED=()
while IFS= read -r raw; do
  p="$(echo "$raw" | sed -E 's/^[[:space:]]*-[[:space:]]*//; s/[[:space:]]*#.*$//')"
  [[ -n "$p" ]] && ALLOWED+=("$p")
done < <(awk "$ALLOWED_PATHS_AWK" "$CONFIG_FILE")
[[ "${#ALLOWED[@]}" -gt 0 ]] || die "could not parse autonomy.allowed_commit_paths from $CONFIG_REL"

cfg_int() { grep -m1 "$1:" "$CONFIG_FILE" | grep -oP "$1:\s*\K\d+" || true; }
VERIFY_TIMEOUT="${BLOG_SEED_VERIFY_TIMEOUT:-$(cfg_int verify_deploy_timeout_seconds)}"
VERIFY_INTERVAL="${BLOG_SEED_VERIFY_INTERVAL:-$(cfg_int verify_deploy_interval_seconds)}"
[[ -n "$VERIFY_TIMEOUT" && -n "$VERIFY_INTERVAL" ]] || die "could not parse verify_deploy_* from $CONFIG_REL"

POST_REL="content/blog/$SLUG.md"
IMAGES_REL="public/blog-images/$SLUG"
PATHS=()
LEDGER_BACKUP="$(mktemp)"
trap 'unlink "$LEDGER_BACKUP" 2>/dev/null' EXIT

emit_result() {  # <commit> <published_at>
  printf '{"slug":"%s","url":"https://bilko.run/blog/%s","commit":"%s","published_at":"%s"}\n' "$SLUG" "$SLUG" "$1" "$2"
}

# Only ever removes UNTRACKED files under our own two pathspecs (git clean never touches tracked ones).
remove_written_files() { git clean -fdq -- "$POST_REL" "$IMAGES_REL"; }
rollback_files() {
  remove_written_files
  [[ -s "$LEDGER_BACKUP" ]] && cp "$LEDGER_BACKUP" "$REPO_ROOT/$LEDGER_REL"
}
rollback_commit() {  # undo our (possibly rebased) top commit, leave the rest of the tree alone
  git reset -q --soft HEAD~1
  git reset -q -- "${PATHS[@]}"
  remove_written_files
  git checkout -q -- "$LEDGER_REL"
}

poll_live() {  # <published_at> <commit>
  local deadline now remaining body budget_end
  budget_end=$(( START_EPOCH + TOTAL_BUDGET_SECONDS ))
  deadline=$(( $(date +%s) + VERIFY_TIMEOUT ))
  (( deadline > budget_end )) && deadline=$budget_end
  while :; do
    if body="$(curl -s --max-time 20 "$API_URL")" \
      && echo "$body" | jq -e --arg s "$SLUG" 'type == "array" and ([.[].slug] | index($s) != null)' >/dev/null 2>&1; then
      log "live: https://bilko.run/blog/$SLUG"
      emit_result "$2" "$1"
      exit 0
    fi
    now="$(date +%s)"
    remaining=$(( deadline - now ))
    (( remaining <= 0 )) && break
    sleep $(( VERIFY_INTERVAL < remaining ? VERIFY_INTERVAL : remaining ))
  done
  die "pushed $2 but '$SLUG' is not live at $API_URL after the poll window" 5
}

# --- retry after a push that landed but never went live: skip straight to the poll ---
git fetch origin main --quiet 2>/dev/null || true
if git cat-file -e "origin/main:$POST_REL" 2>/dev/null; then
  log "$SLUG is already on origin/main — only verifying it is live"
  EXISTING_PUBLISHED_AT="$(git show "origin/main:$POST_REL" | bp_fm_get /dev/stdin published_at)"
  poll_live "$EXISTING_PUBLISHED_AT" "$(git log -1 --format=%H origin/main -- "$POST_REL")"
fi
[[ ! -e "$REPO_ROOT/$POST_REL" && ! -e "$REPO_ROOT/$IMAGES_REL" ]] || die "$POST_REL or $IMAGES_REL already exists locally but not on origin/main" 2

# --- readability gate on the bundle post (nothing written yet) ---
timeout "$READABILITY_TIMEOUT" npx tsx "$SCRIPT_DIR/blog-readability.ts" "$BUNDLE/post.md" >&2
rc=$?
[[ $rc -eq 0 ]] || die "readability check failed (rc=$rc)" 4

# --- write files ---
cp "$REPO_ROOT/$LEDGER_REL" "$LEDGER_BACKUP"
APPLY_OUT="$(pnpm tsx "$SCRIPT_DIR/blog-seed-apply.ts" --bundle "$BUNDLE" --root "$REPO_ROOT")"
rc=$?
if [[ $rc -ne 0 ]]; then
  rollback_files
  die "apply step failed (rc=$rc)" "$([[ $rc -eq 2 ]] && echo 2 || echo 1)"
fi
PUBLISHED_AT="$(echo "$APPLY_OUT" | jq -r '.published_at')"
mapfile -t PATHS < <(echo "$APPLY_OUT" | jq -r '.paths[]')
[[ -n "$PUBLISHED_AT" && "${#PATHS[@]}" -gt 0 ]] || { rollback_files; die "apply step printed unexpected output"; }

for p in "${PATHS[@]}"; do
  ok=0
  for a in "${ALLOWED[@]}"; do
    [[ "$p" == "$a" || ( "$a" == */ && "$p" == "$a"* ) ]] && ok=1 && break
  done
  [[ $ok -eq 1 ]] || { rollback_files; die "refusing to stage $p — not in autonomy.allowed_commit_paths"; }
done

# --- hard cadence gate (the written post is part of what it checks) ---
GATE_OUT="$(timeout "$GATE_TIMEOUT" pnpm tsx scripts/blog-cadence-gate.ts check 2>&1)"
rc=$?
if [[ $rc -ne 0 ]]; then
  rollback_files
  echo "$GATE_OUT" >&2
  if [[ $rc -eq 1 ]]; then log "cadence gate refused — nothing committed"; exit 3; fi
  die "cadence gate could not run (rc=$rc)"
fi

# --- one commit, explicit pathspecs only ---
git add -- "${PATHS[@]}" \
  && git commit -q -m "feat(blog): publish $SLUG" -m "Seeded by scripts/blog-seed.sh from a Burrow-reviewed bundle: $TITLE" -- "${PATHS[@]}" \
  || { git reset -q -- "${PATHS[@]}" 2>/dev/null; rollback_files; die "git commit failed"; }

# --- push to origin main only, with the watchdog's fetch/rebase push-race recovery ---
PUSH_OUTPUT="$(git push origin main 2>&1)"
if [[ $? -ne 0 ]]; then
  if ! echo "$PUSH_OUTPUT" | grep -qiE 'non-fast-forward|fetch first|\[rejected\]'; then
    echo "$PUSH_OUTPUT" >&2
    rollback_commit
    die "git push origin main failed for a reason other than a fast-forward race"
  fi
  RECOVERED=0
  for attempt in 1 2 3; do
    log "push rejected (race) — rebasing onto origin/main, attempt $attempt/3"
    git fetch origin main --quiet 2>/dev/null || true
    PRE_STATUS="$(git status --porcelain)"
    if ! REBASE_OUTPUT="$(git rebase --autostash origin/main 2>&1)"; then
      echo "$REBASE_OUTPUT" >&2
      git rebase --abort 2>/dev/null || true
      rollback_commit
      die "rebase conflict recovering the seed commit onto origin/main"
    fi
    [[ "$(git status --porcelain)" == "$PRE_STATUS" ]] || die "working tree changed during push-race recovery — aborting"
    if PUSH_OUTPUT="$(git push origin main 2>&1)"; then RECOVERED=1; break; fi
    echo "$PUSH_OUTPUT" | grep -qiE 'non-fast-forward|fetch first|\[rejected\]' || { echo "$PUSH_OUTPUT" >&2; rollback_commit; die "git push origin main failed"; }
    sleep "$PUSH_BACKOFF"
  done
  [[ $RECOVERED -eq 1 ]] || { rollback_commit; die "exhausted push-race recovery attempts"; }
fi

git fetch origin main --quiet 2>/dev/null || true
COMMIT="$(git rev-parse HEAD)"
git merge-base --is-ancestor "$COMMIT" origin/main 2>/dev/null || die "pushed commit $COMMIT is not on origin/main"
log "pushed $COMMIT to origin main"

poll_live "$PUBLISHED_AT" "$COMMIT"
