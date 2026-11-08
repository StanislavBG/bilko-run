#!/usr/bin/env bash
# Usage: bash scripts/sync-local-main.sh [--dry-run] [--no-push]
#
# Puts the live checkout's local main back on top of origin/main. Local main drifts because
# scheduler plans commit their work and their validation/ship records to it, while a Ship PRD
# pushes only a cherry-picked copy of the feature commit. The blog seed, Burrow's video publisher
# and blog withdraw, and the bilko-host publisher push from their own worktrees. So local main
# falls behind and collects twins: the same patch under another sha.
#
# In a throwaway worktree at a freshly fetched origin/main it:
#   1. drops local commits whose patch is already on origin/main (git cherry),
#   2. replays record-only commits (every path under session-manager-operations/reviews/) and
#      pushes them to origin main as they are, since they are plan logs, not product code,
#   3. replays every other local commit on top, in order. It never pushes them,
#   4. moves local main there with `git reset --keep`, keeping uncommitted files.
# Commits already on top of origin/main keep their shas (cherry-pick --ff). A strictly-ahead local
# main with nothing to publish is left untouched: no push, no backup overwrite, no reset.
# Unshipped product commits end up strictly ahead of origin/main. Nothing changes if a replay
# conflicts, local main has merge commits, a dirty file is in the way, or local main moves meanwhile.
# The old tip is kept as branch backup/main-pre-sync (overwritten on each sync).
#
# --no-push never runs git push. Step 2 goes away: record-only commits stay local and step 3
# replays them with the rest, every commit in its original order. A publisher runs this right after
# its own push to catch local main up without publishing anyone else's commits. A behind-only local
# main is fast-forwarded, a strictly-ahead one is left untouched, and every other rule above holds.
# Callers, each right after its push: scripts/blog-seed.sh and the bilko-host publisher in this
# repo; Burrow's video publisher and blog withdraw outside it. Burrow's two release
# .git/blog-seed.lock, then run `bash <checkout>/scripts/sync-local-main.sh --no-push` with
# BILKO_SYNC_REPO_ROOT set to the checkout. The seed releases the lock before calling too.
# --dry-run, alone or with --no-push in either order, reports what would happen and changes nothing.
#
# Contract that callers outside this repo rely on. Tell Burrow (/send-feedback) before changing any
# of it (docs/repo-writers.md, "Callers of `scripts/sync-local-main.sh` outside this repo"):
#   - Flags: --no-push and --dry-run, in any order. Any other non-empty argument exits 1 with the
#     usage line, before the lock or any git command.
#   - Exit: 0 in sync or synced | 1 error, local main untouched | 3 needs a human: a replay
#     conflicts or local main has merge commits (CLAUDE.md, "Local main must match origin/main").
#   - Lock: `flock -w 120` on .git/blog-seed.lock, the lock scripts/blog-seed.sh and Burrow's two
#     writers take. A caller holding it must release it first, or this waits 120s and exits 1.
#   - BILKO_SYNC_REPO_ROOT: the checkout to sync (default: the one this script is in). Callers
#     outside this repo set it; it is not test-only.
#   - Logging: stderr only, never stdout. Burrow's warning quotes the last line.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${BILKO_SYNC_REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
RECORDS_PREFIX="session-manager-operations/reviews/"
DRY=0; NO_PUSH=0
for arg in "$@"; do
  case "$arg" in
    "") ;;
    --dry-run) DRY=1 ;;
    --no-push) NO_PUSH=1 ;;
    *) echo "usage: bash scripts/sync-local-main.sh [--dry-run] [--no-push]" >&2; exit 1 ;;
  esac
done

log() { echo "[sync-local-main] $*" >&2; }
die() { log "error: $1"; exit "${2:-1}"; }

cd "$REPO_ROOT" || die "cannot cd to $REPO_ROOT"
[[ "$(git remote get-url origin 2>/dev/null)" == *"StanislavBG/bilko-run"* ]] || die "origin is not StanislavBG/bilko-run"
[[ "$(git symbolic-ref --short HEAD 2>/dev/null)" == main ]] || die "HEAD is not on branch main"
# Same lock as scripts/blog-seed.sh and Burrow's video publisher and blog withdraw: they also move
# local main. A caller holding it must release it before running this (see the header).
exec 9>"$(git rev-parse --git-dir)/blog-seed.lock"
flock -w 120 9 || die "the blog-seed lock stayed busy for 120s"

git fetch -q origin main || die "git fetch origin main failed"
OLD="$(git rev-parse main)"
BASE="$(git rev-parse origin/main)"
if [[ "$OLD" == "$BASE" ]]; then log "in sync at ${BASE:0:8}"; exit 0; fi
if git merge-base --is-ancestor "$OLD" "$BASE"; then
  (( DRY )) && { log "would fast-forward local main to ${BASE:0:8}"; exit 0; }
  git merge -q --ff-only "$BASE" >&2 || die "fast-forward blocked; a dirty file is probably in the way"
  log "fast-forwarded to ${BASE:0:8}"
  exit 0
fi
[[ -z "$(git rev-list --merges origin/main..main)" ]] || die "local main has merge commits that are not on origin/main; sync by hand" 3

