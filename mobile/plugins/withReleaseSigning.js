const { withAppBuildGradle } = require("@expo/config-plugins");

const KEYSTORE_BLOCK = `
def talkcashKeystoreProperties = new Properties()
def talkcashKeystorePropertiesFile = rootProject.file("keystore.properties")
if (talkcashKeystorePropertiesFile.exists()) {
    talkcashKeystoreProperties.load(new FileInputStream(talkcashKeystorePropertiesFile))
}

def talkcashSecretOrProp = { String propKey, String envKey ->
    def env = System.getenv(envKey)
    if (env != null && !env.isEmpty()) return env
    return talkcashKeystoreProperties.getProperty(propKey)
}

def talkcashReleaseKeystorePath = System.getenv("ANDROID_KEYSTORE_FILE") ?: talkcashKeystoreProperties.getProperty("storeFile")
`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes("talkcashReleaseKeystorePath")) {
      cfg.modResults.contents = contents;
      return cfg;
    }

    contents = contents.replace(/(def jscFlavor = .+\n)/, `$1${KEYSTORE_BLOCK}\n`);

    contents = contents.replace(
      /signingConfigs \{\s*\n\s*debug \{/,
      `signingConfigs {
        release {
            if (talkcashReleaseKeystorePath != null) {
                storeFile file(talkcashReleaseKeystorePath)
                storePassword talkcashSecretOrProp("storePassword", "ANDROID_KEYSTORE_PASSWORD")
                keyAlias talkcashSecretOrProp("keyAlias", "ANDROID_KEY_ALIAS")
                keyPassword talkcashSecretOrProp("keyPassword", "ANDROID_KEY_PASSWORD")
            }
        }
        debug {`,
    );

    contents = contents.replace(
      /buildTypes \{\s*\n\s*debug \{\s*\n\s*signingConfig signingConfigs\.debug\s*\n\s*\}\s*\n\s*release \{\s*\n\s*signingConfig signingConfigs\.debug/,
      `buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig talkcashReleaseKeystorePath != null ? signingConfigs.release : signingConfigs.debug`,
    );

    contents = contents.replace(/versionCode \d+/, "versionCode 25");
    contents = contents.replace(/versionName "[^"]+"/, 'versionName "1.2.1"');

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withReleaseSigning;
