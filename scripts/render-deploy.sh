#!/usr/bin/env bash
# Trigger a Render deploy via Deploy Hook.
#
# Setup (one time):
#   1. Render dashboard → bilko-run service → Settings → Build & Deploy
#   2. Under "Deploy Hook" copy the URL (looks like https://api.render.com/deploy/srv-XXX?key=YYY)
#   3. Add to .env.local:   RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-XXX?key=YYY
#
# Usage:
#   ./scripts/render-deploy.sh             # uses RENDER_DEPLOY_HOOK from .env.local or env
#   RENDER_DEPLOY_HOOK=... ./scripts/render-deploy.sh
#
# Exits non-zero if the hook isn't set or the request fails.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [[ -z "${RENDER_DEPLOY_HOOK:-}" && -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

if [[ -z "${RENDER_DEPLOY_HOOK:-}" ]]; then
  echo "error: RENDER_DEPLOY_HOOK not set." >&2
  echo "       Get it from Render dashboard → Service → Settings → Deploy Hook," >&2
  echo "       then add it to .env.local as: RENDER_DEPLOY_HOOK=https://api.render.com/deploy/..." >&2
  exit 2
fi

echo "Triggering Render deploy..."
http_code=$(curl -sS -o /tmp/render-deploy-resp.json -w "%{http_code}" -X POST "$RENDER_DEPLOY_HOOK")

if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
  echo "error: Render returned HTTP $http_code" >&2
  cat /tmp/render-deploy-resp.json >&2 || true
  exit 1
fi

echo "Render deploy queued (HTTP $http_code)."
cat /tmp/render-deploy-resp.json
echo
echo
echo "Monitor:   https://dashboard.render.com/  (or watch curl -s https://bilko.run/api/health)"
