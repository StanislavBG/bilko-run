#!/usr/bin/env bash
# Usage: bash scripts/blog-seed.sh --bundle <abs_dir>
#
# Entrypoint for Burrow's blog publisher (blog-from-git phase 7, "seed"). <abs_dir> holds a
# human-reviewed post.md (frontmatter slug,title,excerpt,category; optional published_at,
# project, tone) and an optional images/ dir. No claude -p is used: the file writes are
# deterministic (scripts/blog-seed-apply.ts).
#
# The commit is built in a throwaway worktree at a freshly fetched origin/main, never on local
# main: local main carries unpushed Session Manager merges, and it is not this script's job to
# publish them. In that worktree it writes content/blog/<slug>.md (body verbatim),
# public/blog-images/<slug>/ and the blog-ledger.md row + rotation state, runs the cadence gate
# on that tree, and makes ONE commit with explicit pathspecs. A guard refuses the push unless the
# commit is exactly one commit on top of origin/main touching only autonomy.allowed_commit_paths.
# It pushes <sha>:main (a push race refetches and rebuilds; it never rebases local commits),
# mirrors the commit onto local main (best effort), and polls /api/blog until the slug is live.
#
# stdout: only the final JSON line {"slug","url","commit","published_at"}. Logs go to stderr.
# Exit: 0 live | 1 error, nothing pushed unless the log says so (safe to retry) | 2 bad
#       bundle/arguments (nothing committed) | 3 cadence gate refused (nothing committed; Burrow
#       treats this as final) | 4 readability gate failed (nothing written) | 5 pushed but not
#       live before the poll timeout (a retry only polls).
# The live checkout's working tree and index are never written, except by that mirror commit.
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
WT_PARENT=""
WT=""

remove_worktree() {
  [[ -n "$WT" ]] && git worktree remove --force "$WT" >/dev/null 2>&1
  [[ -n "$WT_PARENT" ]] && rm -rf "$WT_PARENT"
  WT=""; WT_PARENT=""
}
trap remove_worktree EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
# A killed run (SIGKILL skips the trap) can leave its worktree registered; we hold the lock.
while IFS= read -r line; do
  [[ "$line" == "worktree "*/blog-seed.*/tree ]] && git worktree remove --force "${line#worktree }" >/dev/null 2>&1
done < <(git worktree list --porcelain)
git worktree prune 2>/dev/null || true

emit_result() {  # <commit> <published_at>
  printf '{"slug":"%s","url":"https://bilko.run/blog/%s","commit":"%s","published_at":"%s"}\n' "$SLUG" "$SLUG" "$1" "$2"
}

path_allowed() {  # <repo-relative path>
  local a
  for a in "${ALLOWED[@]}"; do
    [[ "$1" == "$a" || ( "$a" == */ && "$1" == "$a"* ) ]] && return 0
  done
  return 1
}

# The push guard: <sha> is exactly one non-merge commit on top of <base>, it adds this post, and it
# touches only autonomy.allowed_commit_paths. Nothing else in this repo can ride along to origin.
seed_commit_ok() {  # <base> <sha>
  local base f has_post=0
  base="$(git rev-parse --verify -q "$1^{commit}")" || return 1
  [[ "$(git rev-list --count "$base..$2")" == 1 && "$(git rev-parse "$2^@")" == "$base" ]] || return 1
  while IFS= read -r -d '' f; do
    path_allowed "$f" || return 1
    [[ "$f" == "$POST_REL" ]] && has_post=1
  done < <(git diff -z --name-only --no-renames "$base" "$2")
  [[ $has_post -eq 1 ]]
}

