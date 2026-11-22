#!/usr/bin/env bash
# Docs guard: keeps Bilko's docs to current facts. Git holds the history, so a
# doc that carries it goes stale the day it is written.
#
# Usage:
#   docs-guard.sh                 check every tracked docs/**/*.md (except
#                                 docs/templates/), plus CLAUDE.md and README.md
#   docs-guard.sh <file>...       check only these files
#
# Rules, one output line per hit as `<file>:<line>: <rule>: <text>`:
#   date     a 20NN-NN-NN date
#   prd      PRD or PRDs followed by a 3-4 digit number
#   sha      a backticked 7-12 char lowercase hex string
#   history  whole phrases, any case: no longer, used to, previously, as of,
#            owner decision, until recently
#   link     a relative markdown link whose target (without #anchor) exists
#            neither relative to the doc's folder nor to the repo root; links
#            starting with http, https, mailto, # or / are skipped
# Fenced code blocks (``` and ~~~), HTML comments (single- or multi-line) and
# any line containing `docs-guard: allow` are skipped.
#
# Exit: 0 clean, 1 on any hit, 2 on a usage error (missing file).
# Plain bash + awk only; portable across GNU and BSD tools.
set -uo pipefail

usage() { echo "usage: docs-guard.sh [<file.md>...]" >&2; }

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null) || root=$(cd "$script_dir/.." && pwd)

files=()
if [[ $# -gt 0 ]]; then
  for f in "$@"; do
    if [[ ! -f $f ]]; then
      echo "docs-guard: no such file: $f" >&2
      usage
      exit 2
    fi
    files+=("$f")
  done
else
  cd "$root" || exit 2
  while IFS= read -r f; do
    [[ $f == docs/templates/* ]] && continue
    [[ -f $f ]] && files+=("$f")
  done < <(git ls-files -- 'docs/*.md')
  for f in CLAUDE.md README.md; do
    [[ -f $f ]] && files+=("$f")
  done
fi

SEP=$'\034'

# Prints rule hits directly, and SEP<line>SEP<target> records for each
# relative link so the shell can test the target on disk.
scan() {
  awk -v file="$1" -v sep="$SEP" '
    BEGIN {
      hex = "[0-9a-f]"
      sha = "`" hex hex hex hex hex hex hex "(" hex ")?(" hex ")?(" hex ")?(" hex ")?(" hex ")?`"
      prd = "(^|[^A-Za-z0-9_])PRDs?[ \t]+#?[0-9][0-9][0-9][0-9]?([^0-9]|$)"
      hist = "(^|[^a-z0-9_])(no longer|used to|previously|as of|owner decision|until recently)([^a-z0-9_]|$)"
      date = "20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]"
      fence = ""; incomment = 0
    }
    {
      raw = $0
      sub(/\r$/, "", raw)
      if (!incomment) {
        if (fence != "") {
          if (raw ~ ("^[ \t]*" fence)) fence = ""
          next
        }
        if (raw ~ /^[ \t]*```/) { fence = "```"; next }
        if (raw ~ /^[ \t]*~~~/) { fence = "~~~"; next }
      }
      # Strip HTML comments, tracking ones that span lines.
      text = ""; rest = raw
      while (length(rest) > 0) {
        if (incomment) {
          i = index(rest, "-->")
          if (i == 0) { rest = ""; break }
          rest = substr(rest, i + 3); incomment = 0
        } else {
          i = index(rest, "<!--")
          if (i == 0) { text = text rest; rest = ""; break }
          text = text substr(rest, 1, i - 1)
          rest = substr(rest, i + 4); incomment = 1
        }
      }
      if (index(raw, "docs-guard: allow") > 0) next
      if (text ~ /^[ \t]*$/) next

      shown = text
      sub(/^[ \t]+/, "", shown); sub(/[ \t]+$/, "", shown)
      if (text ~ date) print file ":" NR ": date: " shown
      if (text ~ prd) print file ":" NR ": prd: " shown
      if (text ~ sha) print file ":" NR ": sha: " shown
      if (tolower(text) ~ hist) print file ":" NR ": history: " shown

      # Links: ignore inline code spans, then pull every ](target).
      l = text
      gsub(/`[^`]*`/, "", l)
      while (match(l, /\]\([^)]*\)/)) {
        t = substr(l, RSTART + 2, RLENGTH - 3)
        l = substr(l, RSTART + RLENGTH)
        sub(/^[ \t]+/, "", t)
        sub(/[ \t].*$/, "", t)
        sub(/^</, "", t); sub(/>$/, "", t)
        if (t == "" || t ~ /^(https?:|mailto:|#|\/)/) continue
        print sep NR sep t
      }
    }
  ' "$1"
}

hits=0
for f in "${files[@]}"; do
  docdir=$(dirname "$f")
  while IFS= read -r line; do
    if [[ $line == "$SEP"* ]]; then
      rec=${line#"$SEP"}
      n=${rec%%"$SEP"*}
      target=${rec#*"$SEP"}
      path=${target%%#*}
      path=${path%%\?*}
      [[ -z $path ]] && continue
      if [[ -e $docdir/$path || -e $root/$path ]]; then
        continue
      fi
      echo "$f:$n: link: $target"
    else
      echo "$line"
    fi
    hits=$((hits + 1))
  done < <(scan "$f")
done

if [[ $hits -gt 0 ]]; then
  exit 1
fi
echo "docs-guard: clean (${#files[@]} files)"
exit 0
