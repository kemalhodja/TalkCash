#!/usr/bin/env bash
# Build Android preview APK with LAN or staging API URL (physical device testing)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"

WAIT_FLAG=""
DOWNLOAD=0
USE_STAGING=0
SKIP_PREFLIGHT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wait) WAIT_FLAG="--wait"; shift ;;
    --download) DOWNLOAD=1; shift ;;
    --staging) USE_STAGING=1; shift ;;
    --skip-preflight) SKIP_PREFLIGHT=1; shift ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/build-android-apk.sh [options]

Options:
  --wait            Wait for EAS build to finish
  --download        Save APK to dist/talkcash-preview.apk (needs --wait or finished build)
  --staging         Use staging API (https://talkcash-api.fly.dev/api/v1)
  --skip-preflight  Skip Expo login check

Examples:
  ./scripts/build-android-apk.sh --wait --download
  API_HOST=192.168.1.42 ./scripts/build-android-apk.sh --wait
  ./scripts/build-android-apk.sh --staging --wait --download
EOF
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# shellcheck source=preflight-phone.sh
source "$ROOT/scripts/preflight-phone.sh"

if [ "$USE_STAGING" -eq 1 ]; then
  API_URL="${EXPO_PUBLIC_API_URL:-https://talkcash-api.fly.dev/api/v1}"
  HEALTH="${API_URL%/api/v1}/health"
else
  LAN_IP="$(resolve_lan_ip)"
  API_URL="${EXPO_PUBLIC_API_URL:-http://${LAN_IP}:8000/api/v1}"
  HEALTH="http://${LAN_IP}:8000/health"
fi

echo "==> TalkCash Android APK build"
echo "    API_URL=$API_URL"
echo

if [ "$SKIP_PREFLIGHT" -eq 0 ]; then
  echo "==> Preflight"
  require_eas_login
  if [ "$USE_STAGING" -eq 0 ]; then
    require_docker_health "$HEALTH" || {
      echo "  Start backend: ./scripts/phone-setup.sh"
      exit 1
    }
  else
    echo "==> Staging health: $HEALTH"
    if curl -sf "$HEALTH" >/dev/null; then
      echo "  OK"
    else
      echo "  WARNING: staging unreachable — build continues; phone needs internet"
    fi
  fi
  echo
fi

if [ "$USE_STAGING" -eq 0 ]; then
  echo "Telefondan önce test edin: $HEALTH"
else
  echo "Staging build — telefon internete bağlı olmalı"
fi
echo

if [ ! -d node_modules ]; then
  npm install
fi

echo "==> Starting EAS build (preview APK)..."
npx eas build --profile preview --platform android --non-interactive $WAIT_FLAG \
  --env "EXPO_PUBLIC_API_URL=$API_URL"

if [ "$DOWNLOAD" -eq 1 ]; then
  bash "$ROOT/scripts/download-android-apk.sh" "$ROOT/dist/talkcash-preview.apk"
  echo
  echo "USB ile kurulum: ./scripts/install-android-adb.sh"
fi

echo
echo "Build queued/completed. Dashboard: https://expo.dev"
echo "See docs/ANDROID_APK.md"
