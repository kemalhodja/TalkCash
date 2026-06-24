#!/usr/bin/env bash
# Inject production keystore signing into app/build.gradle after expo prebuild.
set -eu

BUILD_GRADLE="${1:?build.gradle path required}"
SNIPPET="$(dirname "$0")/../mobile/templates/release-keystore.gradle.snippet"

if grep -q 'talkcashReleaseKeystorePath' "$BUILD_GRADLE"; then
  echo "==> Release signing already present in build.gradle"
  exit 0
fi

python3 - "$BUILD_GRADLE" "$SNIPPET" <<'PY'
import pathlib
import re
import sys

build = pathlib.Path(sys.argv[1])
snippet = pathlib.Path(sys.argv[2]).read_text()
text = build.read_text()

if "talkcashReleaseKeystorePath" in text:
    sys.exit(0)

if "def jscFlavor" in text:
    text = re.sub(r"(def jscFlavor = .+\n)", r"\1" + snippet + "\n", text, count=1)
else:
    text = re.sub(r"\nandroid \{\n", "\n" + snippet + "\nandroid {\n", text, count=1)

text = re.sub(
    r"signingConfigs \{\s*\n\s*debug \{",
    """signingConfigs {
        release {
            if (talkcashReleaseKeystorePath != null) {
                storeFile file(talkcashReleaseKeystorePath)
                storePassword talkcashSecretOrProp("storePassword", "ANDROID_KEYSTORE_PASSWORD")
                keyAlias talkcashSecretOrProp("keyAlias", "ANDROID_KEY_ALIAS")
                keyPassword talkcashSecretOrProp("keyPassword", "ANDROID_KEY_PASSWORD")
            }
        }
        debug {""",
    text,
    count=1,
)

text = re.sub(
    r"buildTypes \{\s*\n\s*debug \{\s*\n\s*signingConfig signingConfigs\.debug\s*\n\s*\}\s*\n\s*release \{\s*\n\s*signingConfig signingConfigs\.debug",
    """buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig talkcashReleaseKeystorePath != null ? signingConfigs.release : signingConfigs.debug""",
    text,
    count=1,
)

text = re.sub(r"versionCode \d+", "versionCode 25", text, count=1)
text = re.sub(r'versionName "[^"]+"', 'versionName "1.2.1"', text, count=1)

build.write_text(text)
print("==> Patched release signing into", build)
PY
