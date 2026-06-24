#!/usr/bin/env bash
# TalkCash — production AAB via Gradle (no EAS Build)
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
ANDROID="$MOBILE/android"
DIST="${DIST_DIR:-$ROOT/dist}"
AAB_OUT="$DIST/talkcash-prod.aab"

export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://talkcash-api-prod.onrender.com/api/v1}"
export EXPO_PUBLIC_APP_ENV="${EXPO_PUBLIC_APP_ENV:-production}"
export EXPO_PUBLIC_PRIVACY_URL="${EXPO_PUBLIC_PRIVACY_URL:-https://talkcash-api-prod.onrender.com/privacy}"
export EXPO_PUBLIC_TERMS_URL="${EXPO_PUBLIC_TERMS_URL:-https://talkcash-api-prod.onrender.com/terms}"
export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"
export ANDROID_KEYSTORE_FILE="${ANDROID_KEYSTORE_FILE:-release.keystore}"

mkdir -p "$DIST" "$ANDROID/app"
cd "$MOBILE"
npm ci --prefer-offline --no-audit

if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$ANDROID/app/release.keystore"
  printf 'storeFile=release.keystore\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n' \
    "${ANDROID_KEYSTORE_PASSWORD:-}" \
    "${ANDROID_KEY_ALIAS:-}" \
    "${ANDROID_KEY_PASSWORD:-}" \
    > "$ANDROID/keystore.properties"
fi

if [ ! -f "$ANDROID/app/release.keystore" ] && [ ! -f "$ANDROID/keystore.properties" ]; then
  echo "ERROR: Production keystore required at mobile/android/app/release.keystore"
  exit 1
fi

# Optional: refresh native project from Expo (disabled by default — prebuild --clean breaks release signing)
if [ "${RUN_EXPO_PREBUILD:-0}" = "1" ]; then
  echo "==> Sync android/ with Expo (prebuild --clean)"
  npx expo prebuild --platform android --no-install --clean
  bash "$ROOT/scripts/patch-android-release-signing.sh" "$ANDROID/app/build.gradle"
fi

echo "==> Build release AAB with committed android/ + production keystore"

cd "$ANDROID"
chmod +x gradlew
./gradlew bundleRelease --no-daemon -x lint

GRADLE_AAB="$ANDROID/app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "$GRADLE_AAB" ]; then
  echo "ERROR: Gradle did not produce $GRADLE_AAB"
  exit 1
fi

cp "$GRADLE_AAB" "$AAB_OUT"
echo "==> AAB ready: $AAB_OUT"
ls -lh "$AAB_OUT"

if command -v keytool >/dev/null 2>&1; then
  cert_sha1="$(unzip -p "$AAB_OUT" 'META-INF/*RSA' 2>/dev/null | keytool -printcert 2>/dev/null | awk -F': ' '/SHA1:/ {print $2; exit}')"
  if [ -n "$cert_sha1" ]; then
    echo "==> AAB signing SHA1: $cert_sha1"
    if [ "$cert_sha1" = "5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25" ]; then
      echo "ERROR: AAB signed with debug keystore."
      exit 1
    fi
    if [ "$cert_sha1" != "0F:DA:5F:69:0A:9F:B5:50:54:67:3A:19:94:FF:A3:6A:09:2C:5F:0D" ]; then
      echo "ERROR: AAB signing SHA1 mismatch (expected Play upload key)."
      exit 1
    fi
    echo "==> Signing OK (production upload key)"
  fi
fi
