#!/usr/bin/env bash
# Fail CI when a test run reports zero passing tests (e.g. all suites skipped).
set -euo pipefail

LOG_FILE="${1:?Usage: verify-test-output.sh <log-file>}"
LABEL="${2:-tests}"

if [ ! -f "$LOG_FILE" ]; then
  echo "::error::Missing test log: $LOG_FILE"
  exit 1
fi

if grep -qE '^[[:space:]]*0 pass[[:space:]]*$' "$LOG_FILE"; then
  echo "::error::${LABEL} reported 0 passing tests (suites may have been skipped)."
  tail -n 40 "$LOG_FILE"
  exit 1
fi

if grep -qE '^[[:space:]]*[1-9][0-9]* fail[[:space:]]*$' "$LOG_FILE"; then
  echo "::error::${LABEL} reported failures."
  tail -n 40 "$LOG_FILE"
  exit 1
fi

echo "${LABEL} output OK."
