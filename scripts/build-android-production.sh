#!/usr/bin/env bash
# Build Android production AAB for Google Play (Gradle — no EAS Build)
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/build-android-production.sh

Builds TalkCash production AAB via Gradle (no EAS quota).

Requires:
  mobile/android/app/release.keystore
  mobile/android/keystore.properties  OR  ANDROID_KEYSTORE_* env vars

See docs/ANDROID_AAB_GRADLE.md for keystore export from EAS (one-time).

After build:
  dist/talkcash-prod.aab → Play Console → Internal testing

EOF
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

bash "$ROOT/scripts/build-aab-gradle.sh"
