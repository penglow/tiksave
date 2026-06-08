#!/usr/bin/env bash
# Detect which CI areas changed using git only (no GitHub API).
set -euo pipefail

EVENT_NAME="${GITHUB_EVENT_NAME:-push}"
PR_BASE_SHA="${PR_BASE_SHA:-}"
PR_HEAD_SHA="${PR_HEAD_SHA:-}"
PUSH_BEFORE="${PUSH_BEFORE:-}"
PUSH_AFTER="${PUSH_AFTER:-}"
ZERO_SHA="0000000000000000000000000000000000000000"

mobile=false
backend=false

matches_mobile() {
  case "$1" in
    TikSaveRN/*|.bun-version|.github/workflows/ci.yml|.github/workflows/git-checks.yml|.github/actions/*|.github/scripts/*)
      return 0
      ;;
  esac
  return 1
}

matches_backend() {
  case "$1" in
    backend/*|.bun-version|.gitleaks.toml|.github/workflows/ci.yml|.github/workflows/git-checks.yml|.github/actions/*|.github/scripts/*)
      return 0
      ;;
  esac
  return 1
}

scan_files() {
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if matches_mobile "$file"; then
      mobile=true
    fi
    if matches_backend "$file"; then
      backend=true
    fi
  done
}

if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
  mobile=true
  backend=true
else
  SKIP_SCAN=false
  if [ "$EVENT_NAME" = "pull_request" ] && [ -n "$PR_BASE_SHA" ] && [ -n "$PR_HEAD_SHA" ]; then
    if ! git fetch --no-tags origin "$PR_BASE_SHA" "$PR_HEAD_SHA"; then
      echo "::warning::Could not fetch PR refs; running full mobile + backend CI."
      mobile=true
      backend=true
      SKIP_SCAN=true
    fi
    RANGE="${PR_BASE_SHA}..${PR_HEAD_SHA}"
  elif [ "$EVENT_NAME" = "push" ] && [ -n "$PUSH_BEFORE" ] && [ "$PUSH_BEFORE" != "$ZERO_SHA" ] && [ -n "$PUSH_AFTER" ]; then
    RANGE="${PUSH_BEFORE}..${PUSH_AFTER}"
  elif git rev-parse HEAD~1 >/dev/null 2>&1; then
    RANGE="HEAD~1..HEAD"
  else
    RANGE=""
  fi

  if [ "$SKIP_SCAN" = false ]; then
    if [ -n "${RANGE:-}" ]; then
      scan_files < <(git diff --name-only --diff-filter=ACMR "$RANGE")
    else
      scan_files < <(git ls-files)
    fi
  fi
fi

echo "Changed files range: ${RANGE:-all}"
echo "mobile=${mobile}"
echo "backend=${backend}"

echo "mobile=${mobile}" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
echo "backend=${backend}" >> "$GITHUB_OUTPUT"
