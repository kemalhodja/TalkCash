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

# prebuild --clean deletes android/ — preserve production keystore first
SIGNING_BACKUP="$(mktemp -d)"
if [ -f "$ANDROID/keystore.properties" ]; then
  cp "$ANDROID/keystore.properties" "$SIGNING_BACKUP/"
  store_file="$(grep '^storeFile=' "$ANDROID/keystore.properties" | cut -d= -f2-)"
  if [ -n "$store_file" ] && [ -f "$ANDROID/app/$store_file" ]; then
    cp "$ANDROID/app/$store_file" "$SIGNING_BACKUP/$store_file"
  fi
fi

echo "==> Sync android/ with Expo (prebuild)"
npx expo prebuild --platform android --no-install --clean

# Restore production signing files wiped by prebuild --clean
mkdir -p "$ANDROID/app"
if [ -f "$SIGNING_BACKUP/keystore.properties" ]; then
  cp "$SIGNING_BACKUP/keystore.properties" "$ANDROID/"
  store_file="$(grep '^storeFile=' "$SIGNING_BACKUP/keystore.properties" | cut -d= -f2-)"
  if [ -n "$store_file" ] && [ -f "$SIGNING_BACKUP/$store_file" ]; then
    cp "$SIGNING_BACKUP/$store_file" "$ANDROID/app/$store_file"
  fi
fi
rm -rf "$SIGNING_BACKUP"

if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$ANDROID/app/release.keystore"
  if [ ! -f "$ANDROID/keystore.properties" ]; then
    printf 'storeFile=release.keystore\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n' \
      "${ANDROID_KEYSTORE_PASSWORD:-}" \
      "${ANDROID_KEY_ALIAS:-}" \
      "${ANDROID_KEY_PASSWORD:-}" \
      > "$ANDROID/keystore.properties"
  fi
fi

if [ ! -f "$ANDROID/app/release.keystore" ] && [ ! -f "$ANDROID/keystore.properties" ]; then
  echo "ERROR: Production keystore missing after prebuild."
  exit 1
fi

# Production signing survives prebuild --clean (kept outside android/)
cp "$MOBILE/talkcash-signing.gradle" "$ANDROID/talkcash-signing.gradle"

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

# Fail fast if release build was signed with the Expo debug keystore
if command -v keytool >/dev/null 2>&1; then
  cert_sha1="$(unzip -p "$AAB_OUT" 'META-INF/*RSA' 2>/dev/null | keytool -printcert 2>/dev/null | awk -F': ' '/SHA1:/ {print $2; exit}')"
  if [ -n "$cert_sha1" ]; then
    echo "==> AAB signing SHA1: $cert_sha1"
    if [ "$cert_sha1" = "5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25" ]; then
      echo "ERROR: AAB signed with debug keystore — production keystore was not applied."
      exit 1
    fi
  fi
fi
