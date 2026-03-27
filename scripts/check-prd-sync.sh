#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MAP_FILE="AI_AGENT_PROMPT_TEMPLATES.md"
MASTER_FILE="MASTER_INDEX.md"
PRD_INDEX="docs/prd/index.md"
PRD_DIR="docs/prd"

failures=0

check_exists() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "ERROR: Missing file: $path"
    failures=$((failures + 1))
  fi
}

echo "Checking required governance files..."
check_exists "$MAP_FILE"
check_exists "$MASTER_FILE"
check_exists "$PRD_INDEX"

echo "Checking files referenced in AI reading map..."
map_paths_tmp="$(mktemp)"
awk '/^[[:space:]]*[0-9]+\.[[:space:]]+\// {print $2}' "$MAP_FILE" | sed 's#^/##' | sort -u > "$map_paths_tmp"

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  check_exists "$path"
done < "$map_paths_tmp"

echo "Checking PRD index coverage..."
find "$PRD_DIR" -maxdepth 1 -type f -name '[0-9][0-9]_*.md' -exec basename {} \; | sort > "$map_paths_tmp.prd"

while IFS= read -r section; do
  [[ -z "$section" ]] && continue
  if ! grep -q "$section" "$PRD_INDEX"; then
    echo "ERROR: $PRD_INDEX does not reference $section"
    failures=$((failures + 1))
  fi
done < "$map_paths_tmp.prd"

for ref in $(grep -oE '[0-9][0-9]_[A-Za-z0-9_]+\.md' "$PRD_INDEX" | sort -u); do
  if [[ ! -f "$PRD_DIR/$ref" ]]; then
    echo "ERROR: $PRD_INDEX references missing file $PRD_DIR/$ref"
    failures=$((failures + 1))
  fi
done

rm -f "$map_paths_tmp" "$map_paths_tmp.prd"

if (( failures > 0 )); then
  echo "FAILED: Documentation sync checks found $failures issue(s)."
  exit 1
fi

echo "OK: Documentation map and PRD index are synchronized."