# Mirror a pushed seed commit onto local main so its blog paths match production. Best effort:
# the post is already on origin, so a dirty or conflicting ledger is logged, never forced.
mirror_to_local_main() {  # <sha>
  local out
  git cat-file -e "HEAD:$POST_REL" 2>/dev/null && return 0
  seed_commit_ok "$1^" "$1" || { log "warning: $1 is not a lone seed commit; local main not updated"; return 0; }
  if [[ "$(git rev-parse HEAD)" == "$(git rev-parse "$1^")" ]]; then
    out="$(git merge -q --ff-only "$1" 2>&1)" && return 0
  else
    out="$(git cherry-pick -x "$1" 2>&1)" && { log "mirrored $1 onto local main as $(git rev-parse --short HEAD)"; return 0; }
    git rev-parse -q --verify CHERRY_PICK_HEAD >/dev/null && git cherry-pick --abort >/dev/null 2>&1
  fi
  echo "$out" >&2
  log "warning: could not mirror $1 onto local main; its blog files lag origin/main until: git cherry-pick -x $1"
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

fetch_origin() {
  git fetch origin main --quiet || die "git fetch origin main failed"
  BASE="$(git rev-parse --verify -q 'origin/main^{commit}')" || die "no origin/main after fetch"
}

# --- retry after a push that landed but never went live: skip straight to the poll ---
poll_if_on_origin() {
  git cat-file -e "origin/main:$POST_REL" 2>/dev/null || return 0
  log "$SLUG is already on origin/main — only verifying it is live"
  local existing_commit existing_published_at
  existing_commit="$(git log -1 --format=%H origin/main -- "$POST_REL")"
  existing_published_at="$(git show "origin/main:$POST_REL" | bp_fm_get /dev/stdin published_at)"
  mirror_to_local_main "$existing_commit"
  poll_live "$existing_published_at" "$existing_commit"
}

fetch_origin
poll_if_on_origin
[[ ! -e "$REPO_ROOT/$POST_REL" && ! -e "$REPO_ROOT/$IMAGES_REL" ]] || die "$POST_REL or $IMAGES_REL already exists locally but not on origin/main" 2

# --- readability gate on the bundle post (nothing written yet) ---
timeout "$READABILITY_TIMEOUT" npx tsx "$SCRIPT_DIR/blog-readability.ts" "$BUNDLE/post.md" >&2
rc=$?
[[ $rc -eq 0 ]] || die "readability check failed (rc=$rc)" 4

# Builds the seed commit on <base> in a fresh worktree. Only the paths the apply step reads are
# checked out; the index holds all of <base>, so the commit changes nothing else. Sets SHA,
# PUBLISHED_AT, PATHS. Exits 3 if the cadence gate refuses that tree.
build_seed_commit() {  # <base>
  local apply_out gate_out rc p
  remove_worktree
  WT_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/blog-seed.XXXXXX")" || die "mktemp failed"
  WT="$WT_PARENT/tree"
  git worktree add --detach --no-checkout --quiet "$WT" "$1" \
    && git -C "$WT" read-tree "$1" \
    && git -C "$WT" checkout -- content/blog src/data/standalone-projects.json "$LEDGER_REL" \
    || die "could not create a seed worktree at origin/main ($1)"

  apply_out="$(pnpm tsx "$SCRIPT_DIR/blog-seed-apply.ts" --bundle "$BUNDLE" --root "$WT")"
  rc=$?
  [[ $rc -eq 0 ]] || die "apply step failed (rc=$rc)" "$([[ $rc -eq 2 ]] && echo 2 || echo 1)"
  PUBLISHED_AT="$(echo "$apply_out" | jq -r '.published_at')"
  mapfile -t PATHS < <(echo "$apply_out" | jq -r '.paths[]')
  [[ -n "$PUBLISHED_AT" && "${#PATHS[@]}" -gt 0 ]] || die "apply step printed unexpected output"
  for p in "${PATHS[@]}"; do
    path_allowed "$p" || die "refusing to stage $p — not in autonomy.allowed_commit_paths"
  done

  # hard cadence gate on what will go live: origin/main's posts plus this one
  gate_out="$(timeout "$GATE_TIMEOUT" pnpm tsx "$SCRIPT_DIR/blog-cadence-gate.ts" check --root "$WT" 2>&1)"
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo "$gate_out" >&2
    if [[ $rc -eq 1 ]]; then log "cadence gate refused — nothing committed"; exit 3; fi
    die "cadence gate could not run (rc=$rc)"
  fi

  git -C "$WT" add -- "${PATHS[@]}" \
    && git -C "$WT" commit -q -m "feat(blog): publish $SLUG" -m "Seeded by scripts/blog-seed.sh from a Burrow-reviewed bundle: $TITLE" \
    || die "git commit failed"
  SHA="$(git -C "$WT" rev-parse HEAD)"
}

# --- one commit on origin/main, pushed as <sha>:main; a push race rebuilds on the new tip ---
PUSHED=0
for attempt in 1 2 3; do
  (( attempt > 1 )) && { fetch_origin; poll_if_on_origin; }
  build_seed_commit "$BASE"
  seed_commit_ok "$BASE" "$SHA" \
    || die "refusing to push $SHA: not exactly one commit on origin/main touching only autonomy.allowed_commit_paths"
  if PUSH_OUTPUT="$(git push origin "$SHA:refs/heads/main" 2>&1)"; then PUSHED=1; break; fi
  echo "$PUSH_OUTPUT" | grep -qiE 'non-fast-forward|fetch first|\[rejected\]' \
    || { echo "$PUSH_OUTPUT" >&2; die "git push origin $SHA:main failed for a reason other than a fast-forward race"; }
  log "push rejected (race) — rebuilding on the new origin/main, attempt $attempt/3"
  sleep "$PUSH_BACKOFF"
done
[[ $PUSHED -eq 1 ]] || die "exhausted push-race attempts; nothing pushed"
remove_worktree

git fetch origin main --quiet 2>/dev/null || true
git merge-base --is-ancestor "$SHA" origin/main 2>/dev/null || die "pushed commit $SHA is not on origin/main"
log "pushed $SHA to origin main"
mirror_to_local_main "$SHA"

poll_live "$PUBLISHED_AT" "$SHA"
