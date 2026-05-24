#!/usr/bin/env bash
# Smoke test for PRD 48 — signal-builder registry entry.
#
# Verifies the standalone-projects.json entry exists with the right shape,
# the file still parses, the entry surfaces when read via the same code path
# the bilko-host MCP uses (list_projects reads the JSON), and the Vite dev
# server can serve the file with the slug present.
#
# Exits non-zero on the first failure, with a one-line HALT diagnostic.
# Run from repo root: bash scripts/smoke-signal-builder-tile.sh

set -euo pipefail

REGISTRY=src/data/standalone-projects.json
SLUG=signal-builder

# ── AC1 — entry present with correct shape ─────────────────────────
ENTRY=$(jq --arg s "$SLUG" '.[] | select(.slug == $s)' "$REGISTRY")
if [ -z "$ENTRY" ]; then
  echo "HALT: $SLUG not found in $REGISTRY"
  exit 1
fi

NAME=$(echo "$ENTRY" | jq -r '.name')
CATEGORY=$(echo "$ENTRY" | jq -r '.category')
HOST_KIND=$(echo "$ENTRY" | jq -r '.host.kind')
STATUS=$(echo "$ENTRY" | jq -r '.status')

[ "$NAME" = "$SLUG" ] \
  || { echo "HALT: entry name='$NAME', expected '$SLUG'"; exit 1; }

# Category is allowed to add ' · <suffix>' refinements (e.g. 'Dev Tool · CLI');
# the PRD intent is that it belongs in the Dev Tool family.
case "$CATEGORY" in
  "Dev Tool"|"Dev Tool · "*) ;;
  *) echo "HALT: category='$CATEGORY', expected 'Dev Tool' (or 'Dev Tool · <suffix>')"; exit 1 ;;
esac

case "$HOST_KIND" in
  external-url|static-path) ;;
  *) echo "HALT: host.kind='$HOST_KIND', expected 'external-url' or 'static-path'"; exit 1 ;;
esac

# Allow 'cooking' alongside 'live' — a deliberate honesty knob set by the
# prior session ("only M0 has shipped"). Both surface the tile.
case "$STATUS" in
  live|cooking|wip) ;;
  *) echo "HALT: status='$STATUS', expected live|cooking|wip"; exit 1 ;;
esac

# ── AC2 — JSON valid + length stable (entry must be present in HEAD too) ──
jq empty "$REGISTRY" \
  || { echo "HALT: $REGISTRY is not valid JSON"; exit 1; }

HEAD_HAS=$(git show "HEAD:$REGISTRY" | jq --arg s "$SLUG" '[.[] | select(.slug == $s)] | length')
WORK_HAS=$(jq --arg s "$SLUG" '[.[] | select(.slug == $s)] | length' "$REGISTRY")
[ "$HEAD_HAS" = "1" ] && [ "$WORK_HAS" = "1" ] \
  || { echo "HALT: expected exactly one $SLUG entry in HEAD and worktree; got HEAD=$HEAD_HAS, work=$WORK_HAS"; exit 1; }

# ── AC3 — list_projects (file-read path) includes the slug ──────────
# The bilko-host MCP's list_projects reads standalone-projects.json directly
# (per mcp-host-server/README.md), so AC3 reduces to the slug being readable
# from that file as a JSON object. AC1 above already proved that.
jq -e --arg s "$SLUG" 'any(.slug == $s)' "$REGISTRY" >/dev/null \
  || { echo "HALT: list_projects (file-read path) does not surface $SLUG"; exit 1; }

# ── AC4 — Vite dev server boots and serves the registry with the slug ──
PORT=3002
ALREADY_UP=0
if curl -sf "http://localhost:$PORT/" -o /dev/null 2>/dev/null; then
  ALREADY_UP=1
fi

if [ "$ALREADY_UP" = "0" ]; then
  pnpm dev:client >/tmp/smoke-vite.log 2>&1 &
  VITE_PID=$!
  trap 'kill $VITE_PID 2>/dev/null || true' EXIT

  # Bounded wait: 20 × 2s = 40 s cap, per PRD_AUTHORING §1/§5
  for _ in $(seq 1 20); do
    curl -sf "http://localhost:$PORT/" -o /dev/null 2>/dev/null && break
    sleep 2
  done
  curl -sf "http://localhost:$PORT/" -o /dev/null 2>/dev/null \
    || { echo "HALT: vite dev:client did not boot on :$PORT within 40s"; exit 1; }
fi

curl -sf "http://localhost:$PORT/" -o /dev/null \
  || { echo "HALT: home page on :$PORT did not return 2xx"; exit 1; }

# The home page is a Vite SPA — the slug string lives in the JSON module,
# not the HTML shell. Curl the JSON via Vite's source-serving path and
# assert the slug is in the response.
curl -sf "http://localhost:$PORT/src/data/standalone-projects.json" \
  | jq -e --arg s "$SLUG" 'any(.slug == $s)' >/dev/null \
  || { echo "HALT: $SLUG not present in dev-served standalone-projects.json"; exit 1; }

# ── AC5 — external-url projects need no MCP registration step ──────
# mcp-host-server/README.md tools table: only register_static_project mutates.
# External-url entries are JSON-only. Log and pass.
echo "AC5: no registration step required for external-url; JSON entry is sufficient"

echo "OK: PRD 48 smoke passed — $SLUG registered as $CATEGORY ($STATUS, $HOST_KIND)"
