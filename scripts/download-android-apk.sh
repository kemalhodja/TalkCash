#!/usr/bin/env bash
# Download latest Android preview APK from EAS to dist/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist/talkcash-preview.apk}"

mkdir -p "$(dirname "$OUT")"
cd "$ROOT/mobile"

if [ ! -d node_modules ]; then
  npm install
fi

echo "==> Downloading latest Android build..."
npx eas build:download --platform android --latest --output "$OUT"

echo "==> Saved: $OUT"
echo "Transfer to phone (USB / Drive / WhatsApp) and install."
