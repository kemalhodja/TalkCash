#!/usr/bin/env bash
# Build Android preview APK with LAN API URL (for physical device testing)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"

WAIT_FLAG=""
DOWNLOAD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait) WAIT_FLAG="--wait"; shift ;;
    --download) DOWNLOAD=1; shift ;;
    -h|--help)
      echo "Usage: ./scripts/build-android-apk.sh [--wait] [--download]"
      echo "  --wait      Wait for EAS build to finish"
      echo "  --download  Save APK to dist/talkcash-preview.apk (needs --wait or finished build)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

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
npx eas build --profile preview --platform android --non-interactive $WAIT_FLAG \
  --env "EXPO_PUBLIC_API_URL=$API_URL"

if [ "$DOWNLOAD" -eq 1 ]; then
  bash "$ROOT/scripts/download-android-apk.sh" "$ROOT/dist/talkcash-preview.apk"
fi

echo
echo "Build queued/completed. Dashboard: https://expo.dev"
echo "See docs/ANDROID_APK.md"
