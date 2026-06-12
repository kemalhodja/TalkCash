#!/usr/bin/env bash
# Install preview APK on a USB-connected Android device via adb
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK="${1:-$ROOT/dist/talkcash-preview.apk}"

if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb not found."
  echo "  Install Android platform-tools (adb) and enable USB debugging on the phone."
  exit 1
fi

if [ ! -f "$APK" ]; then
  echo "ERROR: APK not found: $APK"
  echo "  Build first: ./scripts/build-android-apk.sh --wait --download"
  exit 1
fi

DEVICES="$(adb devices | awk 'NR>1 && $2=="device" {print $1}')"
if [ -z "$DEVICES" ]; then
  echo "ERROR: No adb device. Enable USB debugging and accept the RSA prompt on the phone."
  adb devices
  exit 1
fi

echo "==> Installing $APK"
adb install -r "$APK"
echo "==> Done. Open TalkCash on the phone."
