#!/usr/bin/env bash
# Build Android preview APK with LAN API URL (for physical device testing)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"

detect_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
    return
  fi
  hostname -I 2>/dev/null | awk '{print $1}' || true
}

LAN_IP="${API_HOST:-$(detect_ip)}"
if [ -z "$LAN_IP" ]; then
  echo "ERROR: Could not detect LAN IP. Set API_HOST manually:"
  echo "  API_HOST=192.168.1.42 ./scripts/build-android-apk.sh"
  exit 1
fi

API_URL="${EXPO_PUBLIC_API_URL:-http://${LAN_IP}:8000/api/v1}"

echo "==> TalkCash Android APK build"
echo "    API_URL=$API_URL"
echo
echo "Telefondan önce test edin: ${API_URL%/api/v1}/health"
echo

if [ ! -d node_modules ]; then
  npm install
fi

echo "==> Starting EAS build (preview APK)..."
npx eas build --profile preview --platform android --non-interactive \
  --env "EXPO_PUBLIC_API_URL=$API_URL"

echo
echo "Build queued. Download APK from: https://expo.dev"
echo "See docs/ANDROID_APK.md for install steps."
