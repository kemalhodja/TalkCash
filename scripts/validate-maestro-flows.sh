#!/usr/bin/env bash
# Validate Maestro flow files exist and have required structure (no device needed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAESTRO_DIR="$ROOT/mobile/.maestro"

required=(
  smoke.yaml
  expense-flow.yaml
  micro-savings-flow.yaml
)

for file in "${required[@]}"; do
  path="$MAESTRO_DIR/$file"
  if [[ ! -f "$path" ]]; then
    echo "Missing Maestro flow: $path"
    exit 1
  fi
  if ! grep -q '^appId:' "$path"; then
    echo "Invalid Maestro flow (missing appId): $path"
    exit 1
  fi
  echo "OK  $file"
done

bash "$ROOT/scripts/validate-store-readiness.sh"
echo "Maestro flow validation passed."
