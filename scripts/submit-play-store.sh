#!/usr/bin/env bash
# Build production AAB and submit to Google Play (internal track)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"

if [ -z "${EXPO_TOKEN:-}" ] && ! eas whoami >/dev/null 2>&1; then
  echo "Run: eas login  OR  export EXPO_TOKEN=..."
  exit 1
fi

echo "==> Production Android build (AAB)..."
eas build --profile production --platform android --non-interactive

echo "==> Submit latest build to Play Console (internal track)..."
eas submit --profile production --platform android --latest --non-interactive

echo "Done. Check Play Console → Internal testing for review status."
