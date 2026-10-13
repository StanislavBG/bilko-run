#!/usr/bin/env bash
# Usage: bash scripts/blog-draft.sh --out <abs_dir> --slot <ISO-8601 UTC>
#
# Entrypoint for Burrow's blog drafter. Runs blog-from-git phases 1-5d in one pinned
# `claude -p` call and writes ONLY into <abs_dir>:
#   result.json  {"status":"drafted","slug","title","excerpt","category"}
#                {"status":"skipped","reason"} | {"status":"error","error"}
#   post.md      frontmatter (slug,title,excerpt,category) + markdown body
#   images/*.jpg referenced as /blog-images/<slug>/<file>
#   artifacts/   content-DAG files
# Exit 0 = drafted or skipped, 1 = error, 2 = bad arguments.
# Never touches content/blog/, public/blog-images/, blog-ledger.md, drafts/ or git history;
# those are verified after the claude call.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1
# shellcheck source=blog-pipeline-lib.sh
source "$REPO_ROOT/scripts/blog-pipeline-lib.sh"

CLAUDE_TIMEOUT=2400
READABILITY_TIMEOUT=120
DRAFTS_DIR=".claude/skills/blog-from-git/drafts"
GUARDED_PATHS=(content/blog public/blog-images .claude/skills/blog-from-git/blog-ledger.md)

usage() {
  echo "usage: bash scripts/blog-draft.sh --out <abs_dir> --slot <ISO-8601 UTC>" >&2
}

OUT="" SLOT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) OUT="${2:-}"; shift 2 || { usage; exit 2; } ;;
    --slot) SLOT="${2:-}"; shift 2 || { usage; exit 2; } ;;
    *) usage; exit 2 ;;
  esac
done
if [[ -z "$OUT" || "$OUT" != /* ]]; then
  echo "error: --out must be an absolute directory path" >&2; usage; exit 2
fi
if [[ ! "$SLOT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-]00:?00)$ ]] \
  || ! date -u -d "$SLOT" >/dev/null 2>&1; then
  echo "error: --slot must be an ISO-8601 UTC timestamp (e.g. 2026-10-13T16:00:00Z)" >&2; usage; exit 2
fi

OUT="${OUT%/}"
CAN_WRITE=0
if mkdir -p "$OUT" 2>/dev/null && [[ -w "$OUT" ]]; then
  CAN_WRITE=1
  rm -f "$OUT/result.json" "$OUT/post.md"
fi

fail() {
  echo "[blog-draft] error: $1" >&2
  if [[ $CAN_WRITE -eq 1 ]]; then
    printf '{"status":"error","error":"%s"}\n' "$(bp_json_escape "$1")" > "$OUT/result.json"
  fi
  exit 1
}

MISSING="$(bp_missing_binaries)"
[[ -z "$MISSING" ]] || fail "missing required binaries: $MISSING"

guard_snapshot() {
  {
    git status --porcelain --untracked-files=all -- "${GUARDED_PATHS[@]}" 2>&1
    echo "HEAD $(git rev-parse HEAD 2>&1)"
    echo "INDEX $(git diff --cached --name-only 2>&1 | sort | tr '\n' ' ')"
    echo "DRAFTS"
    ls -A "$DRAFTS_DIR" 2>/dev/null
    echo "ENDDRAFTS"
  }
}
BEFORE="$(guard_snapshot)"

AUTHORED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PROMPT="$(bp_draft_prompt "$OUT" "$SLOT" "$AUTHORED_AT")"

echo "[blog-draft] slot=$SLOT out=$OUT — invoking claude -p"
CLAUDE_OUTPUT="$(timeout "$CLAUDE_TIMEOUT" claude -p "$PROMPT" \
  --model "$BP_CLAUDE_MODEL" \
  --dangerously-skip-permissions \
  --output-format text 2>&1)"
CLAUDE_RC=$?
echo "$CLAUDE_OUTPUT"

AFTER="$(guard_snapshot)"
if [[ "$BEFORE" != "$AFTER" ]]; then
  fail "claude touched guarded paths (content/blog, public/blog-images, blog-ledger.md, drafts/, or git history/index)"
fi
if [[ $CLAUDE_RC -eq 124 ]]; then
  fail "claude timed out after ${CLAUDE_TIMEOUT}s"
elif [[ $CLAUDE_RC -ne 0 ]]; then
  fail "claude exited with status $CLAUDE_RC"
fi
[[ $CAN_WRITE -eq 1 ]] || fail "cannot write to $OUT"

RESULT_LINE="$(printf '%s\n' "$CLAUDE_OUTPUT" | grep '^DRAFT_RESULT: ' | tail -n 1 || true)"
if [[ ! -f "$OUT/post.md" ]]; then
  if [[ "$RESULT_LINE" == "DRAFT_RESULT: skipped"* ]]; then
    REASON="$(printf '%s' "$RESULT_LINE" | sed -n 's/^DRAFT_RESULT: skipped reason="\(.*\)"[[:space:]]*$/\1/p')"
    printf '{"status":"skipped","reason":"%s"}\n' "$(bp_json_escape "${REASON:-nothing worth writing}")" > "$OUT/result.json"
    echo "[blog-draft] skipped: ${REASON:-nothing worth writing}"
    exit 0
  fi
  fail "claude finished but did not write post.md"
fi

REASON="$(bp_validate_post "$OUT/post.md" "$OUT")" || fail "malformed post.md: $REASON"

timeout "$READABILITY_TIMEOUT" npx tsx scripts/blog-readability.ts "$OUT/post.md" >&2
RC=$?
[[ $RC -eq 0 ]] || fail "readability check failed (exit $RC)"

printf '{"status":"drafted","slug":"%s","title":"%s","excerpt":"%s","category":"%s"}\n' \
  "$(bp_json_escape "$(bp_fm_get "$OUT/post.md" slug)")" \
  "$(bp_json_escape "$(bp_fm_get "$OUT/post.md" title)")" \
  "$(bp_json_escape "$(bp_fm_get "$OUT/post.md" excerpt)")" \
  "$(bp_json_escape "$(bp_fm_get "$OUT/post.md" category)")" > "$OUT/result.json"
echo "[blog-draft] drafted $(bp_fm_get "$OUT/post.md" slug)"
exit 0
