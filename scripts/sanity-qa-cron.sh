#!/usr/bin/env bash
# Nightly sanity-QA cron wrapper.
# Runs the full gate, writes a dated report, and opens a GitHub issue if status != PASS.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Cron runs with a bare PATH that omits user-local npm bins, so pnpm is not
# found (exit 127). Prepend the install location so the gate can actually run.
export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"

# Load cron-specific env (GITHUB_TOKEN, etc.) if present
# shellcheck source=/dev/null
[[ -f "$HOME/.env.cron" ]] && source "$HOME/.env.cron"
REPORT_DIR="$REPO_ROOT/test-results"
TIMESTAMP="$(TZ=America/Los_Angeles date '+%Y-%m-%d-%H-%M')"
REPORT_FILE="$REPORT_DIR/sanity-qa-${TIMESTAMP}.md"

mkdir -p "$REPORT_DIR"

cd "$REPO_ROOT"

echo "[sanity-qa-cron] Starting — $(TZ=America/Los_Angeles date '+%Y-%m-%d %H:%M %Z')"

# Refresh the Projects-hub commit-order sidecar from the local sibling repos
# (non-fatal: a stale order is better than aborting the QA run). Committed below
# alongside the report so Render picks up the new ordering on next deploy.
pnpm exec tsx scripts/refresh-commit-order.ts || echo "[sanity-qa-cron] commit-order refresh failed (non-fatal)"

# Run the gate; capture exit code without aborting the script
set +e
pnpm exec tsx scripts/sanity-qa.ts --write-report="$REPORT_FILE"
EXIT_CODE=$?
set -e

echo "[sanity-qa-cron] Exit code: $EXIT_CODE"

# PASS=0, WARN shows as WARN in report (exit 0), FAIL=1, ERROR=2.
# Any other exit code (e.g. 127 = command not found) is an unexpected crash and
# must NOT fall through to PASS — treat it as ERROR so it surfaces.
if [[ $EXIT_CODE -eq 0 ]]; then
  # Check if report says WARN
  if grep -q '🟡 \*\*WARN\*\*' "$REPORT_FILE" 2>/dev/null; then
    DECISION="WARN"
  else
    DECISION="PASS"
  fi
elif [[ $EXIT_CODE -eq 1 ]]; then
  DECISION="FAIL"
else
  # 2 = gate-reported error, anything else = crash before the gate ran
  DECISION="ERROR"
fi

echo "[sanity-qa-cron] Decision: $DECISION"

# Open a GitHub issue on FAIL or ERROR (requires gh CLI and GITHUB_TOKEN)
if [[ "$DECISION" == "FAIL" || "$DECISION" == "ERROR" ]]; then
  if command -v gh &>/dev/null && [[ -n "${GITHUB_TOKEN:-}" ]]; then
    BODY="$(head -60 "$REPORT_FILE")"
    gh issue create \
      --title "Sanity QA ${DECISION} — ${TIMESTAMP}" \
      --body "$BODY" \
      --label "qa-failure" \
      --repo "StanislavBG/bilko-run" \
      || echo "[sanity-qa-cron] gh issue create failed (non-fatal)"
  else
    echo "[sanity-qa-cron] gh CLI or GITHUB_TOKEN not available — skipping issue creation"
  fi
fi

# Commit and push the report to both remotes.
# test-results/ is gitignored (playwright traces etc.), so force-add ONLY the
# dated markdown report — the rest of the dir stays ignored. Commit without -a
# so we never sweep up the unrelated working-tree changes (outdoor-hours data).
if [[ -f "$REPORT_FILE" ]]; then
  git add -f "$REPORT_FILE"
  # Also stage the refreshed commit-order sidecar if it changed (tracked file).
  git add src/data/commit-order.json 2>/dev/null || true
  if git commit -q -m "chore(qa): sanity-qa ${DECISION} ${TIMESTAMP}"; then
    git push origin main || echo "[sanity-qa-cron] push origin failed (non-fatal)"
    git push content-grade main || echo "[sanity-qa-cron] push content-grade failed (non-fatal)"
  else
    echo "[sanity-qa-cron] nothing to commit (report unchanged?) — skipping push"
  fi
fi

exit $EXIT_CODE
