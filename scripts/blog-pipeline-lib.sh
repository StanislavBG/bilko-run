#!/usr/bin/env bash
# Sourced by blog-draft.sh (and later blog-seed.sh / the watchdog) — do not execute,
# and do not `set -e` here. Shared helpers for the blog-from-git pipeline entrypoints.

BP_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=blog-watchdog-env.sh
source "$BP_LIB_DIR/blog-watchdog-env.sh"

# Same model as blog-cadence-watchdog.sh's `claude -p` call.
BP_CLAUDE_MODEL="claude-sonnet-5"

BP_DRAFT_REQUIRED_BINARIES=(claude git npx pnpm timeout)

# Echoes the space-separated required binaries that do not resolve. Empty = all fine.
bp_missing_binaries() {
  local bin missing=()
  for bin in "${BP_DRAFT_REQUIRED_BINARIES[@]}"; do
    command -v "$bin" >/dev/null 2>&1 || missing+=("$bin")
  done
  echo "${missing[*]:-}"
}

# Escapes $1 for use inside a JSON string (newlines/tabs flattened to spaces).
bp_json_escape() {
  printf '%s' "$1" | tr '\n\r\t' '   ' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\000-\037'
}

# bp_fm_get <file> <key> — value of a single-line top-level frontmatter key, unquoted.
bp_fm_get() {
  awk -v key="$2" '
    NR == 1 { if ($0 != "---") exit; next }
    $0 == "---" { exit }
    index($0, key ":") == 1 {
      v = substr($0, length(key) + 2)
      sub(/^[ \t]+/, "", v); sub(/[ \t\r]+$/, "", v)
      if (v ~ /^".*"$/ || v ~ /^'"'"'.*'"'"'$/) v = substr(v, 2, length(v) - 2)
      print v; exit
    }' "$1"
}

# bp_validate_post <post.md> <out_dir> — prints a reason and returns 1 when malformed.
bp_validate_post() {
  local post="$1" out="$2" key val slug body_lines ref
  if [[ "$(head -n 1 "$post")" != "---" ]]; then
    echo "post.md does not start with a --- frontmatter fence"; return 1
  fi
  if ! awk 'NR > 1 && $0 == "---" { found = 1 } END { exit !found }' "$post"; then
    echo "post.md frontmatter is not closed with ---"; return 1
  fi
  for key in slug title excerpt category; do
    val="$(bp_fm_get "$post" "$key")"
    if [[ -z "$val" ]]; then
      echo "post.md frontmatter is missing '$key'"; return 1
    fi
  done
  slug="$(bp_fm_get "$post" slug)"
  if [[ ! "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    echo "post.md slug '$slug' must be lowercase letters, digits and -"; return 1
  fi
  body_lines="$(awk 'NR == 1 { next } fence { if (NF) n++; next } $0 == "---" { fence = 1 } END { print n + 0 }' "$post")"
  if [[ "$body_lines" -eq 0 ]]; then
    echo "post.md has no body after the frontmatter"; return 1
  fi
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    if [[ "$ref" != "/blog-images/$slug/"*.jpg || "$ref" == *".."* ]]; then
      echo "image reference $ref is not /blog-images/$slug/<file>.jpg"; return 1
    fi
    if [[ ! -f "$out/images/${ref##*/}" ]]; then
      echo "image reference $ref has no file in images/"; return 1
    fi
  done < <(grep -o '/blog-images/[^) "]*' "$post" || true)
  return 0
}

# bp_draft_prompt <out_dir> <slot> <authored_at> — the unattended phases 1-5d prompt.
bp_draft_prompt() {
  local out="$1" slot="$2" authored_at="$3"
  cat <<PROMPT
You are running unattended, called by Burrow's blog drafter (scripts/blog-draft.sh). There is NO human present. The intended publish slot is ${slot}; Burrow owns the slot and the publishing, you only draft. This run started at ${authored_at}.

Follow the blog-from-git skill (.claude/skills/blog-from-git/SKILL.md) but run PHASES 1-5d ONLY: 1 Rotation (read rotation.md + blog-ledger.md — respect never_repeat_previous_project, the project cooldown and max_consecutive_untiled_posts, and the retired subjects in blog.config.yaml), 2 Scan, 3 Research, 4 Ground, 5 Draft (voice.md), 5d Illustrate (images.md). Obey blog.config.yaml truth rules and the readability policy.

Content DAG: follow .claude/skills/blog-from-git/dag.md, but write every pipeline artifact (questions.json, evidence.json, outline.json, renditions/linkedin.md, renditions/x.md) under ${out}/artifacts/<slug>/ — NOT under .claude/skills/blog-from-git/drafts/.

Output directory: ${out}
Write ONLY inside that directory:
- ${out}/post.md — the finished post: YAML frontmatter with exactly these single-line keys: slug, title, excerpt, category; then the markdown body.
- ${out}/images/<name>.jpg — 0-3 real screenshots (images.md sections 2-4), each at most 220 KB. Capture them into a temp dir and copy the keepers here. Reference each in the body as ![alt](/blog-images/<slug>/<name>.jpg "caption"). Do NOT copy them to public/blog-images/.
- ${out}/artifacts/ — the DAG files above.

Before you finish, run \`npx tsx scripts/blog-readability.ts ${out}/post.md\`; it must exit 0. Rewrite and re-run up to 2 times.

STOP AFTER PHASE 5d. There is no approve or seed phase in this run. You must NOT:
- create, edit or delete anything under content/blog/ or public/blog-images/
- edit or append to .claude/skills/blog-from-git/blog-ledger.md
- create, edit, move or delete anything in .claude/skills/blog-from-git/drafts/
- run git add, git commit, git push, git stash or git checkout
- write any file outside ${out} (except throwaway temp dirs)
The script checks these paths afterward and fails the run if any changed.

If rotation finds nothing worth writing (and the no-new-work spotlight fallback has no candidate either), do not invent a post and do not write post.md. Print exactly one final line: DRAFT_RESULT: skipped reason="<why>"
Otherwise, when post.md is done, print exactly one final line: DRAFT_RESULT: drafted
PROMPT
}