# git cherry lists the + commits oldest first. --no-push keeps them all in that one list, records
# included, so RECORDS stays empty and nothing is published.
RECORDS=(); OTHERS=()
while read -r mark sha; do
  [[ "$mark" == "+" ]] || continue
  if (( NO_PUSH )) || git diff-tree --no-commit-id --name-only -r --no-renames "$sha" | grep -qv "^$RECORDS_PREFIX"; then
    OTHERS+=("$sha")
  else
    RECORDS+=("$sha")
  fi
done < <(git cherry origin/main main)
if (( NO_PUSH )); then
  log "local main: ${#OTHERS[@]} commit(s) to keep on top in order, records included (--no-push: nothing is pushed), rest already on origin"
else
  log "local main: ${#RECORDS[@]} record commit(s) to publish, ${#OTHERS[@]} unshipped commit(s) to keep on top, rest already on origin"
fi

WT_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/sync-local-main.XXXXXX")" || die "mktemp failed"
WT="$WT_PARENT/tree"
cleanup() { git worktree remove --force "$WT" >/dev/null 2>&1; rm -rf "$WT_PARENT"; }
trap cleanup EXIT
git worktree add -q --detach "$WT" "$BASE" || die "could not create a worktree at origin/main"

replay() {  # <sha>: cherry-pick onto the worktree; an already-applied patch is skipped
  git -C "$WT" cherry-pick --ff "$1" >/dev/null 2>&1 && return 0
  if [[ -z "$(git -C "$WT" diff --name-only --diff-filter=U)" ]]; then
    git -C "$WT" cherry-pick --skip >/dev/null 2>&1 && return 0
  fi
  git -C "$WT" cherry-pick --abort >/dev/null 2>&1
  die "$(git log -1 --format='%h %s' "$1") does not apply on origin/main; local main untouched" 3
}

for c in "${RECORDS[@]}"; do replay "$c"; done
RECORDS_TIP="$(git -C "$WT" rev-parse HEAD)"
for c in "${OTHERS[@]}"; do replay "$c"; done
NEW="$(git -C "$WT" rev-parse HEAD)"
if [[ "$NEW" == "$OLD" && "$RECORDS_TIP" == "$BASE" ]]; then
  log "local main is already $(git rev-list --count "$BASE..$OLD") unshipped commit(s) strictly ahead of origin/main; nothing to do"
  exit 0
fi

# The rebuild may only bring in what origin/main changed. A file it alters beyond that would be
# local work lost in a replay.
MB="$(git merge-base "$OLD" "$BASE")"
LOST="$(comm -23 <(git diff --name-only "$OLD" "$NEW" | sort) <(git diff --name-only "$MB" "$BASE" | sort))"
[[ -z "$LOST" ]] || die "the rebuild would change files origin/main never touched: $(echo $LOST); local main untouched"
BLOCKED="$(comm -12 <(git diff --name-only "$OLD" "$NEW" | sort) <(git status --porcelain --no-renames | cut -c4- | sort))"
[[ -z "$BLOCKED" ]] || die "uncommitted changes in files the sync must update: $(echo $BLOCKED); local main untouched"

if (( DRY )); then
  if (( NO_PUSH )); then
    log "would move local main to $(git rev-list --count "$BASE..$NEW") commit(s) on top of origin/main and push nothing"
  else
    log "would push ${#RECORDS[@]} record commit(s) and move local main to $(git rev-list --count "$BASE..$NEW") commit(s) on origin/main"
  fi
  exit 0
fi

# --no-push never reaches git push, whatever RECORDS holds.
if (( ! NO_PUSH )) && [[ "$RECORDS_TIP" != "$BASE" ]]; then
  outside="$(git diff --name-only "$BASE" "$RECORDS_TIP" | grep -v "^$RECORDS_PREFIX" || true)"
  [[ -z "$outside" ]] || die "record commits touch files outside $RECORDS_PREFIX: $(echo $outside)"
  out="$(git push origin "$RECORDS_TIP:refs/heads/main" 2>&1)" || { echo "$out" >&2; die "pushing the records failed (origin moved? rerun); local main untouched"; }
  log "pushed $(git rev-list --count "$BASE..$RECORDS_TIP") record commit(s) to origin main"
fi

[[ "$(git rev-parse main)" == "$OLD" ]] || die "local main moved during the sync; rerun"
if [[ "$NEW" == "$OLD" ]]; then
  log "local main unchanged at ${NEW:0:8}; only the records were published"
  exit 0
fi
git branch -f backup/main-pre-sync "$OLD" >/dev/null
git reset -q --keep "$NEW" || die "git reset --keep failed; the old tip is backup/main-pre-sync"
log "local main is now ${NEW:0:8}: $(git rev-list --count origin/main..main) unshipped commit(s) ahead of origin/main, 0 behind (old tip: backup/main-pre-sync)"
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/sm-epic/); do
  git merge-base --is-ancestor "$OLD" "$b" 2>/dev/null || git merge-base --is-ancestor "$b" "$OLD" 2>/dev/null || continue
  git merge-base --is-ancestor "$b" main 2>/dev/null && continue
  log "warning: $b was cut from the old local main; reset it onto main before Session Manager merges it"
done
exit 0
