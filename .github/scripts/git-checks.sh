#!/usr/bin/env bash
# Repository hygiene checks (complements gitleaks).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

EVENT_NAME="${GITHUB_EVENT_NAME:-local}"
PR_BASE_SHA="${PR_BASE_SHA:-}"
PR_HEAD_SHA="${PR_HEAD_SHA:-}"
PR_BASE_REF="${PR_BASE_REF:-}"
PUSH_BEFORE="${PUSH_BEFORE:-}"
PUSH_AFTER="${PUSH_AFTER:-}"
MAX_FILE_BYTES=$((5 * 1024 * 1024))
ZERO_SHA="0000000000000000000000000000000000000000"

errors=0

error_msg() {
  local file="${1:-}"
  local msg="${2}"
  if [ -n "$file" ]; then
    echo "::error file=${file}::${msg}"
  else
    echo "::error::${msg}"
  fi
  errors=$((errors + 1))
}

warn_msg() {
  local file="${1:-}"
  local msg="${2}"
  if [ -n "$file" ]; then
    echo "::warning file=${file}::${msg}"
  else
    echo "::warning::${msg}"
  fi
}

should_skip_file() {
  local f="$1"
  case "$f" in
    */node_modules/*|*/dist/*|*/build/*|*/coverage/*|*/.run-logs/*|*/test-results/*)
      return 0
      ;;
    */env.template|*/backend/env.template|*/.github/workflows/*)
      return 0
      ;;
    */backend/src/tests/*|*/TikSaveRN/src/__tests__/*|*/*.test.ts|*/*.test.tsx)
      return 0
      ;;
  esac
  return 1
}

diff_range() {
  if [ "$EVENT_NAME" = "pull_request" ] && [ -n "$PR_BASE_SHA" ] && [ -n "$PR_HEAD_SHA" ]; then
    printf '%s..%s' "$PR_BASE_SHA" "$PR_HEAD_SHA"
  elif [ "$EVENT_NAME" = "push" ] && [ -n "$PUSH_BEFORE" ] && [ "$PUSH_BEFORE" != "$ZERO_SHA" ] && [ -n "$PUSH_AFTER" ]; then
    printf '%s..%s' "$PUSH_BEFORE" "$PUSH_AFTER"
  elif git rev-parse HEAD~1 >/dev/null 2>&1; then
    printf 'HEAD~1..HEAD'
  else
    printf 'HEAD'
  fi
}

list_changed_files() {
  local range
  range="$(diff_range)"
  if [ "$range" = "HEAD" ]; then
    git ls-files
  else
    git diff --name-only --diff-filter=ACMR "$range"
  fi
}

echo "Git hygiene checks (event=${EVENT_NAME}, range=$(diff_range))"

# --- 1. Block tracked env files, keys, and certs ---
echo "→ Checking for tracked secret files..."
while IFS= read -r path; do
  [ -n "$path" ] || continue
  case "$path" in
    */env.template|*/backend/env.template|*.env.example)
      continue
      ;;
  esac
  error_msg "$path" "Sensitive file must not be tracked in git: ${path}"
done < <(
  git ls-files \
    '*.env' '.env' '.env.*' \
    '*.pem' '*.key' '*.p12' '*.pfx' '*.jks' '*.keystore' \
    'id_rsa' 'id_dsa' 'id_ecdsa' 'id_ed25519' \
    2>/dev/null || true
)

# --- 2. Merge conflict markers in changed files ---
echo "→ Checking for merge conflict markers..."
while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$file" ] || continue
  should_skip_file "$file" && continue
  if grep -qE '^(<<<<<<< |>>>>>>> |=======)' "$file" 2>/dev/null; then
    error_msg "$file" "Unresolved merge conflict marker"
  fi
done < <(list_changed_files)

# --- 3. Large files introduced in diff ---
echo "→ Checking for large files in diff (>${MAX_FILE_BYTES} bytes)..."
while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$file" ] || continue
  should_skip_file "$file" && continue
  size=$(wc -c <"$file" | tr -d ' ')
  if [ "$size" -gt "$MAX_FILE_BYTES" ]; then
    error_msg "$file" "File exceeds 5 MiB (${size} bytes). Use Git LFS or keep artifacts out of git."
  fi
done < <(list_changed_files)

# --- 4. Credential-like extensions in diff ---
echo "→ Checking for key/certificate extensions in diff..."
while IFS= read -r file; do
  [ -n "$file" ] || continue
  should_skip_file "$file" && continue
  case "$file" in
    *.pem|*.key|*.p12|*.pfx|*.jks|*.keystore|*.mobileprovision)
      error_msg "$file" "Private key or certificate must not be committed"
      ;;
  esac
done < <(list_changed_files)

# --- 5. High-signal secret patterns in changed text files ---
echo "→ Checking changed text for known secret formats..."
PATTERN_FILE="$(mktemp)"
cat >"$PATTERN_FILE" <<'EOF'
ghp_[0-9a-zA-Z]{36,}
github_pat_[0-9a-zA-Z_]{22,}
sk-ant-[0-9a-zA-Z_-]{20,}
sk-proj-[0-9a-zA-Z_-]{20,}
AKIA[0-9A-Z]{16}
xox[baprs]-[0-9a-zA-Z-]{10,}
-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----
EOF

while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$file" ] || continue
  should_skip_file "$file" && continue
  case "$file" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.woff|*.woff2|*.ttf|*.eot|*.zip|*.gz|*.jar|*.ipa|*.apk|*.db|*.sqlite|*.sqlite3)
      continue
      ;;
  esac
  if grep -nEIf "$PATTERN_FILE" "$file" 2>/dev/null; then
    error_msg "$file" "Possible hardcoded secret or private key (see grep output above)"
  fi
done < <(list_changed_files)
rm -f "$PATTERN_FILE"

# --- 6. Submodule / gitlink sanity ---
echo "→ Checking git submodules..."
if [ -f .gitmodules ]; then
  while IFS= read -r line; do
    url=$(echo "$line" | sed -n 's/.*url = //p' | tr -d ' "'"'")
    [ -n "$url" ] || continue
    case "$url" in
      https://github.com/*|git@github.com:*|https://*.git)
        ;;
      *)
        warn_msg "" "Unusual submodule URL in .gitmodules: ${url}"
        ;;
    esac
  done < <(grep 'url =' .gitmodules || true)
fi

# --- 7. Ensure .env is ignored if present locally (informational on CI) ---
if git check-ignore -q .env 2>/dev/null; then
  echo "→ .env is correctly gitignored"
elif [ -f .env ]; then
  warn_msg ".env" ".env exists but may not be ignored — verify .gitignore"
fi

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "Git hygiene failed with ${errors} error(s)."
  exit 1
fi

echo "Git hygiene checks passed."
