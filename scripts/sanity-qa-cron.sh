#!/usr/bin/env bash
# Nightly sanity-QA cron wrapper.
# Runs the full gate, writes a dated report, and opens a GitHub issue if status != PASS.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$REPO_ROOT/test-results"
TIMESTAMP="$(TZ=America/Los_Angeles date '+%Y-%m-%d-%H-%M')"
REPORT_FILE="$REPORT_DIR/sanity-qa-${TIMESTAMP}.md"

mkdir -p "$REPORT_DIR"

cd "$REPO_ROOT"

echo "[sanity-qa-cron] Starting — $(TZ=America/Los_Angeles date '+%Y-%m-%d %H:%M %Z')"

# Run the gate; capture exit code without aborting the script
set +e
pnpm exec tsx scripts/sanity-qa.ts --write-report="$REPORT_FILE"
EXIT_CODE=$?
set -e

echo "[sanity-qa-cron] Exit code: $EXIT_CODE"

# PASS=0, WARN shows as WARN in report (exit 0), FAIL=1
if [[ $EXIT_CODE -eq 1 ]]; then
  DECISION="FAIL"
elif [[ $EXIT_CODE -eq 2 ]]; then
  DECISION="ERROR"
else
  # Check if report says WARN
  if grep -q '🟡 \*\*WARN\*\*' "$REPORT_FILE" 2>/dev/null; then
    DECISION="WARN"
  else
    DECISION="PASS"
  fi
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

# Commit the report so it's visible in the repo
if [[ -f "$REPORT_FILE" ]]; then
  git add "$REPORT_FILE" || true
  git commit -m "chore(qa): sanity-qa ${DECISION} ${TIMESTAMP}" || true
fi

exit $EXIT_CODE
