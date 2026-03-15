#!/usr/bin/env bash
set -euo pipefail

ADMIN_DIR="docs/admin/prd"
USER_DIR="docs/user/prd"

if [[ ! -d "$ADMIN_DIR" ]]; then
  echo "Missing directory: $ADMIN_DIR"
  exit 1
fi

if [[ ! -d "$USER_DIR" ]]; then
  echo "Missing directory: $USER_DIR"
  exit 1
fi

if diff -rq "$ADMIN_DIR" "$USER_DIR" >/dev/null; then
  echo "OK: $ADMIN_DIR and $USER_DIR are synchronized."
  exit 0
fi

echo "ERROR: $ADMIN_DIR and $USER_DIR are not synchronized."
echo "Run: diff -rq $ADMIN_DIR $USER_DIR"
exit 1
