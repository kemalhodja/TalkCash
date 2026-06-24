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

has_keystore=0
if [ -n "${ANDROID_KEYSTORE_FILE:-}" ] && [ -f "$ANDROID/app/$ANDROID_KEYSTORE_FILE" ]; then
  has_keystore=1
elif [ -f "$ANDROID/keystore.properties" ]; then
  has_keystore=1
fi

if [ "$has_keystore" -eq 0 ]; then
  echo "ERROR: Production keystore required."
  echo "  Option A: mobile/android/keystore.properties (see keystore.properties.example)"
  echo "  Option B: ANDROID_KEYSTORE_FILE + ANDROID_KEYSTORE_PASSWORD + ANDROID_KEY_ALIAS + ANDROID_KEY_PASSWORD"
  echo "  Export once from EAS: cd mobile && eas credentials -p android"
  exit 1
fi

mkdir -p "$DIST"
cd "$MOBILE"
npm ci --prefer-offline --no-audit

echo "==> Sync android/ with Expo (prebuild)"
npx expo prebuild --platform android --no-install --clean

# Re-apply production signing after prebuild
SIGNING_LINE='apply from: "../talkcash-signing.gradle"'
BUILD_GRADLE="$ANDROID/app/build.gradle"
if ! grep -q "talkcash-signing.gradle" "$BUILD_GRADLE"; then
  sed -i "/^android {/i $SIGNING_LINE" "$BUILD_GRADLE"
fi

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
