const { withAppBuildGradle } = require("@expo/config-plugins");

const KEYSTORE_BLOCK = `
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

def secretOrProp = { String propKey, String envKey ->
    def env = System.getenv(envKey)
    if (env != null && !env.isEmpty()) return env
    return keystoreProperties.getProperty(propKey)
}

def releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_FILE") ?: keystoreProperties.getProperty("storeFile")
`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes("releaseKeystorePath")) {
      cfg.modResults.contents = contents;
      return cfg;
    }

    contents = contents.replace(/(def jscFlavor = .+\n)/, `$1${KEYSTORE_BLOCK}\n`);

    contents = contents.replace(
      /signingConfigs \{\s*\n\s*debug \{/,
      `signingConfigs {
        release {
            if (releaseKeystorePath != null) {
                storeFile file(releaseKeystorePath)
                storePassword secretOrProp("storePassword", "ANDROID_KEYSTORE_PASSWORD")
                keyAlias secretOrProp("keyAlias", "ANDROID_KEY_ALIAS")
                keyPassword secretOrProp("keyPassword", "ANDROID_KEY_PASSWORD")
            }
        }
        debug {`,
    );

    contents = contents.replace(
      /release \{\s*\n\s*signingConfig signingConfigs\.debug/,
      `release {
            signingConfig releaseKeystorePath != null ? signingConfigs.release : signingConfigs.debug`,
    );

    contents = contents.replace(/versionCode \d+/, "versionCode 25");
    contents = contents.replace(/versionName "[^"]+"/, 'versionName "1.2.1"');

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withReleaseSigning;
