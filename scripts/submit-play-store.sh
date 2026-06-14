#!/usr/bin/env bash
# Build production AAB and submit to Google Play (internal track)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"

EAS_CMD=(npx --yes eas-cli)

if [ -z "${EXPO_TOKEN:-}" ]; then
  if ! "${EAS_CMD[@]}" whoami >/dev/null 2>&1; then
    echo "Authenticate first:"
    echo "  eas login"
    echo "  OR  export EXPO_TOKEN=...   # https://expo.dev/settings/access-tokens"
    exit 1
  fi
else
  export EXPO_TOKEN
fi

echo "==> Production Android build (AAB)..."
"${EAS_CMD[@]}" build --profile production --platform android --non-interactive --wait

echo "==> Submit latest build to Play Console (internal track)..."
"${EAS_CMD[@]}" submit --profile production --platform android --latest --non-interactive

echo "Done. Check Play Console → Internal testing for review status."
